// src/experiment2-bot.js - 20-Bar Momentum Breakout Experiment Bot
// Trend-following: buy breakouts above 20-bar high, trail stops on the way up
const fs = require('fs');
const path = require('path');
const alpaca = require('./alpaca');
const { evaluate } = require('./breakout-strategy');
const scalp = require('./scalpEngine');
const { evaluateHigherTimeframe } = require('./strategy');
const { recordScalpTrade, recordFeatureSnapshot, isCoinDisabled } = require('./scalpLog');
const sizer = require('./positionSizer');
const { computeRiskMetrics } = require('./riskMetrics');
const cryptoStream = require('./crypto-stream');
const { isBtcGateOpen, getMarketRegime, getDetailedRegime } = require('./btcGate');
const { evaluateBearEntry2, addTranche, checkTrancheExit, clearTranches, getBtcAccumulationStatus } = require('./bearStrategy2');
const { recordTrade: recordPerfTrade, updateBalance } = require('./performance');
const BenchmarkTracker = require('./benchmark');
const benchmark = new BenchmarkTracker();

const STATE_FILE = path.join(__dirname, '..', '.experiment2-state.json');
const SPREAD_COST_PCT = 0.0015;
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const EIGHTY_BARS_4H_MS = 80 * FOUR_HOURS_MS; // ~13 days for 50+ bars of 4h data

// Scalp config — bot-specific overrides (shared defaults come from scalpEngine)
const HIGH_PRIORITY_SCALP = new Set(['LINK/USD', 'AVAX/USD']); // most liquid alts
// All coins now use uniform RSI < 40 threshold from scalpEngine defaults
const BTC_SCALP_MIN_GAP_MS = 60 * 60 * 1000;  // next tranche must be >60min away
const TRANCHE_SPACING_MS = 12 * 60 * 60 * 1000; // 12h between tranches
const BREAKOUT_ENTRY_COOLDOWN_MS = 30 * 60 * 1000; // 30 min between breakout entries

// HTF cache: skip entries when 1h trend is bearish (5-min TTL per symbol)
const htfCache = new Map();
const HTF_CACHE_TTL = 5 * 60 * 1000;

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
      trades: state.trades,
      equityHistory: state.equityHistory,
      positions: state.positions,
      cooldowns: state.cooldowns,
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

