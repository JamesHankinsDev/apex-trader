// src/liveTrader.js — Live trader that mirrors the winning experiment
// Watches the experiment scorer, adopts the highest-scoring experiment's
// strategy by copying its trades to a separate Alpaca account.
// Only activates when LIVE_TRADER_ENABLED=true and credentials are set.

const alpaca = require('./alpaca');
const { evaluate, getWinner } = require('./experimentScorer');

const MIRROR_CHECK_INTERVAL = 30_000; // check for new trades every 30s

class LiveTrader {
  constructor() {
    this.enabled = process.env.LIVE_TRADER_ENABLED === 'true';
    this.config = {
      apiKey: process.env.LIVE_TRADER_API_KEY || '',
      secretKey: process.env.LIVE_TRADER_SECRET_KEY || '',
      mode: 'live', // live trader always uses real money
    };
    this.running = false;
    this.mirrorTimer = null;
    this.mirroredFrom = null;     // which experiment we're currently mirroring
    this.lastMirroredTrade = {};  // botKey -> { time, symbol, side }
    this.state = {
      portfolioValue: 0,
      cashBalance: 0,
      positions: {},
      trades: [],
      events: [],
      mirrorSource: null,
      lastCheck: null,
    };
  }

  async start(botModules) {
    if (!this.enabled) {
      console.log('[LIVE_TRADER] Disabled — set LIVE_TRADER_ENABLED=true to activate');
      return { ok: false, msg: 'Live trader disabled' };
    }
    if (!this.config.apiKey || !this.config.secretKey) {
      console.log('[LIVE_TRADER] Missing API credentials — set LIVE_TRADER_API_KEY and LIVE_TRADER_SECRET_KEY');
      return { ok: false, msg: 'Missing live trader credentials' };
    }

    this.botModules = botModules; // { main, exp1, exp2 } — references to bot instances
    this.running = true;

    try {
      const account = await alpaca.getAccount(this.config.apiKey, this.config.secretKey, this.config.mode);
      this.state.portfolioValue = parseFloat(account.portfolio_value);
      this.state.cashBalance = parseFloat(account.cash);
    } catch (err) {
      console.log(`[LIVE_TRADER] Account fetch failed: ${err.message}`);
      return { ok: false, msg: `Connection failed: ${err.message}` };
    }

    this.addEvent('success', `Live trader started | Mode: ${this.config.mode} | Balance: $${this.state.portfolioValue.toFixed(2)}`);

    // Start mirror loop
    this.mirrorCheck();
    this.mirrorTimer = setInterval(() => this.mirrorCheck(), MIRROR_CHECK_INTERVAL);

    return { ok: true, msg: 'Live trader started' };
  }

  stop() {
    this.running = false;
    if (this.mirrorTimer) { clearInterval(this.mirrorTimer); this.mirrorTimer = null; }
    this.addEvent('warning', 'Live trader stopped');
    return { ok: true, msg: 'Live trader stopped' };
  }

  /**
   * Check if the winning experiment has changed and mirror any new trades.
   */
  async mirrorCheck() {
    if (!this.running) return;
    this.state.lastCheck = new Date().toISOString();

    // Evaluate experiments
    const evaluation = evaluate();
    const winner = evaluation.winner;

    if (!winner) {
      if (this.mirroredFrom) {
        this.addEvent('info', '[MIRROR] No eligible winner — holding cash. Experiments need 100+ trades with positive returns.');
      }
      this.state.mirrorSource = { label: 'Holding Cash', reason: 'No experiment qualifies yet' };
      this.mirroredFrom = null;
      return;
    }

    // Detect winner change
    if (this.mirroredFrom !== winner) {
      const label = evaluation.winnerLabel;
      const score = evaluation.scores[winner]?.score;
      this.addEvent('info', `[MIRROR] Switching to ${label} (score ${score}) — will mirror future trades`);
      this.mirroredFrom = winner;
      this.state.mirrorSource = {
        botKey: winner,
        label: evaluation.winnerLabel,
        score: evaluation.scores[winner]?.score,
        switchedAt: new Date().toISOString(),
      };
    }

    // Check for new trades from the winning experiment
    const botModule = this.botModules[winner];
    if (!botModule?.state?.trades?.length) return;

    const latestTrade = botModule.state.trades[0]; // newest first
    const lastMirrored = this.lastMirroredTrade[winner];

    // Skip if we've already mirrored this trade
    if (lastMirrored &&
        latestTrade.time === lastMirrored.time &&
        latestTrade.symbol === lastMirrored.symbol &&
        latestTrade.side === lastMirrored.side) {
      return;
    }

    // Mirror the trade
    try {
      if (latestTrade.side === 'BUY') {
        await this.mirrorBuy(latestTrade);
      } else if (latestTrade.side === 'SELL') {
        await this.mirrorSell(latestTrade);
      }
      this.lastMirroredTrade[winner] = {
        time: latestTrade.time,
        symbol: latestTrade.symbol,
        side: latestTrade.side,
      };
    } catch (err) {
      this.addEvent('danger', `[MIRROR] Failed to mirror ${latestTrade.side} ${latestTrade.symbol}: ${err.message}`);
    }

    // Refresh account
    try {
      const account = await alpaca.getAccount(this.config.apiKey, this.config.secretKey, this.config.mode);
      this.state.portfolioValue = parseFloat(account.portfolio_value);
      this.state.cashBalance = parseFloat(account.cash);
    } catch {}
  }

