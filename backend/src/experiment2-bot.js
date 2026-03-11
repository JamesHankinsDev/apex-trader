// src/experiment2-bot.js - 20-Bar Momentum Breakout Experiment Bot
// Trend-following: buy breakouts above 20-bar high, trail stops on the way up
const fs = require('fs');
const path = require('path');
const alpaca = require('./alpaca');
const { evaluate } = require('./breakout-strategy');
const cryptoStream = require('./crypto-stream');
const { isBtcGateOpen, getMarketRegime } = require('./btcGate');
const { evaluateBearEntry2, addTranche, checkTrancheExit, clearTranches, getBtcAccumulationStatus } = require('./bearStrategy2');
const { recordTrade: recordPerfTrade, updateBalance } = require('./performance');

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
      bearWatchlist: process.env.EXPERIMENT_2_WATCHLIST_BEAR
        ? process.env.EXPERIMENT_2_WATCHLIST_BEAR.split(',')
        : null,
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
      lastBearSignal: null,
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

    // Determine regime first to select the right watchlist (cached, essentially free)
    const gate = await isBtcGateOpen(this.config.apiKey, this.config.secretKey, this.streamHandle);
    const isBear = !gate.open;
    const entryWatchlist = isBear && this.config.bearWatchlist
      ? this.config.bearWatchlist : this.config.watchlist;

    // Merge with open position symbols so exits are always monitored
    const openSymbols = Object.keys(this.state.positions);
    const scanWatchlist = [...new Set([...entryWatchlist, ...openSymbols])];
    this.state.activeWatchlist = entryWatchlist;

    const signals = [];

    // Batch fetch: get 4h bars + prices for all symbols in 2 API calls instead of 2N
    let allBars, allPrices;
    try {
      [allBars, allPrices] = await Promise.all([
        alpaca.getCryptoBarsMulti(
          this.config.apiKey, this.config.secretKey,
          scanWatchlist, '4Hour', 60, EIGHTY_BARS_4H_MS
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
        const bars = allBars.get(sym) || [];

        const livePrice = allPrices.get(sym) || 0;
        if (!livePrice || livePrice <= 0) continue;

        const signal = evaluate(symbol, bars, livePrice);

        // Enrich with bar data for bear strategy
        if (bars && bars.length > 0) {
          const lastBar = bars[bars.length - 1];
          signal.rsi14 = signal.rsi;
          signal.volume = lastBar.v;
          const volBars = bars.slice(-20);
          signal.avgVolume20 = volBars.reduce((a, b) => a + b.v, 0) / volBars.length;
          signal.open = lastBar.o;
          signal.high = lastBar.h;
          signal.low = lastBar.l;
          signal.close = lastBar.c;
        }

        signals.push(signal);

        // Check exits for open positions
        const pos = this.state.positions[symbol];
        if (pos) {
          pos.livePrice = livePrice;

          // Update high water mark and trailing stop (bull mode only)
          if (!pos.bearMode && livePrice > (pos.highWaterMark || pos.entryPrice)) {
            pos.highWaterMark = livePrice;
            pos.trailingStop = livePrice * (1 - this.config.trailingStopPct);
          }

          // Take profit
          if (livePrice >= pos.takeProfit) {
            await this.executeExit(symbol, livePrice, `TAKE PROFIT ($${livePrice.toFixed(2)} >= $${pos.takeProfit.toFixed(2)})`);
            // No cooldown on take profit for bear positions
            continue;
          }

          // Trailing stop (bull mode only — bear uses DCA tranche system)
          if (!pos.bearMode && livePrice <= pos.trailingStop) {
            await this.executeExit(symbol, livePrice, `TRAILING STOP ($${livePrice.toFixed(2)} <= $${pos.trailingStop.toFixed(2)})`, true);
            continue;
          }

          // Hard stop loss (bull mode only)
          if (!pos.bearMode && livePrice <= pos.hardStop) {
            await this.executeExit(symbol, livePrice, `HARD STOP ($${livePrice.toFixed(2)} <= $${pos.hardStop.toFixed(2)})`, true);
            continue;
          }

          // Time exit (bull mode only — bear tranches hold until gate reopens)
          const holdHours = (Date.now() - new Date(pos.entryTime).getTime()) / (1000 * 60 * 60);
          if (!pos.bearMode && holdHours >= this.config.maxHoldHours) {
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
      this.addEvent('warning', `[BTC GATE] Closed — BTC $${gate.btcPrice} below 50-SMA $${gate.sma50}`);

      // Bear mode: BTC DCA accumulation (only on bear watchlist coins)
      const regime = await getMarketRegime(this.config.apiKey, this.config.secretKey, this.streamHandle);
      if (regime.regime === 'bear') {
        // Get current BTC price
        const btcPrice = await alpaca.getLatestCryptoPrice(
          this.config.apiKey, this.config.secretKey, 'BTC/USD', this.streamHandle
        );
        if (btcPrice && btcPrice > 0) {
          // Check tranche exit conditions (emergency stop)
          const exitSignal = checkTrancheExit(btcPrice, false);
          if (exitSignal) {
            // Exit all BTC positions
            await this.exitAllBtcTranches(btcPrice, exitSignal.reason);
          } else {
            // Try to deploy a new tranche
            const accStatus = getBtcAccumulationStatus();
            const bearSignal = evaluateBearEntry2(regime, btcPrice, accStatus.trancheDetails || []);
            if (bearSignal) {
              await this.executeBtcTranche(btcPrice, bearSignal);
            }
          }
        }
      }
    } else {
      // Gate reopened — exit all BTC tranches if any exist
      const accStatus = getBtcAccumulationStatus();
      if (accStatus.active) {
        const btcPrice = await alpaca.getLatestCryptoPrice(
          this.config.apiKey, this.config.secretKey, 'BTC/USD', this.streamHandle
        );
        if (btcPrice && btcPrice > 0) {
          const exitSignal = checkTrancheExit(btcPrice, true);
          if (exitSignal) {
            await this.exitAllBtcTranches(btcPrice, exitSignal.reason);
          }
        }
      }

      // Bull mode — entry: only on bull watchlist coins, 1 position at a time
      const entrySet = new Set(entryWatchlist);
      const openCount = Object.keys(this.state.positions).length;
      if (openCount < this.config.maxPositions) {
        for (const sig of signals) {
          if (!entrySet.has(sig.symbol)) continue;
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
      updateBalance('exp2', this.state.portfolioValue);
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

  // ─── BTC DCA TRANCHE ENTRY ─────────────────────────────────

  async executeBtcTranche(btcPrice, bearSignal) {
    const symbol = 'BTC/USD';
    const trancheNotional = this.state.cashBalance * bearSignal.tranchePct;
    const notional = Math.min(trancheNotional, this.state.cashBalance);
    if (notional < 1) return;

    try {
      const order = await alpaca.placeOrder(
        this.config.apiKey, this.config.secretKey, this.config.mode,
        { symbol, side: 'buy', notional }
      );

      const fillPrice = await getFillPrice(
        this.config.apiKey, this.config.secretKey, this.config.mode, order.id, btcPrice
      );
      const entryCost = notional * SPREAD_COST_PCT;
      const qty = (notional - entryCost) / fillPrice;

      // Track tranche in bearStrategy2
      addTranche(fillPrice, notional);
      const accStatus = getBtcAccumulationStatus();

      // Track as a position (aggregate if BTC/USD already exists)
      const existing = this.state.positions[symbol];
      if (existing && existing.bearMode) {
        // Aggregate: update average entry price and totals
        const totalNotional = existing.notional + notional;
        const totalQty = existing.qty + qty;
        existing.entryPrice = (existing.entryPrice * existing.qty + fillPrice * qty) / totalQty;
        existing.qty = totalQty;
        existing.notional = totalNotional;
        existing.entryCost = (existing.entryCost || 0) + entryCost;
      } else {
        this.state.positions[symbol] = {
          symbol, orderId: order.id, entryPrice: fillPrice, qty, notional, entryCost,
          entryTime: new Date().toISOString(),
          highWaterMark: fillPrice,
          trailingStop: 0, // Not used for DCA — exit managed by tranche system
          hardStop: 0,
          takeProfit: Infinity,
          bearMode: true,
          bearType: 'btc_dca_accumulation',
        };
      }

      this.state.lastBearSignal = {
        coin: symbol,
        type: 'btc_dca_accumulation',
        tranche: accStatus.tranches,
        entryPrice: fillPrice,
        avgEntry: accStatus.avgEntry,
        totalAmount: accStatus.totalAmount,
        time: new Date().toISOString(),
      };

      this.addEvent('success',
        `[EXP2][BEAR] BTC tranche ${accStatus.tranches}/4 deployed at $${fillPrice.toFixed(2)} | $${notional.toFixed(2)}`
      );
      this.recordTrade({ symbol, side: 'BUY', qty, price: fillPrice, notional, time: new Date().toISOString(), pnl: null });
    } catch (err) {
      this.addEvent('danger', `BTC tranche order failed: ${err.message}`);
    }
  }

  // ─── BTC DCA TRANCHE EXIT ────────────────────────────────

  async exitAllBtcTranches(btcPrice, reason) {
    const symbol = 'BTC/USD';
    const pos = this.state.positions[symbol];
    if (!pos || !pos.bearMode) {
      clearTranches();
      return;
    }

    try {
      const closeOrder = await alpaca.closePosition(
        this.config.apiKey, this.config.secretKey, this.config.mode, symbol
      );
      const exitPrice = closeOrder?.id
        ? await getFillPrice(this.config.apiKey, this.config.secretKey, this.config.mode, closeOrder.id, btcPrice)
        : btcPrice;

      const exitCost = pos.notional * SPREAD_COST_PCT;
      const totalCost = (pos.entryCost || 0) + exitCost;
      const grossPnl = (exitPrice - pos.entryPrice) / pos.entryPrice * pos.notional;
      const pnl = grossPnl - totalCost;
      const isWin = pnl > 0;
      if (isWin) this.state.wins++; else this.state.losses++;

      const exitReason = reason === 'gateReopen' ? 'GATE REOPEN' : 'EMERGENCY STOP';
      this.addEvent(isWin ? 'success' : 'danger',
        `[EXP2][BEAR] ${exitReason}: BTC @ $${exitPrice.toFixed(2)} | Avg entry: $${pos.entryPrice.toFixed(2)} | P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`
      );
      this.recordTrade({
        symbol, side: 'SELL', qty: pos.qty, price: exitPrice, notional: pos.notional,
        time: new Date().toISOString(), pnl: parseFloat(pnl.toFixed(4)), reason: exitReason,
      });

      // Record to performance tracker
      const pnlPct = (exitPrice - pos.entryPrice) / pos.entryPrice * 100;
      recordPerfTrade({
        bot: 'exp2',
        coin: symbol,
        entryPrice: pos.entryPrice,
        exitPrice,
        entryTime: pos.entryTime,
        exitTime: new Date().toISOString(),
        pnlPct: parseFloat(pnlPct.toFixed(2)),
        pnlUsd: parseFloat(pnl.toFixed(2)),
        exitReason: reason === 'gateReopen' ? 'gateReopen' : 'stopLoss',
        regime: 'bear',
        type: 'btc_dca_accumulation',
      });

      delete this.state.positions[symbol];
      clearTranches();
      saveState(this.state);
    } catch (err) {
      this.addEvent('danger', `BTC tranche exit failed: ${err.message}`);
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

      // Record to performance tracker
      const pnlPct = (exitPrice - pos.entryPrice) / pos.entryPrice * 100;
      let perfExitReason = 'timeExit';
      if (reason.includes('TAKE PROFIT')) perfExitReason = 'takeProfit';
      else if (reason.includes('TRAILING STOP') || reason.includes('HARD STOP')) perfExitReason = 'stopLoss';
      else if (reason.includes('TIME EXIT')) perfExitReason = 'timeExit';
      recordPerfTrade({
        bot: 'exp2',
        coin: symbol,
        entryPrice: pos.entryPrice,
        exitPrice,
        entryTime: pos.entryTime,
        exitTime: new Date().toISOString(),
        pnlPct: parseFloat(pnlPct.toFixed(2)),
        pnlUsd: parseFloat(pnl.toFixed(2)),
        exitReason: perfExitReason,
        regime: pos.bearMode ? 'bear' : 'bull',
        type: pos.bearType || 'momentum_breakout',
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
      equityHistory: this.state.equityHistory.slice(-200),
      wins: this.state.wins,
      losses: this.state.losses,
      winRate: total > 0 ? Math.round((this.state.wins / total) * 100) : null,
      totalTrades: total,
      lastScan: this.state.lastScan,
      startedAt: this.state.startedAt,
      events: this.state.events,
      lastBearSignal: this.state.lastBearSignal,
      cooldowns: this.state.cooldowns,
      btcAccumulation: getBtcAccumulationStatus(),
    };
  }
}

module.exports = new Experiment2Bot();
