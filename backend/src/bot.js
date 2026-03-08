// src/bot.js - Core trading bot engine
const alpaca = require('./alpaca');
const { evaluateSignal } = require('./strategy');

class TradingBot {
  constructor() {
    this.running = false;
    this.config = {
      apiKey: process.env.ALPACA_API_KEY || '',
      secretKey: process.env.ALPACA_SECRET_KEY || '',
      mode: process.env.ALPACA_MODE || 'paper',
      positionSize: parseFloat(process.env.POSITION_SIZE) || 0.80,
      stopLoss: parseFloat(process.env.STOP_LOSS) || 0.08,
      takeProfit: parseFloat(process.env.TAKE_PROFIT) || 0.25,
      rsiBuy: parseInt(process.env.RSI_BUY_BELOW) || 35,
      rsiSell: parseInt(process.env.RSI_SELL_ABOVE) || 70,
      scanInterval: parseInt(process.env.SCAN_INTERVAL_SECONDS) || 60,
      watchlist: (process.env.WATCHLIST || 'BTC/USD,ETH/USD,SOL/USD,DOGE/USD,AVAX/USD').split(','),
    };

    this.state = {
      portfolioValue: 0,
      cashBalance: 0,
      positions: {},      // symbol -> position data
      signals: [],        // latest signals
      trades: [],         // trade history (last 100)
      equityHistory: [],  // [{t, v}] for chart
      wins: 0,
      losses: 0,
      startValue: 0,
      todayStartValue: 0,
      startedAt: null,
      lastScan: null,
      events: [],         // system event log (last 50)
    };

    this.scanTimer = null;
  }

  // ─── LIFECYCLE ────────────────────────────────────────────────

  async start() {
    if (this.running) return { ok: false, msg: 'Bot already running' };

    if (!this.config.apiKey || !this.config.secretKey) {
      return { ok: false, msg: 'Missing API credentials' };
    }

    try {
      const account = await alpaca.getAccount(
        this.config.apiKey, this.config.secretKey, this.config.mode
      );
      this.state.portfolioValue = parseFloat(account.portfolio_value);
      this.state.cashBalance = parseFloat(account.cash);
      this.state.startValue = this.state.startValue || this.state.portfolioValue;
      this.state.todayStartValue = this.state.portfolioValue;
      this.state.startedAt = new Date().toISOString();

      this.state.equityHistory.push({ t: Date.now(), v: this.state.portfolioValue });

      this.running = true;
      this.addEvent('success', `Bot started in ${this.config.mode.toUpperCase()} mode`);
      this.addEvent('info', `Portfolio: $${this.state.portfolioValue.toFixed(2)}`);

      // Start scan loop
      this.runScan();
      this.scanTimer = setInterval(() => this.runScan(), this.config.scanInterval * 1000);

      return { ok: true, msg: 'Bot started' };
    } catch (err) {
      return { ok: false, msg: `Connection failed: ${err.message}` };
    }
  }

  stop() {
    this.running = false;
    if (this.scanTimer) { clearInterval(this.scanTimer); this.scanTimer = null; }
    this.addEvent('warning', 'Bot stopped by user');
    return { ok: true, msg: 'Bot stopped' };
  }

  updateConfig(newConfig) {
    const allowed = ['positionSize','stopLoss','takeProfit','rsiBuy','rsiSell','scanInterval','watchlist'];
    allowed.forEach(k => { if (newConfig[k] !== undefined) this.config[k] = newConfig[k]; });

    // Restart scan timer if interval changed
    if (newConfig.scanInterval && this.running) {
      clearInterval(this.scanTimer);
      this.scanTimer = setInterval(() => this.runScan(), this.config.scanInterval * 1000);
    }
    this.addEvent('info', 'Configuration updated');
  }

  setCredentials(apiKey, secretKey, mode) {
    if (this.running) return { ok: false, msg: 'Stop bot before changing credentials' };
    this.config.apiKey = apiKey;
    this.config.secretKey = secretKey;
    if (mode) this.config.mode = mode;
    return { ok: true };
  }

  // ─── SCAN CYCLE ───────────────────────────────────────────────

  async runScan() {
    if (!this.running) return;
    this.state.lastScan = new Date().toISOString();
    this.addEvent('info', `Scanning ${this.config.watchlist.length} pairs...`);

    const signals = [];

    for (const symbol of this.config.watchlist) {
      try {
        // Fetch OHLCV bars (last 30 1-minute bars)
        const bars = await alpaca.getCryptoBars(
          this.config.apiKey, this.config.secretKey, symbol, '1Min', 30
        );

        const signal = evaluateSignal(symbol, bars, {
          rsiBuy: this.config.rsiBuy,
          rsiSell: this.config.rsiSell,
        });

        signals.push(signal);

        // Check exits for open positions
        if (this.state.positions[symbol] && signal.price > 0) {
          await this.checkExit(symbol, signal.price);
        }
      } catch (err) {
        this.addEvent('danger', `Error scanning ${symbol}: ${err.message}`);
      }
    }

    // Sort by score descending
    signals.sort((a, b) => b.score - a.score);
    this.state.signals = signals;

    // Attempt entry on strongest signal (score >= 70, no existing position)
    const best = signals[0];
    if (best && best.score >= 70 && !this.state.positions[best.symbol] && best.price > 0) {
      await this.executeEntry(best);
    }

    // Refresh account balance
    try {
      const account = await alpaca.getAccount(
        this.config.apiKey, this.config.secretKey, this.config.mode
      );
      this.state.portfolioValue = parseFloat(account.portfolio_value);
      this.state.cashBalance = parseFloat(account.cash);
      this.state.equityHistory.push({ t: Date.now(), v: this.state.portfolioValue });
      if (this.state.equityHistory.length > 500) this.state.equityHistory.shift();
    } catch {}
  }