  async mirrorBuy(trade) {
    const notional = Math.min(trade.notional || 25, this.state.cashBalance);
    if (notional < 1) {
      this.addEvent('warning', `[MIRROR] Skipping BUY ${trade.symbol} — insufficient cash ($${this.state.cashBalance.toFixed(2)})`);
      return;
    }

    const order = await alpaca.placeOrder(
      this.config.apiKey, this.config.secretKey, this.config.mode,
      { symbol: trade.symbol, side: 'buy', notional }
    );

    this.state.positions[trade.symbol] = {
      symbol: trade.symbol,
      entryPrice: trade.price,
      notional,
      entryTime: new Date().toISOString(),
      mirroredFrom: this.mirroredFrom,
    };

    this.addEvent('success', `[MIRROR] BUY ${trade.symbol} @ $${trade.price.toFixed(4)} | $${notional.toFixed(2)} | mirroring ${this.state.mirrorSource?.label}`);
    this.state.trades.unshift({ ...trade, mirrored: true, time: new Date().toISOString() });
    if (this.state.trades.length > 100) this.state.trades.pop();
  }

  async mirrorSell(trade) {
    if (!this.state.positions[trade.symbol]) {
      return; // no position to sell
    }

    try {
      await alpaca.closePosition(this.config.apiKey, this.config.secretKey, this.config.mode, trade.symbol);
    } catch (err) {
      this.addEvent('warning', `[MIRROR] Close position failed for ${trade.symbol}: ${err.message}`);
      return;
    }

    const pos = this.state.positions[trade.symbol];
    const pnlPct = pos.entryPrice ? ((trade.price - pos.entryPrice) / pos.entryPrice * 100) : 0;

    this.addEvent(pnlPct >= 0 ? 'success' : 'danger',
      `[MIRROR] SELL ${trade.symbol} @ $${trade.price.toFixed(4)} | P&L: ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}% | mirroring ${this.state.mirrorSource?.label}`
    );

    this.state.trades.unshift({
      ...trade, mirrored: true, pnl: trade.pnl,
      time: new Date().toISOString(),
    });
    if (this.state.trades.length > 100) this.state.trades.pop();
    delete this.state.positions[trade.symbol];
  }

  addEvent(type, message) {
    this.state.events.unshift({ type, message, time: new Date().toISOString() });
    if (this.state.events.length > 50) this.state.events.pop();
    console.log(`[LIVE_TRADER][${type.toUpperCase()}] ${message}`);
  }

  getStatus() {
    const evaluation = evaluate();
    return {
      enabled: this.enabled,
      running: this.running,
      mode: this.config.mode,
      portfolioValue: this.state.portfolioValue,
      cashBalance: this.state.cashBalance,
      positions: this.state.positions,
      trades: this.state.trades.slice(0, 30),
      events: this.state.events,
      mirrorSource: this.state.mirrorSource,
      lastCheck: this.state.lastCheck,
      evaluation,
    };
  }
}

module.exports = new LiveTrader();
