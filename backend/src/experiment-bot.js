// src/experiment-bot.js - Mean Reversion + Momentum Hybrid Experiment Bot
// Contrarian entry (buy dips) with momentum-aware exit (ride strength, bail on exhaustion)
const fs = require('fs');
const path = require('path');
const alpaca = require('./alpaca');
const { evaluate } = require('./mean-reversion-strategy');
const cryptoStream = require('./crypto-stream');
const { isBtcGateOpen, getMarketRegime, getDetailedRegime } = require('./btcGate');
const { evaluateBearEntry1 } = require('./bearStrategy1');
const { setBearCooldown } = require('./bearStrategy');
const { recordTrade: recordPerfTrade, updateBalance } = require('./performance');
const BenchmarkTracker = require('./benchmark');
const benchmark = new BenchmarkTracker();

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
  if (orderId === 'dry-run') return { price: fallbackPrice, status: 'dry-run' };
  for (let i = 0; i < 5; i++) {
    await new Promise(r => setTimeout(r, 1000));
    try {
      const order = await alpaca.getOrder(apiKey, secretKey, mode, orderId);
      if (order.filled_avg_price) return { price: parseFloat(order.filled_avg_price), status: 'filled' };
      if (order.status === 'canceled') return { price: fallbackPrice, status: 'canceled' };
      if (order.status === 'expired') return { price: fallbackPrice, status: 'expired' };
    } catch { break; }
  }
  return { price: fallbackPrice, status: 'unknown' };
}

