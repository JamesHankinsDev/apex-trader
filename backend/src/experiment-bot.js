// src/experiment-bot.js - Mean Reversion + Momentum Hybrid Experiment Bot
// Contrarian entry (buy dips) with momentum-aware exit (ride strength, bail on exhaustion)
const fs = require('fs');
const path = require('path');
const alpaca = require('./alpaca');
const { evaluate } = require('./mean-reversion-strategy');
const cryptoStream = require('./crypto-stream');
const { isBtcGateOpen, getMarketRegime } = require('./btcGate');
const { evaluateBearEntry, setBearCooldown } = require('./bearStrategy');

const STATE_FILE = path.join(__dirname, '..', '.experiment-state.json');
const SPREAD_COST_PCT = 0.0015;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

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

class ExperimentBot {
  constructor() {
    this.running = false;
    this.config = {
      apiKey: process.env.EXPERIMENT_1_ALPACA_API_KEY || '',
      secretKey: process.env.EXPERIMENT_1_ALPACA_SECRET_KEY || '',
      mode: 'paper', // Always paper for experiments
      watchlist: (process.env.EXPERIMENT_1_WATCHLIST || 'BTC/USD,ETH/USD,SOL/USD').split(','),
      positionSize: parseFloat(process.env.EXPERIMENT_1_POSITION_SIZE) || 0.33,
      dipThreshold: parseFloat(process.env.EXPERIMENT_1_DIP_THRESHOLD) || 0.015,
      maxPositions: parseInt(process.env.EXPERIMENT_1_MAX_POSITIONS) || 2,
      scanInterval: parseInt(process.env.EXPERIMENT_1_SCAN_INTERVAL_SECONDS) || 30,
      maxHoldHours: parseInt(process.env.EXPERIMENT_1_MAX_HOLD_HOURS) || 4,
    };

    const saved = loadState();
    this.state = {
      portfolioValue: 0,
      cashBalance: 0,
      positions: saved.positions || {},
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
      lastBearSignal: null,
      events: [],
    };
    this.scanTimer = null;
    this.streamHandle = null;
  }

  // ─── LIFECYCLE ──────────────────────────────────────────────

