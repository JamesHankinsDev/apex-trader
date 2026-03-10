// src/experiment2-bot.js - 20-Bar Momentum Breakout Experiment Bot
// Trend-following: buy breakouts above 20-bar high, trail stops on the way up
const fs = require('fs');
const path = require('path');
const alpaca = require('./alpaca');
const { evaluate } = require('./breakout-strategy');
const cryptoStream = require('./crypto-stream');

const STATE_FILE = path.join(__dirname, '..', '.experiment2-state.json');
const SPREAD_COST_PCT = 0.0015;
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const EIGHTY_BARS_4H_MS = 80 * FOUR_HOURS_MS; // ~13 days for 50+ bars of 4h data

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {}
  return {};
}

function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({
      startValue: state.startValue,
      wins: state.wins,
      losses: state.losses,
      positions: state.positions,
      cooldowns: state.cooldowns,
    }, null, 2));
  } catch {}
}

// Poll Alpaca for actual fill price
async function getFillPrice(apiKey, secretKey, mode, orderId, fallbackPrice) {
  for (let i = 0; i < 5; i++) {
    await new Promise(r => setTimeout(r, 1000));
    try {
      const order = await alpaca.getOrder(apiKey, secretKey, mode, orderId);
      if (order.filled_avg_price) return parseFloat(order.filled_avg_price);
      if (order.status === 'canceled' || order.status === 'expired') break;
    } catch { break; }
  }
  return fallbackPrice;
}

class Experiment2Bot {
  constructor() {
    this.running = false;
    this.config = {
      apiKey: process.env.EXPERIMENT_2_ALPACA_API_KEY || '',
      secretKey: process.env.EXPERIMENT_2_ALPACA_SECRET_KEY || '',
      mode: 'paper',
      watchlist: (process.env.EXPERIMENT_2_WATCHLIST || 'AVAX/USD,LINK/USD,AAVE/USD,DOT/USD,UNI/USD').split(','),
      positionSize: 0.95,        // 95% of available balance
      maxPositions: 1,           // Only one position at a time
      trailingStopPct: 0.15,     // 15% trailing stop
      hardStopPct: 0.20,         // 20% hard stop loss
      takeProfitMultiple: 3,     // 3x initial stop distance
      maxHoldHours: 72,          // 72-hour time exit
      scanInterval: parseInt(process.env.EXPERIMENT_2_SCAN_INTERVAL_SECONDS) || 30,
      minBalance: 15,            // Pause if balance < $15
      cooldownCandles: 2,        // Skip 2 candles after stop-loss on same coin
    };

    const saved = loadState();
    this.state = {
      portfolioValue: 0,
      cashBalance: 0,
      positions: saved.positions || {},
      cooldowns: saved.cooldowns || {},  // symbol -> { until: ISO timestamp }
      signals: [],
      trades: [],
      equityHistory: [],
      wins: saved.wins || 0,
      losses: saved.losses || 0,
      startValue: saved.startValue || 0,
      todayStartValue: 0,
      todayDate: null,
      startedAt: null,
      lastScan: null,
      events: [],
    };
    this.scanTimer = null;
    this.streamHandle = null;
  }

  // ─── LIFECYCLE ──────────────────────────────────────────────

  async start() {
    if (this.running) return { ok: false, msg: 'Experiment 2 already running' };
    if (!this.config.apiKey || !this.config.secretKey) {
      return { ok: false, msg: 'Missing experiment API credentials' };
    }

    try {
      const account = await alpaca.getAccount(this.config.apiKey, this.config.secretKey, this.config.mode);
      this.state.portfolioValue = parseFloat(account.portfolio_value);
      this.state.cashBalance = parseFloat(account.cash);
      this.state.todayDate = new Date().toDateString();

      try {
        const history = await alpaca.getPortfolioHistory(
          this.config.apiKey, this.config.secretKey, this.config.mode,
          { period: 'all', timeframe: '1D' }
        );
        if (history?.equity?.length > 0) {
          const firstEquity = history.equity.find(v => v > 0);
          if (firstEquity) this.state.startValue = firstEquity;
          const lastEquity = history.equity[history.equity.length - 1];
          this.state.todayStartValue = lastEquity > 0 ? lastEquity : this.state.portfolioValue;
          this.state.equityHistory = history.timestamp
            .map((ts, i) => ({ t: ts * 1000, v: history.equity[i] }))
            .filter(d => d.v > 0);
        } else {
          this.state.todayStartValue = this.state.portfolioValue;
        }
      } catch {
        this.state.startValue = this.state.startValue || this.state.portfolioValue;
        this.state.todayStartValue = this.state.portfolioValue;
      }

      await this.syncTradeHistory();
      await this.syncPositions();

      saveState(this.state);
      this.state.startedAt = new Date().toISOString();
      this.state.equityHistory.push({ t: Date.now(), v: this.state.portfolioValue });

      // Connect WebSocket stream for real-time prices
      this.streamHandle = cryptoStream.connect(
        this.config.apiKey, this.config.secretKey, this.config.watchlist,
        (type, msg) => this.addEvent(type, `[Stream] ${msg}`)
      );

      this.running = true;
      this.addEvent('success', 'Experiment 2 started (Momentum Breakout)');
      this.addEvent('info', `Portfolio: $${this.state.portfolioValue.toFixed(2)} | Trail: ${(this.config.trailingStopPct * 100)}% | Hard SL: ${(this.config.hardStopPct * 100)}%`);

      this.runScan();
      this.scanTimer = setInterval(() => this.runScan(), this.config.scanInterval * 1000);

      return { ok: true, msg: 'Experiment 2 started' };
    } catch (err) {
      return { ok: false, msg: `Connection failed: ${err.message}` };
    }
  }