class ExperimentBot {
  constructor() {
    this.running = false;
    this.config = {
      apiKey: process.env.EXPERIMENT_1_ALPACA_API_KEY || '',
      secretKey: process.env.EXPERIMENT_1_ALPACA_SECRET_KEY || '',
      mode: 'paper', // Always paper for experiments
      watchlist: (process.env.EXPERIMENT_1_WATCHLIST || 'BTC/USD,ETH/USD,SOL/USD').split(','),
      bearWatchlist: process.env.EXPERIMENT_1_WATCHLIST_BEAR
        ? process.env.EXPERIMENT_1_WATCHLIST_BEAR.split(',')
        : null,
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

      // Initialize benchmarks with 50-day lookback (aligns with 50-SMA gate)
      try {
        const apiKey = this.config.apiKey, secretKey = this.config.secretKey;
        await benchmark.initialize(
          this.state.startValue,
          this.config.watchlist,
          (sym, tf, limit, lookbackMs) => alpaca.getCryptoBars(apiKey, secretKey, sym, tf, limit, lookbackMs)
        );
      } catch (err) {
        console.error('Exp1 benchmark initialization failed:', err.message);
      }

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
          const pos = this.state.positions[symbol];
          const heldFor = pos.entryTime
            ? `held ${Math.round((Date.now() - new Date(pos.entryTime).getTime()) / 60000)}min`
            : 'unknown hold time';
          this.addEvent('warning',
            `Position ${symbol} removed externally — entry $${pos.entryPrice?.toFixed(4) || '?'} | $${pos.notional?.toFixed(2) || '?'} | ${heldFor} | order ${pos.orderId || 'n/a'}`
          );
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

    // Determine regime first to select the right watchlist (cached, essentially free)
    const gate = await isBtcGateOpen(this.config.apiKey, this.config.secretKey, this.streamHandle);
    const isBear = !gate.open;
    const entryWatchlist = isBear && this.config.bearWatchlist
      ? this.config.bearWatchlist : this.config.watchlist;

    // Phase 1: log detailed regime at each scan (observation only)
    try {
      const detailed = await getDetailedRegime(this.config.apiKey, this.config.secretKey, this.streamHandle);
      console.log(`[EXP1][REGIME] ${detailed.label} | ADX ${detailed.signals.adx} RSI ${detailed.signals.rsi} F&G ${detailed.signals.fng} Gap ${detailed.signals.gapPct}%`);
      if (this._lastDetailedRegime && this._lastDetailedRegime !== detailed.state) {
        this.addEvent('info', `[REGIME] Transition: ${this._lastDetailedRegime} → ${detailed.state} (${detailed.label})`);
      }
      this._lastDetailedRegime = detailed.state;
      this._currentDetailedRegime = detailed; // Phase 2: full object for entry logic
    } catch (err) {
      console.log(`[EXP1][REGIME] fetch failed: ${err.message}`);
    }

    // Merge with open position symbols so exits are always monitored
    const openSymbols = Object.keys(this.state.positions);
    const scanWatchlist = [...new Set([...entryWatchlist, ...openSymbols])];
    this.state.activeWatchlist = entryWatchlist;

    const signals = [];

    // Batch fetch: get hourly bars, minute bars, and prices in 3 API calls instead of 3N
    let allHourlyBars, allMinuteBars, allPrices;
    try {
      [allHourlyBars, allMinuteBars, allPrices] = await Promise.all([
        alpaca.getCryptoBarsMulti(
          this.config.apiKey, this.config.secretKey,
          scanWatchlist, '1Hour', 24, TWENTY_FOUR_HOURS_MS
        ),
        alpaca.getCryptoBarsMulti(
          this.config.apiKey, this.config.secretKey,
          scanWatchlist, '1Min', 10
        ),
        alpaca.getLatestCryptoPricesMulti(
          this.config.apiKey, this.config.secretKey,
          scanWatchlist, this.streamHandle
        ),
      ]);
    } catch (err) {
      this.addEvent('danger', `Batch fetch failed: ${err.message}`);
      return;
    }

    for (const symbol of scanWatchlist) {
      try {
        const sym = symbol.includes('/') ? symbol : symbol.replace(/USD$/, '/USD');
        const hourlyBars = allHourlyBars.get(sym) || [];
        const minuteBars = allMinuteBars.get(sym) || [];

        const livePrice = allPrices.get(sym) || 0;
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

          // Time exit (36h for bear dead cat, normal maxHoldHours for bull)
          const holdHours = (Date.now() - new Date(pos.entryTime).getTime()) / (1000 * 60 * 60);
          const maxHold = pos.bearMode ? 36 : this.config.maxHoldHours;
          if (holdHours >= maxHold) {
            await this.executeExit(symbol, livePrice, `TIME EXIT (${Math.round(holdHours)}h)`);
            continue;
          }
        }
      } catch (err) {
        this.addEvent('danger', `Error scanning ${symbol}: ${err.message}`);
      }
    }

    this.state.signals = signals;

    // BTC macro gate: skip entries if BTC is below 50-day SMA (reuse pre-fetched gate)
    if (!gate.open) {
      if (this._lastGateOpen !== false) {
        this.addEvent('warning', `[BTC GATE] Closed — BTC $${gate.btcPrice} below 50-SMA $${gate.sma50} — switching to BEAR mode`);
        this._lastGateOpen = false;
      }

      const detailedState = this._currentDetailedRegime?.state;
      const regimeLabel = this._currentDetailedRegime?.label;

      // FLAT: no edge
      if (detailedState === 'FLAT') {
        // sit out — no entries

      // BEAR_RALLY: Exp1 sits out — dead cat bounce needs exhaustion, not active rally
      } else if (detailedState === 'BEAR_RALLY') {
        this.addEvent('info', `[EXP1][REGIME] ${regimeLabel} — sitting out. Dead cat bounce needs exhaustion, not an active rally.`);

      // BEAR_EXHAUSTED: sit out — wait for higher conviction (5-condition dead cat setup)
      } else if (detailedState === 'BEAR_EXHAUSTED') {
        this.addEvent('info', `[EXP1][REGIME] ${regimeLabel} — sitting out. Waiting for all dead cat conditions to align.`);

      // CAPITULATION / BEAR_TRENDING: dead cat bounce entries — all conditions checked by evaluateBearEntry1
      } else {
        const regime = await getMarketRegime(this.config.apiKey, this.config.secretKey, this.streamHandle);
        if (regime.regime === 'bear') {
          const entrySet = new Set(entryWatchlist);
          let openCount = Object.keys(this.state.positions).length;
          for (const sig of signals) {
            if (openCount >= this.config.maxPositions) break;
            if (!entrySet.has(sig.symbol)) continue;
            if (this.state.positions[sig.symbol]) continue;

            const bearSignal = await evaluateBearEntry1(sig, regime, sig.symbol);
            if (bearSignal) {
              await this.executeBearEntry(bearSignal, sig);
              openCount++;
            }
          }
        }
      }
    } else {
      if (this._lastGateOpen !== true) {
        this.addEvent('success', `[BTC GATE] Open — BTC $${gate.btcPrice} above 50-SMA $${gate.sma50} — switching to BULL mode`);
        this._lastGateOpen = true;
      }

      // Phase 2: regime-aware entry logic
      const regime2 = this._currentDetailedRegime?.state;
      const regimeLabel = this._currentDetailedRegime?.label;

      // BULL_WEAKENING: Exp1 sits out — mean reversion needs momentum to work
      if (regime2 === 'BULL_WEAKENING') {
        this.addEvent('info', `[EXP1][REGIME] ${regimeLabel} — sitting out (no edge for mean reversion in weakening trend)`);
      } else {
        // Bull mode — buy dips (only on bull watchlist coins)
        // BULL_PULLBACK: normal behavior (mean reversion is already buy-the-dip)
        const entrySet = new Set(entryWatchlist);
        let openCount = Object.keys(this.state.positions).length;
        for (const sig of signals) {
          if (openCount >= this.config.maxPositions) break;
          if (!entrySet.has(sig.symbol)) continue;
          if (sig.signal !== 'buy') continue;
          if (this.state.positions[sig.symbol]) continue;

          await this.executeEntry(sig, { regimeLabel });
          openCount++;
        }
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
      if (this.state.equityHistory.length > 2000) this.state.equityHistory.shift();

      // Update benchmarks with live prices from signals
      const currentPrices = {};
      for (const sig of this.state.signals) {
        if (sig.price > 0) currentPrices[sig.symbol] = sig.price;
      }
      benchmark.update(currentPrices);
      updateBalance('exp1', this.state.portfolioValue);
    } catch {}
  }

  // ─── ENTRY ──────────────────────────────────────────────────

  async executeEntry(signal, opts = {}) {
    const { symbol, price } = signal;
    const targetNotional = this.state.portfolioValue * this.config.positionSize;
    const notional = Math.min(targetNotional, this.state.cashBalance);
    if (notional < 1) return;

    try {
      const order = await alpaca.placeOrder(
        this.config.apiKey, this.config.secretKey, this.config.mode,
        { symbol, side: 'buy', notional }
      );

      const fill = await getFillPrice(
        this.config.apiKey, this.config.secretKey, this.config.mode, order.id, price
      );

      if (fill.status === 'canceled' || fill.status === 'expired' || fill.status === 'dry-run') {
        this.addEvent('warning',
          `Order ${fill.status} for ${symbol} | attempted $${notional.toFixed(2)} @ ~$${price.toFixed(4)} — no position opened`
        );
        return;
      }
      if (fill.status === 'unknown') {
        this.addEvent('warning',
          `Order status unknown for ${symbol} (${order.id}) | attempted $${notional.toFixed(2)} — position may not have filled`
        );
      }

      const fillPrice = fill.price;
      const entryCost = notional * SPREAD_COST_PCT;
      const qty = (notional - entryCost) / fillPrice;

      this.state.positions[symbol] = {
        symbol, orderId: order.id, entryPrice: fillPrice, qty, notional, entryCost,
        entryTime: new Date().toISOString(),
        avg24h: signal.avg24h,
        deviation: signal.deviation,
      };

      const regimeTag = opts.regimeLabel ? ` [${opts.regimeLabel}]` : '';
      this.addEvent('success',
        `BUY ${symbol} @ $${fillPrice.toFixed(4)} | ${signal.deviation.toFixed(2)}% below avg | RSI ${signal.rsi} | ${signal.reasons.join(' · ')}${regimeTag}`
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

      const fill = await getFillPrice(
        this.config.apiKey, this.config.secretKey, this.config.mode, order.id, price
      );

      if (fill.status === 'canceled' || fill.status === 'expired' || fill.status === 'dry-run') {
        this.addEvent('warning',
          `[BEAR] Order ${fill.status} for ${symbol} | attempted $${notional.toFixed(2)} @ ~$${price.toFixed(4)} — no position opened`
        );
        return;
      }
      if (fill.status === 'unknown') {
        this.addEvent('warning',
          `[BEAR] Order status unknown for ${symbol} (${order.id}) | attempted $${notional.toFixed(2)} — position may not have filled`
        );
      }

      const fillPrice = fill.price;
      const entryCost = notional * SPREAD_COST_PCT;
      const qty = (notional - entryCost) / fillPrice;

      const stopPrice = fillPrice * (1 - bearSignal.stopLoss);
      const targetPrice = fillPrice * (1 + bearSignal.takeProfit);

      this.state.positions[symbol] = {
        symbol, orderId: order.id, entryPrice: fillPrice, qty, notional, entryCost,
        entryTime: new Date().toISOString(),
        avg24h: signal.avg24h,
        deviation: signal.deviation,
        stopPrice,
        targetPrice,
        bearMode: true,
        bearType: bearSignal.type,
      };

      this.state.lastBearSignal = {
        coin: symbol,
        type: bearSignal.type,
        entryPrice: fillPrice,
        tpPrice: targetPrice,
        slPrice: stopPrice,
        time: new Date().toISOString(),
      };

      this.addEvent('success',
        `[EXP1][BEAR] Dead cat entry on ${symbol} @ $${fillPrice.toFixed(4)} | $${notional.toFixed(2)} | TP $${targetPrice.toFixed(2)} SL $${stopPrice.toFixed(2)}`
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
      const exitFill = closeOrder?.id
        ? await getFillPrice(this.config.apiKey, this.config.secretKey, this.config.mode, closeOrder.id, price)
        : { price, status: 'direct' };
      const exitPrice = exitFill.price;

      if (exitFill.status === 'canceled' || exitFill.status === 'expired') {
        this.addEvent('danger', `Exit order ${exitFill.status} for ${symbol} — position may still be open`);
        return;
      }

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

      // Record to performance tracker
      const pnlPct = (exitPrice - pos.entryPrice) / pos.entryPrice * 100;
      let exitReason = 'timeExit';
      if (reason.includes('TAKE PROFIT') || reason.includes('BEAR TAKE PROFIT')) exitReason = 'takeProfit';
      else if (reason.includes('STOP LOSS') || reason.includes('BEAR STOP LOSS')) exitReason = 'stopLoss';
      else if (reason.includes('MOMENTUM EXIT') || reason.includes('exhaustion')) exitReason = 'exhaustion';
      else if (reason.includes('TIME EXIT')) exitReason = 'timeExit';
      recordPerfTrade({
        bot: 'exp1',
        coin: symbol,
        entryPrice: pos.entryPrice,
        exitPrice,
        entryTime: pos.entryTime,
        exitTime: new Date().toISOString(),
        pnlPct: parseFloat(pnlPct.toFixed(2)),
        pnlUsd: parseFloat(pnl.toFixed(2)),
        exitReason,
        regime: pos.bearMode ? 'bear' : 'bull',
        type: pos.bearType || 'mean_reversion',
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
        bearWatchlist: this.config.bearWatchlist || this.config.watchlist,
        activeWatchlist: this.state.activeWatchlist || this.config.watchlist,
      },
      portfolioValue: this.state.portfolioValue,
      cashBalance: this.state.cashBalance,
      startValue: this.state.startValue,
      todayStartValue: this.state.todayStartValue,
      positions: this.state.positions,
      signals: this.state.signals,
      trades: this.state.trades.slice(0, 50),
      equityHistory: this.state.equityHistory,
      wins: this.state.wins,
      losses: this.state.losses,
      winRate: total > 0 ? Math.round((this.state.wins / total) * 100) : null,
      totalTrades: total,
      lastScan: this.state.lastScan,
      startedAt: this.state.startedAt,
      lastBearSignal: this.state.lastBearSignal,
      events: this.state.events,
      benchmarks: benchmark.getStatus(),
    };
  }
}

module.exports = new ExperimentBot();