  async start() {
    if (this.running) return { ok: false, msg: 'Experiment already running' };
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

      // Load trade history from Alpaca
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
      this.addEvent('success', 'Experiment started (Mean Reversion + Momentum Hybrid)');
      this.addEvent('info', `Portfolio: $${this.state.portfolioValue.toFixed(2)} | Dip threshold: ${(this.config.dipThreshold * 100).toFixed(1)}%`);

      this.runScan();
      this.scanTimer = setInterval(() => this.runScan(), this.config.scanInterval * 1000);

      return { ok: true, msg: 'Experiment started' };
    } catch (err) {
      return { ok: false, msg: `Connection failed: ${err.message}` };
    }
  }

  stop() {
    this.running = false;
    if (this.scanTimer) { clearInterval(this.scanTimer); this.scanTimer = null; }
    if (this.streamHandle) { cryptoStream.disconnect(this.streamHandle); this.streamHandle = null; }
    this.addEvent('warning', 'Experiment stopped');
    return { ok: true, msg: 'Experiment stopped' };
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
    const signals = [];

    for (const symbol of this.config.watchlist) {
      try {
        // Fetch 24h of 1-hour bars for average calculation
        const hourlyBars = await alpaca.getCryptoBars(
          this.config.apiKey, this.config.secretKey, symbol,
          '1Hour', 24, TWENTY_FOUR_HOURS_MS
        );

        // Fetch recent 1-min bars for momentum/trend detection
        const minuteBars = await alpaca.getCryptoBars(
          this.config.apiKey, this.config.secretKey, symbol,
          '1Min', 10
        );

        // Get live price — stream first, REST fallback
        const livePrice = await alpaca.getLatestCryptoPrice(
          this.config.apiKey, this.config.secretKey, symbol, this.streamHandle
        );
        if (!livePrice || livePrice <= 0) continue;

        const signal = evaluate(symbol, hourlyBars, livePrice, minuteBars, this.config.dipThreshold);

        // Enrich with bar data for bear strategy
        if (hourlyBars && hourlyBars.length > 0) {
          const lastBar = hourlyBars[hourlyBars.length - 1];
          signal.rsi14 = signal.rsi;
          signal.volume = lastBar.v;
          const volBars = hourlyBars.slice(-20);
          signal.avgVolume20 = volBars.reduce((a, b) => a + b.v, 0) / volBars.length;
          signal.open = lastBar.o;
          signal.high = lastBar.h;
          signal.low = lastBar.l;
          signal.close = lastBar.c;
        }

        signals.push(signal);

        const pos = this.state.positions[symbol];
        if (pos) {
          pos.livePrice = livePrice;
          pos.avg24h = signal.avg24h;
          pos.deviation = signal.deviation;
          pos.trend = signal.trend;
          pos.consecutiveDips = signal.consecutiveDips;
          pos.rsi = signal.rsi;
          pos.minuteROC = signal.minuteROC;
          pos.volumeFading = signal.volumeFading;

          // Bear mode: stop loss and take profit
          if (pos.bearMode && livePrice > 0) {
            if (livePrice <= pos.stopPrice) {
              await this.executeExit(symbol, livePrice, 'BEAR STOP LOSS');
              setBearCooldown(symbol);
              continue;
            }
            if (livePrice >= pos.targetPrice) {
              await this.executeExit(symbol, livePrice, 'BEAR TAKE PROFIT');
              // No cooldown on take profit — coin can be re-entered
              continue;
            }
          }

          // Exit: momentum exhaustion (multi-signal confirmation)
          if (signal.signal === 'sell') {
            await this.executeExit(symbol, livePrice, `MOMENTUM EXIT (+${signal.deviation.toFixed(2)}%, ${signal.consecutiveDips} dips, RSI ${signal.rsi})`);
            continue;
          }

          // Time exit
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

    // BTC macro gate: skip entries if BTC is below 50-day SMA
    const gate = await isBtcGateOpen(this.config.apiKey, this.config.secretKey, this.streamHandle);
    if (!gate.open) {
      this.addEvent('warning', `[BTC GATE] Closed — BTC $${gate.btcPrice} below 50-SMA $${gate.sma50}`);

      // Bear mode: try channel range trade entries
      const regime = await getMarketRegime(this.config.apiKey, this.config.secretKey, this.streamHandle);
      if (regime.regime === 'bear') {
        let openCount = Object.keys(this.state.positions).length;
        for (const sig of signals) {
          if (openCount >= this.config.maxPositions) break;
          if (this.state.positions[sig.symbol]) continue;

          const bearSignal = await evaluateBearEntry(sig, regime, sig.symbol, {
            rsiOverride: 35, // Mean reversion: deeper oversold requirement
            apiKey: this.config.apiKey,
            secretKey: this.config.secretKey,
          });
          if (bearSignal) {
            this.addEvent('info', '[EXP1][BEAR] Range entry — mean reversion confirmation');
            await this.executeBearEntry(bearSignal, sig);
            openCount++;
          }
        }
      }
    } else {
      // Bull mode — buy dips (unchanged)
      let openCount = Object.keys(this.state.positions).length;
      for (const sig of signals) {
        if (openCount >= this.config.maxPositions) break;
        if (sig.signal !== 'buy') continue;
        if (this.state.positions[sig.symbol]) continue;

        await this.executeEntry(sig);
        openCount++;
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
    const targetNotional = this.state.portfolioValue * this.config.positionSize;
    const notional = Math.min(targetNotional, this.state.cashBalance);
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

      this.state.positions[symbol] = {
        symbol, orderId: order.id, entryPrice: fillPrice, qty, notional, entryCost,
        entryTime: new Date().toISOString(),
        avg24h: signal.avg24h,
        deviation: signal.deviation,
      };

      this.addEvent('success',
        `BUY ${symbol} @ $${fillPrice.toFixed(4)} | ${signal.deviation.toFixed(2)}% below avg | RSI ${signal.rsi} | ${signal.reasons.join(' · ')}`
      );
      this.recordTrade({ symbol, side: 'BUY', qty, price: fillPrice, notional, time: new Date().toISOString(), pnl: null });
    } catch (err) {
      this.addEvent('danger', `Order failed for ${symbol}: ${err.message}`);
    }
  }

  // ─── BEAR ENTRY ─────────────────────────────────────────────

  async executeBearEntry(bearSignal, signal) {
    const { symbol, price } = signal;
    const targetNotional = this.state.portfolioValue * this.config.positionSize;
    const notional = Math.min(targetNotional, this.state.cashBalance);
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

      this.state.positions[symbol] = {
        symbol, orderId: order.id, entryPrice: fillPrice, qty, notional, entryCost,
        entryTime: new Date().toISOString(),
        avg24h: signal.avg24h,
        deviation: signal.deviation,
        stopPrice: bearSignal.stopLossPrice,
        targetPrice: bearSignal.takeProfitPrice,
        bearMode: true,
      };

      this.state.lastBearSignal = {
        coin: symbol,
        type: 'bear_range_trade',
        entryPrice: fillPrice,
        tpPrice: bearSignal.takeProfitPrice,
        channelSupport: bearSignal.channelSupport,
        channelResist: bearSignal.channelResist,
        channelWidth: bearSignal.channelWidth,
        rsi: bearSignal.rsi,
        volMultiple: bearSignal.volMultiple,
        time: new Date().toISOString(),
      };

      this.addEvent('success',
        `[EXP1][BEAR] Range entry on ${symbol} @ $${fillPrice.toFixed(4)} | $${notional.toFixed(2)} | TP $${bearSignal.takeProfitPrice.toFixed(2)} SL $${bearSignal.stopLossPrice.toFixed(2)}`
      );
      this.recordTrade({ symbol, side: 'BUY', qty, price: fillPrice, notional, time: new Date().toISOString(), pnl: null });
    } catch (err) {
      this.addEvent('danger', `Order failed for ${symbol}: ${err.message}`);
    }
  }

  // ─── EXIT ───────────────────────────────────────────────────

  async executeExit(symbol, price, reason) {
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
    console.log(`[EXPERIMENT][${type.toUpperCase()}] ${message}`);
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
      strategy: 'mean-reversion-momentum',
      config: {
        positionSize: this.config.positionSize,
        dipThreshold: this.config.dipThreshold,
        maxPositions: this.config.maxPositions,
        scanInterval: this.config.scanInterval,
        maxHoldHours: this.config.maxHoldHours,
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
      lastBearSignal: this.state.lastBearSignal,
      events: this.state.events,
    };
  }
}

module.exports = new ExperimentBot();