  stop() {
    this.running = false;
    if (this.scanTimer) { clearInterval(this.scanTimer); this.scanTimer = null; }
    if (this.streamHandle) { cryptoStream.disconnect(this.streamHandle); this.streamHandle = null; }
    this.addEvent('warning', 'Experiment 2 stopped');
    return { ok: true, msg: 'Experiment 2 stopped' };
  }

  // ─── POSITION SYNC ──────────────────────────────────────────

  async syncPositions() {
    try {
      const positions = await alpaca.getPositions(this.config.apiKey, this.config.secretKey, this.config.mode);
      const alpacaSymbols = new Set();

      for (const pos of positions) {
        const raw = pos.symbol;
        const symbol = raw.includes('/') ? raw : raw.replace(/USD$/, '/USD');
        alpacaSymbols.add(symbol);

        if (!this.state.positions[symbol]) {
          const entryPrice = parseFloat(pos.avg_entry_price);
          const qty = parseFloat(pos.qty);
          this.state.positions[symbol] = {
            symbol, entryPrice, qty,
            notional: entryPrice * qty,
            entryCost: entryPrice * qty * SPREAD_COST_PCT,
            entryTime: new Date().toISOString(),
            highWaterMark: entryPrice,
            trailingStop: entryPrice * (1 - this.config.trailingStopPct),
            hardStop: entryPrice * (1 - this.config.hardStopPct),
            takeProfit: entryPrice * (1 + this.config.trailingStopPct * this.config.takeProfitMultiple),
            orderId: null,
          };
          this.addEvent('info', `Synced position: ${symbol} @ $${entryPrice.toFixed(4)}`);
        } else {
          this.state.positions[symbol].qty = parseFloat(pos.qty);
        }
      }

      for (const symbol of Object.keys(this.state.positions)) {
        if (!alpacaSymbols.has(symbol)) {
          delete this.state.positions[symbol];
        }
      }
      saveState(this.state);
    } catch (err) {
      this.addEvent('warning', `Position sync failed: ${err.message}`);
    }
  }

  // ─── TRADE HISTORY SYNC ────────────────────────────────────

  async syncTradeHistory() {
    try {
      const fills = await alpaca.getActivities(
        this.config.apiKey, this.config.secretKey, this.config.mode, 'FILL', 100
      );
      if (!fills || fills.length === 0) return;

      const trades = [];
      for (const fill of fills) {
        const raw = fill.symbol || '';
        const symbol = raw.includes('/') ? raw : raw.replace(/USD$/, '/USD');
        const side = (fill.side || '').toUpperCase();
        const qty = parseFloat(fill.qty) || 0;
        const price = parseFloat(fill.price) || 0;
        const time = fill.transaction_time || fill.timestamp;
        trades.push({ symbol, side, qty, price, notional: qty * price, time, pnl: null });
      }

      trades.sort((a, b) => new Date(a.time) - new Date(b.time));

      const buyMap = {};
      for (const trade of trades) {
        if (trade.side === 'BUY') {
          buyMap[trade.symbol] = trade;
        } else if (trade.side === 'SELL' && buyMap[trade.symbol]) {
          trade.pnl = parseFloat(((trade.price - buyMap[trade.symbol].price) * trade.qty).toFixed(4));
          delete buyMap[trade.symbol];
        }
      }

      trades.reverse();
      this.state.trades = trades.slice(0, 100);

      let wins = 0, losses = 0;
      for (const t of this.state.trades) {
        if (t.pnl != null) { t.pnl > 0 ? wins++ : losses++; }
      }
      this.state.wins = wins;
      this.state.losses = losses;
      this.addEvent('info', `Loaded ${trades.length} trades from account history`);
    } catch (err) {
      this.addEvent('warning', `Trade history sync failed: ${err.message}`);
    }
  }