class Experiment2Bot {
  constructor() {
    this.running = false;
    this.config = {
      // Credentials from env
      apiKey: process.env.EXP3_ALPACA_API_KEY || '',
      secretKey: process.env.EXP3_ALPACA_SECRET_KEY || '',
      mode: 'paper', // experiments always paper trade
      // Watchlists from env
      watchlist: (process.env.EXP3_WATCHLIST || 'AVAX/USD,LINK/USD,AAVE/USD,DOT/USD,UNI/USD').split(','),
      bearWatchlist: process.env.EXP3_WATCHLIST_BEAR
        ? process.env.EXP3_WATCHLIST_BEAR.split(',')
        : null,
      // Strategy constants (tuned in code)
      positionSize: 0.95,        // fallback if dynamic sizer not used
      maxPositions: 1,
      trailingStopPct: 0.15,
      hardStopPct: 0.20,
      takeProfitMultiple: 3,
      maxHoldHours: 72,
      minBalance: 15,
      cooldownCandles: 2,
      scalpTradeSize: 25,        // fallback if dynamic sizer not used
      minScalpBalance: 30,
    };

    const saved = loadState();
    this.state = {
      portfolioValue: 0,
      cashBalance: 0,
      positions: saved.positions || {},
      cooldowns: saved.cooldowns || {},  // symbol -> { until: ISO timestamp }
      signals: [],
      trades: saved.trades || [],
      equityHistory: saved.equityHistory || [],
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

      // Only rebuild from Alpaca if we have no persisted trades (fresh start).
      // Persisted trades have accurate net P&L; Alpaca rebuild uses gross P&L.
      if (this.state.trades.length === 0) {
        await this.syncTradeHistory();
      } else {
        let wins = 0, losses = 0;
        for (const t of this.state.trades) {
          if (t.pnl != null) { t.pnl > 0 ? wins++ : losses++; }
        }
        this.state.wins = wins;
        this.state.losses = losses;
      }
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
        console.error('Exp2 benchmark initialization failed:', err.message);
      }

      // Connect WebSocket stream for real-time prices
      this.streamHandle = cryptoStream.connect(
        this.config.apiKey, this.config.secretKey, this.config.watchlist,
        (type, msg) => this.addEvent(type, `[Stream] ${msg}`)
      );

      this.running = true;
      this.addEvent('success', 'Experiment 2 started (Momentum Breakout)');
      this.addEvent('info', `Portfolio: $${this.state.portfolioValue.toFixed(2)} | Trail: ${(this.config.trailingStopPct * 100)}% | Hard SL: ${(this.config.hardStopPct * 100)}%`);

      this.runScan();
      this.scheduleNextScan();

      return { ok: true, msg: 'Experiment 2 started' };
    } catch (err) {
      return { ok: false, msg: `Connection failed: ${err.message}` };
    }
  }

  stop() {
    this.running = false;
    if (this.scanTimer) { clearTimeout(this.scanTimer); this.scanTimer = null; }
    if (this.streamHandle) { cryptoStream.disconnect(this.streamHandle); this.streamHandle = null; }
    this.addEvent('warning', 'Experiment 2 stopped');
    return { ok: true, msg: 'Experiment 2 stopped' };
  }

  scheduleNextScan() {
    if (!this.running) return;
    if (this.scanTimer) clearTimeout(this.scanTimer);
    const hasPositions = Object.keys(this.state.positions).length > 0;
    const interval = hasPositions ? 15000 : 60000;
    this.scanTimer = setTimeout(() => {
      this.runScan().then(() => this.scheduleNextScan());
    }, interval);
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

    // Phase 1: log detailed regime at each scan (observation only)
    try {
      const detailed = await getDetailedRegime(this.config.apiKey, this.config.secretKey, this.streamHandle);
      console.log(`[EXP2][REGIME] ${detailed.label} | ADX ${detailed.signals.adx} RSI ${detailed.signals.rsi} F&G ${detailed.signals.fng} Gap ${detailed.signals.gapPct}%`);
      if (this._lastDetailedRegime && this._lastDetailedRegime !== detailed.state) {
        this.addEvent('info', `[REGIME] Transition: ${this._lastDetailedRegime} → ${detailed.state} (${detailed.label})`);
      }
      this._lastDetailedRegime = detailed.state;
      this._currentDetailedRegime = detailed; // Phase 2: full object for entry logic
    } catch (err) {
      console.log(`[EXP2][REGIME] fetch failed: ${err.message}`);
    }

    // Merge with open position symbols so exits are always monitored
    const openSymbols = Object.keys(this.state.positions);
    const scanWatchlist = [...new Set([...entryWatchlist, ...openSymbols])];
    this.state.activeWatchlist = entryWatchlist;

    const signals = [];

    // Batch fetch: get 4h bars + 1-min bars + prices
    let allBars, allMinBars, allPrices;
    try {
      [allBars, allMinBars, allPrices] = await Promise.all([
        alpaca.getCryptoBarsMulti(
          this.config.apiKey, this.config.secretKey,
          scanWatchlist, '4Hour', 60, EIGHTY_BARS_4H_MS
        ),
        scalp.fetchCandlesMulti(this.config.apiKey, this.config.secretKey, scanWatchlist),
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

          // ── SCALP EXIT HIERARCHY (first hit wins) ──
          if (pos.scalpMode) {
            const holdMs = Date.now() - new Date(pos.entryTime).getTime();
            const holdMin = (holdMs / 60000).toFixed(1);
            const pnlPct = ((livePrice - pos.entryPrice) / pos.entryPrice * 100);
            const pnlTag = `P&L ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(3)}%`;
            const minBars = allMinBars.get(sym) || [];
            const isBtcScalp = pos.btcScalp;
            const exitOpts = isBtcScalp
              ? { stopLoss: scalp.BTC_OVERRIDES.stopLoss, maxHoldMs: scalp.BTC_OVERRIDES.maxHoldMs, label: 'BTC SCALP' }
              : {};

            if (minBars.length >= scalp.DEFAULTS.smaPeriod) {
              const closes = minBars.map(b => b.c);
              const { sma } = scalp.computeIndicators(closes, livePrice);
              const exitResult = scalp.evalExit(pos, livePrice, sma, exitOpts);
              if (exitResult) {
                await this.executeExit(symbol, livePrice, exitResult.reason);
                continue;
              }
            }

            continue; // Scalps only use shared engine exits
          }

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
      if (this._lastGateOpen !== false) {
        this.addEvent('warning', `[BTC GATE] Closed — BTC $${gate.btcPrice} below 50-SMA $${gate.sma50} — switching to BEAR mode`);
        this._lastGateOpen = false;
      }

      const detailedState = this._currentDetailedRegime?.state;

      // FLAT: no directional edge — sit out
      // BEAR_RALLY: Exp2 stays in BTC accumulation mode, not spot rally trades
      if (detailedState === 'FLAT' || detailedState === 'BEAR_RALLY') {
        // sit out — no new tranches; hold existing positions

      // Bear mode: BTC DCA accumulation with regime-aware thresholds
      } else {
        const regime = await getMarketRegime(this.config.apiKey, this.config.secretKey, this.streamHandle);
        if (regime.regime === 'bear') {
          const btcPrice = await alpaca.getLatestCryptoPrice(
            this.config.apiKey, this.config.secretKey, 'BTC/USD', this.streamHandle
          );
          if (btcPrice && btcPrice > 0) {
            const exitSignal = checkTrancheExit(btcPrice, false);
            if (exitSignal) {
              // Close any open BTC scalp before emergency exit
              if (this.state.positions['BTC/USD']?.scalpMode) {
                this.addEvent('info', 'Closing BTC scalp — tranche emergency exit triggered');
                await this.executeExit('BTC/USD', btcPrice, 'BTC SCALP CLOSED FOR TRANCHE EXIT');
              }
              await this.exitAllBtcTranches(btcPrice, exitSignal.reason);
            } else {
              const accStatus = getBtcAccumulationStatus();
              const trancheOpts =
                detailedState === 'CAPITULATION'  ? { forceEntry: true } :
                detailedState === 'BEAR_EXHAUSTED' ? { firstDropPct: 0.03, subsequentDropPct: 0.02 } :
                {};
              const bearSignal = evaluateBearEntry2(regime, btcPrice, accStatus.trancheDetails || [], trancheOpts);
              if (bearSignal) {
                // Close any open BTC scalp before deploying tranche — DCA always takes priority
                if (this.state.positions['BTC/USD']?.scalpMode) {
                  this.addEvent('info', 'Closing BTC scalp — tranche deployment triggered');
                  await this.executeExit('BTC/USD', btcPrice, 'BTC SCALP CLOSED FOR TRANCHE');
                }
                await this.executeBtcTranche(btcPrice, bearSignal);
              } else {
                // ── BTC SCALP during inter-tranche gaps ──────────
                // Only scalp when: at least 1 tranche deployed AND next tranche >60min away
                const trancheCount = accStatus.tranches || 0;
                const lastTranche = accStatus.trancheDetails?.length > 0
                  ? accStatus.trancheDetails[accStatus.trancheDetails.length - 1]
                  : null;
                const timeSinceLastMs = lastTranche
                  ? Date.now() - new Date(lastTranche.timestamp).getTime()
                  : Infinity;
                const timeUntilNextMs = TRANCHE_SPACING_MS - timeSinceLastMs;
                const nextTrancheMin = Math.max(0, timeUntilNextMs / 60000);
                const nextTrancheH = Math.floor(nextTrancheMin / 60);
                const nextTrancheM = Math.round(nextTrancheMin % 60);
                const countdown = `next tranche in ${nextTrancheH}h ${nextTrancheM}m`;

                if (trancheCount >= 1 && timeUntilNextMs > BTC_SCALP_MIN_GAP_MS) {
                  if (!this.state.positions['BTC/USD'] && !isCoinDisabled('BTC/USD')) {
                    const guard = this.canOpenScalp('BTC/USD');
                    if (guard.allowed) {
                      const btcSym = 'BTC/USD';
                      const minBars = allMinBars.get(btcSym) || [];
                      if (minBars.length >= scalp.DEFAULTS.smaPeriod) {
                        const closes = minBars.map(b => b.c);
                        const { sma: sma20, rsi: rsi14 } = scalp.computeIndicators(closes, btcPrice);
                        const { shouldEnter, spreadBlocked, expectedNet } = scalp.evalEntry(btcPrice, sma20, rsi14, {
                          dipPct: scalp.BTC_OVERRIDES.dipPct,
                          rsiThreshold: scalp.BTC_OVERRIDES.rsiThreshold,
                          symbol: 'BTC/USD',
                        });

                        if (spreadBlocked) {
                          console.log(`[EXP2][SCALP] Skipping BTC — spread filter: expected net ${expectedNet}% | ${countdown}`);
                        } else if (shouldEnter) {
                          const smaDip = ((btcPrice - sma20) / sma20 * 100).toFixed(3);
                          const btcScalpConf = sizer.scoreScalp({ smaDipPct: parseFloat(smaDip), rsi: rsi14, rsiThreshold: scalp.BTC_OVERRIDES.rsiThreshold, expectedNetPct: parseFloat(expectedNet || '0') });
                          const currentExposure = Object.values(this.state.positions).reduce((s, p) => s + (p.notional || 0), 0);
                          const btcScalpSize = sizer.calculateSize({
                            confidence: btcScalpConf,
                            portfolioValue: this.state.portfolioValue,
                            cashBalance: this.state.cashBalance,
                            currentExposure,
                            tradeType: 'btcScalp',
                          });
                          if (!btcScalpSize.blocked) {
                            recordFeatureSnapshot({
                              bot: 'exp2', coin: 'BTC/USD', price: btcPrice,
                              sma20, rsi14, smaDipPct: parseFloat(smaDip), expectedNetPct: parseFloat(expectedNet || '0'),
                              regime: this._currentDetailedRegime?.state, regimeState: detailedState,
                              fearGreed: this._currentDetailedRegime?.signals?.fng,
                              btcPrice, btcGateOpen: false,
                              volumeRatio: null,
                            });
                            this.addEvent('info', `[EXP2][BEAR] BTC scalp opportunity | SMA $${sma20.toFixed(2)} RSI ${rsi14.toFixed(1)} dip ${smaDip}% | conf ${btcScalpConf} size ${btcScalpSize.sizeLabel} | ${countdown}`);
                            await this.executeBtcScalpEntry(btcPrice, sma20, rsi14, smaDip, countdown, btcScalpSize.size);
                          }
                        }
                      }
                    } else {
                      this.addEvent('info', `[EXP2] ${guard.reason} | ${countdown}`);
                    }
                  }
                }
              }
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

      if (this._lastGateOpen !== true) {
        this.addEvent('success', `[BTC GATE] Open — BTC $${gate.btcPrice} above 50-SMA $${gate.sma50} — switching to BULL mode`);
        this._lastGateOpen = true;
      }

      // Phase 2: regime-aware entry sizing
      const regime2 = this._currentDetailedRegime?.state;
      const regimeLabel = this._currentDetailedRegime?.label;
      // BULL_WEAKENING: 50% size — reduced conviction in fading trend
      // BULL_PULLBACK: full size — best risk/reward entry in bull cycle
      const sizeFactor = regime2 === 'BULL_WEAKENING' ? 0.5 : 1.0;

      // Bull mode — BREAKOUT entry: only on bull watchlist coins, 1 position at a time
      // Scalp positions don't count toward the breakout position limit
      const entrySet = new Set(entryWatchlist);
      const breakoutCount = Object.values(this.state.positions).filter(p => !p.scalpMode && !p.bearMode).length;
      if (breakoutCount < this.config.maxPositions) {
        for (const sig of signals) {
          if (!entrySet.has(sig.symbol)) continue;
          if (sig.signal !== 'buy') continue;

          // If a scalp is open on this coin, close it first for breakout upgrade
          const existingPos = this.state.positions[sig.symbol];
          if (existingPos && existingPos.scalpMode) {
            this.addEvent('info', `Closing scalp on ${sig.symbol} — breakout entry triggered`);
            await this.executeExit(sig.symbol, sig.price, 'SCALP CLOSED FOR BREAKOUT UPGRADE');
          } else if (existingPos) {
            continue; // Non-scalp position already open
          }

          // Check cooldown
          const cd = this.state.cooldowns[sig.symbol];
          if (cd && new Date(cd.until) > new Date()) {
            this.addEvent('info', `Skipping ${sig.symbol} — cooldown until ${new Date(cd.until).toLocaleTimeString()}`);
            continue;
          }

          // Breakout entry cooldown: don't stack entries within 30 min
          const lastBreakoutEntry = Object.values(this.state.positions)
            .filter(p => !p.scalpMode && !p.bearMode)
            .map(p => new Date(p.entryTime).getTime())
            .sort((a, b) => b - a)[0];
          if (lastBreakoutEntry && (Date.now() - lastBreakoutEntry) < BREAKOUT_ENTRY_COOLDOWN_MS) {
            this.addEvent('info', `Skipping ${sig.symbol} — breakout cooldown (${((BREAKOUT_ENTRY_COOLDOWN_MS - (Date.now() - lastBreakoutEntry)) / 60000).toFixed(0)}min remaining)`);
            break;
          }

          // HTF confirmation: skip breakout if 1h trend is bearish
          const cached = htfCache.get(sig.symbol);
          if (cached && (Date.now() - cached.fetchedAt) < HTF_CACHE_TTL) {
            if (!cached.confirmed) {
              this.addEvent('info', `Skipping ${sig.symbol} — HTF bearish (cached)`);
              continue;
            }
          } else {
            try {
              const htfBars = await alpaca.getCryptoBars(this.config.apiKey, this.config.secretKey, sig.symbol, '1Hour', 30);
              const htf = evaluateHigherTimeframe(htfBars);
              htfCache.set(sig.symbol, { confirmed: htf.confirmed, fetchedAt: Date.now() });
              if (!htf.confirmed) {
                this.addEvent('info', `Skipping ${sig.symbol} — HTF ${htf.bias}`);
                continue;
              }
            } catch {
              continue; // Fail-safe: skip entry if HTF check fails
            }
          }

          const breakoutConf = sizer.scoreBreakout({
            volumeRatio: sig.volumeRatio || 1.5,
            rsi: sig.rsi || 60,
            priceAboveHigh: sig.breakoutHigh > 0 ? ((sig.price - sig.breakoutHigh) / sig.breakoutHigh * 100) : 0,
            regime: regime2,
          });
          const currentExposure = Object.values(this.state.positions).reduce((s, p) => s + (p.notional || 0), 0);
          const breakoutSize = sizer.calculateSize({
            confidence: breakoutConf,
            portfolioValue: this.state.portfolioValue,
            cashBalance: this.state.cashBalance,
            currentExposure,
            tradeType: 'breakout',
          });
          if (breakoutSize.blocked) {
            this.addEvent('info', `[EXP2] Breakout size blocked for ${sig.symbol}: ${breakoutSize.reason}`);
            continue;
          }
          await this.executeEntry(sig, { dynamicNotional: breakoutSize.size, regimeLabel });
          break;
        }
      }

      // Bull mode — SCALP loop: pre-breakout scalps on watched coins
      for (const sig of signals) {
        if (!entrySet.has(sig.symbol)) continue;
        if (sig.price <= 0) continue;
        if (this.state.positions[sig.symbol]) continue;
        if (isCoinDisabled(sig.symbol)) {
          console.log(`[EXP2][SCALP] Skipping ${sig.symbol} — coin disabled (low win rate)`);
          continue;
        }

        const guard = this.canOpenScalp(sig.symbol);
        if (!guard.allowed) {
          this.addEvent('info', `[EXP2] ${guard.reason}`);
          continue;
        }

        const sym = sig.symbol.includes('/') ? sig.symbol : sig.symbol.replace(/USD$/, '/USD');
        const minBars = allMinBars.get(sym) || [];
        if (minBars.length < scalp.DEFAULTS.smaPeriod) continue;

        const closes = minBars.map(b => b.c);
        const { sma: sma20, rsi: rsi14 } = scalp.computeIndicators(closes, sig.price);
        const { shouldEnter, smaDip, spreadBlocked, expectedNet } = scalp.evalEntry(sig.price, sma20, rsi14, { symbol: sig.symbol });

        if (spreadBlocked) {
          console.log(`[EXP2][SCALP] Skipping ${sig.symbol} — spread filter: expected net ${expectedNet}%`);
        } else if (shouldEnter) {
          const scalpConf = sizer.scoreScalp({ smaDipPct: parseFloat(smaDip), rsi: rsi14, expectedNetPct: parseFloat(expectedNet || '0') });
          const currentExposure = Object.values(this.state.positions).reduce((s, p) => s + (p.notional || 0), 0);
          const scalpSize = sizer.calculateSize({
            confidence: scalpConf,
            portfolioValue: this.state.portfolioValue,
            cashBalance: this.state.cashBalance,
            currentExposure,
            tradeType: 'scalp',
          });
          if (scalpSize.blocked) continue;
          recordFeatureSnapshot({
            bot: 'exp2', coin: sig.symbol, price: sig.price,
            sma20, rsi14, smaDipPct: parseFloat(smaDip), expectedNetPct: parseFloat(expectedNet || '0'),
            regime: this._currentDetailedRegime?.state, regimeState: regimeLabel,
            fearGreed: this._currentDetailedRegime?.signals?.fng,
            btcPrice: gate.btcPrice, btcGateOpen: gate.open,
            volumeRatio: sig.volumeRatio,
          });
          await this.executeScalpEntry(sig, sma20, rsi14, smaDip, regimeLabel, scalpSize.size);
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
      updateBalance('exp2', this.state.portfolioValue);
    } catch {}
  }

  // ─── ENTRY ──────────────────────────────────────────────────

  async executeEntry(signal, opts = {}) {
    const { symbol, price } = signal;
    // Use dynamic sizing if provided, otherwise fall back to config
    const notional = opts.dynamicNotional
      ? Math.min(opts.dynamicNotional, this.state.cashBalance)
      : Math.min(this.state.portfolioValue * this.config.positionSize * (opts.sizeFactor || 1.0), this.state.cashBalance);
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

      const regimeTag = opts.regimeLabel ? ` [${opts.regimeLabel}]` : '';
      const sizeLabel = sizeFactor < 1 ? ` (${(this.config.positionSize * sizeFactor * 100).toFixed(0)}% size)` : '';
      this.addEvent('success',
        `BUY ${symbol} @ $${fillPrice.toFixed(4)} | ${signal.reasons.join(' · ')} | SL $${hardStop.toFixed(2)} | TP $${takeProfit.toFixed(2)}${sizeLabel}${regimeTag}`
      );
      this.recordTrade({ symbol, side: 'BUY', qty, price: fillPrice, notional, time: new Date().toISOString(), pnl: null, type: 'breakout' });
    } catch (err) {
      this.addEvent('danger', `Order failed for ${symbol}: ${err.message}`);
    }
  }

  // ─── SCALP ENTRY (BULL MODE) ────────────────────────────────

  async executeScalpEntry(signal, sma20, rsi, smaDip, regimeLabel, dynamicSize) {
    const { symbol, price } = signal;
    const notional = Math.min(dynamicSize || this.config.scalpTradeSize, this.state.cashBalance);
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
          `Scalp order ${fill.status} for ${symbol} | $${notional.toFixed(2)} @ ~$${price.toFixed(4)} — no position opened`
        );
        return;
      }

      const fillPrice = fill.price;
      const entryCost = notional * SPREAD_COST_PCT;
      const qty = (notional - entryCost) / fillPrice;
      const tier = HIGH_PRIORITY_SCALP.has(symbol) ? 'high-liq' : 'low-liq';

      this.state.positions[symbol] = {
        symbol, orderId: order.id, entryPrice: fillPrice, qty, notional, entryCost,
        entryTime: new Date().toISOString(),
        scalpMode: true,
      };

      const regimeTag = regimeLabel ? ` [${regimeLabel}]` : '';
      this.addEvent('success',
        `SCALP BUY ${symbol} @ $${fillPrice.toFixed(4)} | $${notional.toFixed(2)} | SMA $${sma20.toFixed(4)} | RSI ${rsi.toFixed(1)} | dip ${smaDip}% | ${tier}${regimeTag}`
      );
      this.recordTrade({ symbol, side: 'BUY', qty, price: fillPrice, notional, time: new Date().toISOString(), pnl: null, type: 'scalp' });
    } catch (err) {
      this.addEvent('danger', `Scalp order failed for ${symbol}: ${err.message}`);
    }
  }

  // ─── BTC SCALP ENTRY (BEAR MODE) ────────────────────────────

  async executeBtcScalpEntry(btcPrice, sma20, rsi, smaDip, countdown, dynamicSize) {
    const symbol = 'BTC/USD';
    const notional = Math.min(dynamicSize || this.config.scalpTradeSize / 2, this.state.cashBalance);
    if (notional < 1) return;

    try {
      const order = await alpaca.placeOrder(
        this.config.apiKey, this.config.secretKey, this.config.mode,
        { symbol, side: 'buy', notional }
      );

      const fill = await getFillPrice(
        this.config.apiKey, this.config.secretKey, this.config.mode, order.id, btcPrice
      );

      if (fill.status === 'canceled' || fill.status === 'expired' || fill.status === 'dry-run') {
        this.addEvent('warning',
          `BTC scalp order ${fill.status} | $${notional.toFixed(2)} @ ~$${btcPrice.toFixed(2)} — no position opened`
        );
        return;
      }

      const fillPrice = fill.price;
      const entryCost = notional * SPREAD_COST_PCT;
      const qty = (notional - entryCost) / fillPrice;

      this.state.positions[symbol] = {
        symbol, orderId: order.id, entryPrice: fillPrice, qty, notional, entryCost,
        entryTime: new Date().toISOString(),
        scalpMode: true,
        btcScalp: true,
      };

      this.addEvent('success',
        `BTC SCALP BUY @ $${fillPrice.toFixed(2)} | $${notional.toFixed(2)} | SMA $${sma20.toFixed(2)} | RSI ${rsi.toFixed(1)} | dip ${smaDip}% | ${countdown}`
      );
      this.recordTrade({ symbol, side: 'BUY', qty, price: fillPrice, notional, time: new Date().toISOString(), pnl: null, type: 'btc-scalp' });
    } catch (err) {
      this.addEvent('danger', `BTC scalp order failed: ${err.message}`);
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

      const fill = await getFillPrice(
        this.config.apiKey, this.config.secretKey, this.config.mode, order.id, btcPrice
      );

      if (fill.status === 'canceled' || fill.status === 'expired' || fill.status === 'dry-run') {
        this.addEvent('warning',
          `[BEAR] BTC tranche order ${fill.status} | attempted $${notional.toFixed(2)} @ ~$${btcPrice.toFixed(4)} — no tranche opened`
        );
        return;
      }
      if (fill.status === 'unknown') {
        this.addEvent('warning',
          `[BEAR] BTC tranche order status unknown (${order.id}) | attempted $${notional.toFixed(2)} — tranche may not have filled`
        );
      }

      const fillPrice = fill.price;
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
      this.recordTrade({ symbol, side: 'BUY', qty, price: fillPrice, notional, time: new Date().toISOString(), pnl: null, type: 'btc-dca' });
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
      const exitFill = closeOrder?.id
        ? await getFillPrice(this.config.apiKey, this.config.secretKey, this.config.mode, closeOrder.id, btcPrice)
        : { price: btcPrice, status: 'direct' };
      const exitPrice = exitFill.price;

      if (exitFill.status === 'canceled' || exitFill.status === 'expired') {
        this.addEvent('danger', `BTC tranche exit order ${exitFill.status} — position may still be open`);
        return;
      }

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
        type: 'btc-dca',
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
      const posType = pos.btcScalp ? 'btc-scalp'
        : pos.scalpMode ? 'scalp'
        : pos.bearMode ? 'btc-dca'
        : 'breakout';
      this.recordTrade({
        symbol, side: 'SELL', qty: pos.qty, price: exitPrice, notional: pos.notional,
        time: new Date().toISOString(), pnl: parseFloat(pnl.toFixed(4)), reason,
        type: posType,
      });

      // Record to performance tracker
      const pnlPct = (exitPrice - pos.entryPrice) / pos.entryPrice * 100;
      let perfExitReason = 'timeExit';
      if (reason.includes('TAKE PROFIT')) perfExitReason = 'takeProfit';
      else if (reason.includes('TRAILING STOP') || reason.includes('HARD STOP')) perfExitReason = 'stopLoss';
      else if (reason.includes('TIME EXIT')) perfExitReason = 'timeExit';
      const exitTime = new Date().toISOString();
      recordPerfTrade({
        bot: 'exp2',
        coin: symbol,
        entryPrice: pos.entryPrice,
        exitPrice,
        entryTime: pos.entryTime,
        exitTime,
        pnlPct: parseFloat(pnlPct.toFixed(2)),
        pnlUsd: parseFloat(pnl.toFixed(2)),
        exitReason: perfExitReason,
        regime: pos.bearMode ? 'bear' : 'bull',
        type: pos.bearType || 'momentum_breakout',
      });

      // Scalp trade log
      if (pos.scalpMode) {
        recordScalpTrade({
          bot: 'exp2',
          coin: symbol,
          entryPrice: pos.entryPrice,
          exitPrice,
          entryTime: pos.entryTime,
          exitTime,
          pnlUsd: parseFloat(pnl.toFixed(2)),
          pnlPct: parseFloat(pnlPct.toFixed(2)),
          exitReason: perfExitReason,
          smaAtEntry: pos.sma20 || 0,
          rsiAtEntry: pos.rsi || 0,
          notional: pos.notional,
        });
      }

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

  // ─── SCALP GUARD HELPERS ─────────────────────────────────────

  /**
   * Returns the available balance for scalp entries.
   * = current cash balance minus notional of any open/pending positions.
   */
  getAvailableScalpBalance() {
    const reservedNotional = Object.values(this.state.positions)
      .reduce((sum, p) => sum + (p.notional || 0), 0);
    return Math.max(0, this.state.cashBalance - reservedNotional);
  }

  /**
   * Returns true if a breakout swing position is currently open.
   * Breakout positions are non-bearMode, non-scalpMode positions.
   */
  isBreakoutPositionOpen() {
    return Object.values(this.state.positions)
      .some(p => !p.bearMode && !p.scalpMode);
  }

  /**
   * Checks whether a scalp entry is allowed for a given symbol.
   * Returns { allowed: true } or { allowed: false, reason: string }.
   */
  canOpenScalp(symbol) {
    // Block if available balance is below minimum
    const available = this.getAvailableScalpBalance();
    if (available < this.config.minScalpBalance) {
      return { allowed: false, reason: `scalp blocked: insufficient balance ($${available.toFixed(2)} < $${this.config.minScalpBalance})` };
    }

    // Block if a breakout position is open on this coin
    const pos = this.state.positions[symbol];
    if (pos && !pos.bearMode && !pos.scalpMode) {
      return { allowed: false, reason: `scalp blocked: breakout position active on ${symbol}` };
    }

    return { allowed: true };
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
        scanInterval: 'adaptive (15s/60s)',
        minBalance: this.config.minBalance,
        cooldownCandles: this.config.cooldownCandles,
        scalpTradeSize: this.config.scalpTradeSize,
        minScalpBalance: this.config.minScalpBalance,
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
      events: this.state.events,
      lastBearSignal: this.state.lastBearSignal,
      cooldowns: this.state.cooldowns,
      btcAccumulation: getBtcAccumulationStatus(),
      benchmarks: benchmark.getStatus(),
      riskMetrics: computeRiskMetrics(this.state.trades, this.state.equityHistory),
    };
  }
}

module.exports = new Experiment2Bot();