  // ─── ENTRY ────────────────────────────────────────────────────

  async executeEntry(signal) {
    const { symbol, price } = signal;
    const notional = this.state.cashBalance * this.config.positionSize;

    if (notional < 1) {
      this.addEvent('warning', `Skipping ${symbol} — insufficient cash ($${this.state.cashBalance.toFixed(2)})`);
      return;
    }

    try {
      const order = await alpaca.placeOrder(
        this.config.apiKey, this.config.secretKey, this.config.mode,
        { symbol, side: 'buy', notional }
      );

      const qty = notional / price;
      this.state.positions[symbol] = {
        symbol,
        orderId: order.id,
        entryPrice: price,
        qty,
        notional,
        entryTime: new Date().toISOString(),
        stopPrice: price * (1 - this.config.stopLoss),
        targetPrice: price * (1 + this.config.takeProfit),
      };

      this.addEvent('success',
        `BUY ${symbol} @ $${price.toFixed(4)} | $${notional.toFixed(2)} (${(this.config.positionSize*100).toFixed(0)}%)`
      );

      this.recordTrade({
        symbol, side: 'BUY', qty, price, notional,
        time: new Date().toISOString(), pnl: null
      });

    } catch (err) {
      this.addEvent('danger', `Order failed for ${symbol}: ${err.message}`);
    }
  }

  // ─── EXIT ─────────────────────────────────────────────────────

  async checkExit(symbol, currentPrice) {
    const pos = this.state.positions[symbol];
    if (!pos) return;

    const pnlPct = (currentPrice - pos.entryPrice) / pos.entryPrice;
    const shouldStop = currentPrice <= pos.stopPrice;
    const shouldTakeProfit = currentPrice >= pos.targetPrice;

    if (shouldStop || shouldTakeProfit) {
      const reason = shouldTakeProfit ? 'TAKE PROFIT' : 'STOP LOSS';
      await this.executeExit(symbol, currentPrice, reason);
    }
  }

  async executeExit(symbol, price, reason) {
    const pos = this.state.positions[symbol];
    if (!pos) return;

    try {
      await alpaca.closePosition(
        this.config.apiKey, this.config.secretKey, this.config.mode, symbol
      );

      const pnl = (price - pos.entryPrice) / pos.entryPrice * pos.notional;
      const isWin = pnl > 0;
      if (isWin) this.state.wins++; else this.state.losses++;

      this.addEvent(
        isWin ? 'success' : 'danger',
        `${reason}: ${symbol} @ $${price.toFixed(4)} | P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`
      );

      this.recordTrade({
        symbol, side: 'SELL', qty: pos.qty, price,
        notional: pos.notional, time: new Date().toISOString(),
        pnl: parseFloat(pnl.toFixed(4)), reason
      });

      delete this.state.positions[symbol];

    } catch (err) {
      this.addEvent('danger', `Exit failed for ${symbol}: ${err.message}`);
    }
  }

  // ─── HELPERS ─────────────────────────────────────────────────

  addEvent(type, message) {
    const event = { type, message, time: new Date().toISOString() };
    this.state.events.unshift(event);
    if (this.state.events.length > 50) this.state.events.pop();
    console.log(`[${type.toUpperCase()}] ${message}`);
  }

  recordTrade(trade) {
    this.state.trades.unshift(trade);
    if (this.state.trades.length > 100) this.state.trades.pop();
  }

  getStatus() {
    const total = this.state.wins + this.state.losses;
    return {
      running: this.running,
      mode: this.config.mode,
      config: {
        positionSize: this.config.positionSize,
        stopLoss: this.config.stopLoss,
        takeProfit: this.config.takeProfit,
        rsiBuy: this.config.rsiBuy,
        rsiSell: this.config.rsiSell,
        scanInterval: this.config.scanInterval,
        watchlist: this.config.watchlist,
      },
      portfolioValue: this.state.portfolioValue,
      cashBalance: this.state.cashBalance,
      startValue: this.state.startValue,
      todayStartValue: this.state.todayStartValue,
      positions: this.state.positions,
      signals: this.state.signals,
      trades: this.state.trades.slice(0, 50),
      equityHistory: this.state.equityHistory.slice(-200),
      wins: this.state.wins,
      losses: this.state.losses,
      winRate: total > 0 ? Math.round((this.state.wins / total) * 100) : null,
      totalTrades: total,
      lastScan: this.state.lastScan,
      startedAt: this.state.startedAt,
      events: this.state.events,
    };
  }
}

module.exports = new TradingBot();