  // ─── SCAN CYCLE ─────────────────────────────────────────────

  async runScan() {
    if (!this.running) return;
    this.state.lastScan = new Date().toISOString();

    // Capital protection: pause if balance too low
    if (this.state.cashBalance < this.config.minBalance && Object.keys(this.state.positions).length === 0) {
      this.addEvent('warning', `Balance $${this.state.cashBalance.toFixed(2)} < $${this.config.minBalance} — paused`);
      return;
    }

    const signals = [];

    for (const symbol of this.config.watchlist) {
      try {
        // Fetch 4-hour bars (need 50+ for SMA50, fetch 60 to be safe)
        const bars = await alpaca.getCryptoBars(
          this.config.apiKey, this.config.secretKey, symbol,
          '4Hour', 60, EIGHTY_BARS_4H_MS
        );

        // Get live price
        const livePrice = await alpaca.getLatestCryptoPrice(
          this.config.apiKey, this.config.secretKey, symbol, this.streamHandle
        );
        if (!livePrice || livePrice <= 0) continue;

        const signal = evaluate(symbol, bars, livePrice);
        signals.push(signal);

        // Check exits for open positions
        const pos = this.state.positions[symbol];
        if (pos) {
          pos.livePrice = livePrice;

          // Update high water mark and trailing stop
          if (livePrice > (pos.highWaterMark || pos.entryPrice)) {
            pos.highWaterMark = livePrice;
            pos.trailingStop = livePrice * (1 - this.config.trailingStopPct);
          }

          // Take profit
          if (livePrice >= pos.takeProfit) {
            await this.executeExit(symbol, livePrice, `TAKE PROFIT ($${livePrice.toFixed(2)} >= $${pos.takeProfit.toFixed(2)})`);
            continue;
          }

          // Trailing stop
          if (livePrice <= pos.trailingStop) {
            await this.executeExit(symbol, livePrice, `TRAILING STOP ($${livePrice.toFixed(2)} <= $${pos.trailingStop.toFixed(2)})`, true);
            continue;
          }

          // Hard stop loss
          if (livePrice <= pos.hardStop) {
            await this.executeExit(symbol, livePrice, `HARD STOP ($${livePrice.toFixed(2)} <= $${pos.hardStop.toFixed(2)})`, true);
            continue;
          }

          // Time exit (72 hours)
          const holdHours = (Date.now() - new Date(pos.entryTime).getTime()) / (1000 * 60 * 60);
          if (holdHours >= this.config.maxHoldHours) {
            await this.executeExit(symbol, livePrice, `TIME EXIT (${Math.round(holdHours)}h)`);
            continue;
          }
        }
      } catch (err) {
        this.addEvent('danger', `Error scanning ${symbol}: ${err.message}`);
      }
    }

    this.state.signals = signals;

    // Entry: only 1 position at a time
    const openCount = Object.keys(this.state.positions).length;
    if (openCount < this.config.maxPositions) {
      for (const sig of signals) {
        if (sig.signal !== 'buy') continue;
        if (this.state.positions[sig.symbol]) continue;

        // Check cooldown
        const cd = this.state.cooldowns[sig.symbol];
        if (cd && new Date(cd.until) > new Date()) {
          this.addEvent('info', `Skipping ${sig.symbol} — cooldown until ${new Date(cd.until).toLocaleTimeString()}`);
          continue;
        }

        await this.executeEntry(sig);
        break; // Only one entry per scan
      }
    }

    // Refresh account
    await this.syncPositions();
    try {
      const account = await alpaca.getAccount(this.config.apiKey, this.config.secretKey, this.config.mode);
      this.state.portfolioValue = parseFloat(account.portfolio_value);
      this.state.cashBalance = parseFloat(account.cash);

      const currentDate = new Date().toDateString();
      if (this.state.todayDate && currentDate !== this.state.todayDate) {
        this.state.todayStartValue = this.state.portfolioValue;
        this.state.todayDate = currentDate;
      }
      this.state.equityHistory.push({ t: Date.now(), v: this.state.portfolioValue });
      if (this.state.equityHistory.length > 500) this.state.equityHistory.shift();
    } catch {}
  }

  // ─── ENTRY ──────────────────────────────────────────────────

  async executeEntry(signal) {
    const { symbol, price } = signal;
    const notional = Math.min(
      this.state.portfolioValue * this.config.positionSize,
      this.state.cashBalance
    );
    if (notional < 1) return;

    try {
      const order = await alpaca.placeOrder(
        this.config.apiKey, this.config.secretKey, this.config.mode,
        { symbol, side: 'buy', notional }
      );

      const fillPrice = await getFillPrice(
        this.config.apiKey, this.config.secretKey, this.config.mode, order.id, price
      );
      const entryCost = notional * SPREAD_COST_PCT;
      const qty = (notional - entryCost) / fillPrice;
      const trailingStop = fillPrice * (1 - this.config.trailingStopPct);
      const hardStop = fillPrice * (1 - this.config.hardStopPct);
      const takeProfit = fillPrice * (1 + this.config.trailingStopPct * this.config.takeProfitMultiple);

      this.state.positions[symbol] = {
        symbol, orderId: order.id, entryPrice: fillPrice, qty, notional, entryCost,
        entryTime: new Date().toISOString(),
        highWaterMark: fillPrice,
        trailingStop,
        hardStop,
        takeProfit,
        entrySignal: {
          breakoutHigh: signal.breakoutHigh,
          volumeRatio: signal.volumeRatio,
          sma50: signal.sma50,
          rsi: signal.rsi,
        },
      };

      this.addEvent('success',
        `BUY ${symbol} @ $${fillPrice.toFixed(4)} | ${signal.reasons.join(' · ')} | SL $${hardStop.toFixed(2)} | TP $${takeProfit.toFixed(2)}`
      );
      this.recordTrade({ symbol, side: 'BUY', qty, price: fillPrice, notional, time: new Date().toISOString(), pnl: null });
    } catch (err) {
      this.addEvent('danger', `Order failed for ${symbol}: ${err.message}`);
    }
  }

  // ─── EXIT ───────────────────────────────────────────────────

  async executeExit(symbol, price, reason, isStopLoss = false) {
    const pos = this.state.positions[symbol];
    if (!pos) return;

    try {
      const closeOrder = await alpaca.closePosition(this.config.apiKey, this.config.secretKey, this.config.mode, symbol);
      const exitPrice = closeOrder?.id
        ? await getFillPrice(this.config.apiKey, this.config.secretKey, this.config.mode, closeOrder.id, price)
        : price;

      const exitCost = pos.notional * SPREAD_COST_PCT;
      const totalCost = (pos.entryCost || 0) + exitCost;
      const grossPnl = (exitPrice - pos.entryPrice) / pos.entryPrice * pos.notional;
      const pnl = grossPnl - totalCost;
      const isWin = pnl > 0;
      if (isWin) this.state.wins++; else this.state.losses++;

      this.addEvent(isWin ? 'success' : 'danger',
        `${reason}: ${symbol} @ $${exitPrice.toFixed(4)} | P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`
      );
      this.recordTrade({
        symbol, side: 'SELL', qty: pos.qty, price: exitPrice, notional: pos.notional,
        time: new Date().toISOString(), pnl: parseFloat(pnl.toFixed(4)), reason,
      });

      // Cooldown after stop-loss: skip 2 candles (2 x 4h = 8 hours)
      if (isStopLoss) {
        const cooldownMs = this.config.cooldownCandles * FOUR_HOURS_MS;
        this.state.cooldowns[symbol] = { until: new Date(Date.now() + cooldownMs).toISOString() };
        this.addEvent('info', `Cooldown: ${symbol} paused for ${this.config.cooldownCandles} candles (${this.config.cooldownCandles * 4}h)`);
      }

      delete this.state.positions[symbol];
      saveState(this.state);
    } catch (err) {
      this.addEvent('danger', `Exit failed for ${symbol}: ${err.message}`);
    }
  }

  // ─── HELPERS ────────────────────────────────────────────────

  addEvent(type, message) {
    this.state.events.unshift({ type, message, time: new Date().toISOString() });
    if (this.state.events.length > 50) this.state.events.pop();
    console.log(`[EXP2][${type.toUpperCase()}] ${message}`);
  }

  recordTrade(trade) {
    this.state.trades.unshift(trade);
    if (this.state.trades.length > 100) this.state.trades.pop();
    saveState(this.state);
  }

  getStatus() {
    const total = this.state.wins + this.state.losses;
    return {
      running: this.running,
      mode: this.config.mode,
      strategy: 'momentum-breakout',
      config: {
        positionSize: this.config.positionSize,
        maxPositions: this.config.maxPositions,
        trailingStopPct: this.config.trailingStopPct,
        hardStopPct: this.config.hardStopPct,
        takeProfitMultiple: this.config.takeProfitMultiple,
        maxHoldHours: this.config.maxHoldHours,
        scanInterval: this.config.scanInterval,
        minBalance: this.config.minBalance,
        cooldownCandles: this.config.cooldownCandles,
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
      cooldowns: this.state.cooldowns,
    };
  }
}

module.exports = new Experiment2Bot();
