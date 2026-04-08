// src/bot.js - Core trading bot engine
const fs = require('fs');
const path = require('path');
const alpaca = require('./alpaca');
const { evaluateSignal, evaluateHigherTimeframe } = require('./strategy');
const scalp = require('./scalpEngine');
const { recordScalpTrade, recordFeatureSnapshot, isCoinDisabled } = require('./scalpLog');
const sizer = require('./positionSizer');
const BenchmarkTracker = require('./benchmark');
const benchmark = new BenchmarkTracker();
const cryptoStream = require('./crypto-stream');
const { isBtcGateOpen, getMarketRegime, getDetailedRegime } = require('./btcGate');
const { evaluateBearEntry, setBearCooldown } = require('./bearStrategy');
const { recordTrade: recordPerfTrade, updateBalance } = require('./performance');

// Persistent state file (survives restarts)
const STATE_FILE = path.join(__dirname, '..', '.bot-state.json');

function loadPersistedState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch {}
  return {};
}

function savePersistedState(state) {
  try {
    // Convert Infinity to string for JSON serialization
    const serializablePositions = Object.fromEntries(
      Object.entries(state.positions || {}).map(([k, v]) => [k, {
        ...v,
        targetPrice: v.targetPrice === Infinity ? '__INF__' : v.targetPrice,
      }])
    );
    fs.writeFileSync(STATE_FILE, JSON.stringify({
      startValue: state.startValue,
      wins: state.wins,
      losses: state.losses,
      trades: state.trades,
      positions: serializablePositions,
    }, null, 2));
  } catch {}
}

// Alpaca crypto spread cost estimate per side (~0.15% each way)
const SPREAD_COST_PCT = 0.0015;

// ─── Strategy constants (tuned in code, not env vars) ────────
const MAX_CONCURRENT_POSITIONS = 3;
const DAILY_LOSS_LIMIT_PCT = 0.05;    // halt entries after -5% daily
const MAX_HOLD_HOURS = 24;            // swing max hold
const ENTRY_SCORE_THRESHOLD = 65;     // minimum score to enter

// Poll Alpaca for actual fill price (market orders usually fill within seconds)
async function getFillPrice(apiKey, secretKey, mode, orderId, fallbackPrice) {
  if (orderId === 'dry-run') return { price: fallbackPrice, status: 'dry-run' };
  for (let i = 0; i < 5; i++) {
    await new Promise(r => setTimeout(r, 1000));
    try {
      const order = await alpaca.getOrder(apiKey, secretKey, mode, orderId);
      if (order.filled_avg_price) return { price: parseFloat(order.filled_avg_price), status: 'filled' };
      if (order.status === 'filled' && order.filled_avg_price) {
        return { price: parseFloat(order.filled_avg_price), status: 'filled' };
      }
      if (order.status === 'canceled') return { price: fallbackPrice, status: 'canceled' };
      if (order.status === 'expired') return { price: fallbackPrice, status: 'expired' };
    } catch { break; }
  }
  return { price: fallbackPrice, status: 'unknown' };
}

class TradingBot {
  constructor() {
    this.running = false;
    this.config = {
      // Credentials from env (secrets only)
      apiKey: process.env.ALPACA_API_KEY || '',
      secretKey: process.env.ALPACA_SECRET_KEY || '',
      mode: process.env.ALPACA_MODE || 'paper',
      // Watchlists from env
      watchlist: (process.env.WATCHLIST || 'BTC/USD,ETH/USD,SOL/USD,DOGE/USD,AVAX/USD').split(','),
      bearWatchlist: process.env.WATCHLIST_BEAR
        ? process.env.WATCHLIST_BEAR.split(',')
        : null,
      // Strategy constants (tuned in code)
      stopLoss: 0.05,
      takeProfit: 0.15,
      rsiBuy: 35,
      rsiSell: 70,
      maxPositions: MAX_CONCURRENT_POSITIONS,
      dailyLossLimit: DAILY_LOSS_LIMIT_PCT,
      maxHoldHours: MAX_HOLD_HOURS,
      entryScoreThreshold: ENTRY_SCORE_THRESHOLD,
      profitGiveback: 0.25,
    };

    const saved = loadPersistedState();

    this.state = {
      portfolioValue: 0,
      cashBalance: 0,
      positions: Object.fromEntries(
        Object.entries(saved.positions || {}).map(([k, v]) => [k, {
          ...v,
          targetPrice: v.targetPrice === '__INF__' ? Infinity : v.targetPrice,
        }])
      ),
      signals: [],        // latest signals
      trades: [],         // populated from Alpaca activity history on start
      equityHistory: [],  // [{t, v}] for chart
      wins: 0,
      losses: 0,
      startValue: saved.startValue || 0,
      todayStartValue: 0,
      todayDate: null,        // tracks current date string for midnight reset
      startedAt: null,
      lastScan: null,
      lastBearSignal: null,
      events: [],         // system event log (last 50)
    };

    this.scanTimer = null;
    this.streamHandle = null;
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
      this.state.todayDate = new Date().toDateString();

      // Get all-time start value and equity curve from portfolio history
      try {
        const history = await alpaca.getPortfolioHistory(
          this.config.apiKey, this.config.secretKey, this.config.mode,
          { period: 'all', timeframe: '1D' }
        );
        if (history?.equity?.length > 0 && history?.timestamp?.length > 0) {
          // First non-zero equity value = account starting value
          const firstEquity = history.equity.find(v => v > 0);
          if (firstEquity) this.state.startValue = firstEquity;

          // Last daily equity = previous day's close (midnight baseline for today P&L)
          const lastDailyEquity = history.equity[history.equity.length - 1];
          if (lastDailyEquity > 0) {
            this.state.todayStartValue = lastDailyEquity;
          } else {
            this.state.todayStartValue = this.state.portfolioValue;
          }

          // Seed equity curve with historical data
          this.state.equityHistory = history.timestamp
            .map((ts, i) => ({ t: ts * 1000, v: history.equity[i] }))
            .filter(d => d.v > 0);
        } else {
          this.state.todayStartValue = this.state.portfolioValue;
        }
      } catch (err) {
        console.error('Portfolio history fetch failed:', err.message);
        this.state.startValue = this.state.startValue || this.state.portfolioValue;
        this.state.todayStartValue = this.state.portfolioValue;
      }
      savePersistedState(this.state);
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
        console.error('Benchmark initialization failed:', err.message);
      }

      // Connect WebSocket stream for real-time prices
      this.streamHandle = cryptoStream.connect(
        this.config.apiKey, this.config.secretKey, this.config.watchlist,
        (type, msg) => this.addEvent(type, `[Stream] ${msg}`)
      );

      this.running = true;
      this.addEvent('success', `Bot started in ${this.config.mode.toUpperCase()} mode`);
      this.addEvent('info', `Portfolio: $${this.state.portfolioValue.toFixed(2)}`);

      // Load trade history from Alpaca activities
      await this.syncTradeHistory();

      // Sync existing positions from Alpaca
      await this.syncPositions();

      // Start scan loop with adaptive interval
      this.runScan();
      this.scheduleNextScan();

      return { ok: true, msg: 'Bot started' };
    } catch (err) {
      return { ok: false, msg: `Connection failed: ${err.message}` };
    }
  }

  stop() {
    this.running = false;
    if (this.scanTimer) { clearTimeout(this.scanTimer); this.scanTimer = null; }
    if (this.streamHandle) { cryptoStream.disconnect(this.streamHandle); this.streamHandle = null; }
    this.addEvent('warning', 'Bot stopped by user');
    return { ok: true, msg: 'Bot stopped' };
  }

  // Adaptive scan interval: 15s when positions are open, 60s when idle
  scheduleNextScan() {
    if (!this.running) return;
    if (this.scanTimer) clearTimeout(this.scanTimer);
    const hasPositions = Object.keys(this.state.positions).length > 0;
    const interval = hasPositions ? 15000 : 60000;
    this.scanTimer = setTimeout(() => {
      this.runScan().then(() => this.scheduleNextScan());
    }, interval);
  }

  setCredentials(apiKey, secretKey, mode) {
    if (this.running) return { ok: false, msg: 'Stop bot before changing credentials' };
    this.config.apiKey = apiKey;
    this.config.secretKey = secretKey;
    if (mode) this.config.mode = mode;
    return { ok: true };
  }

  // ─── POSITION SYNC ──────────────────────────────────────────────

  async syncPositions() {
    try {
      const positions = await alpaca.getPositions(
        this.config.apiKey, this.config.secretKey, this.config.mode
      );

      // Fetch recent fill activities to get actual entry timestamps
      let fillsBySymbol = {};
      try {
        const fills = await alpaca.getActivities(
          this.config.apiKey, this.config.secretKey, this.config.mode, 'FILL'
        );
        // Build map of earliest BUY fill per symbol (most recent fills come first)
        for (const fill of fills) {
          if (fill.side === 'buy') {
            const sym = fill.symbol?.replace(/USD$/, '/USD');
            // Keep the earliest buy (last in desc order), so just overwrite
            fillsBySymbol[sym] = fill.transaction_time || fill.timestamp;
          }
        }
      } catch (err) {
        this.addEvent('warning', `Could not fetch activities: ${err.message}`);
      }

      // Track which symbols Alpaca reports
      const alpacaSymbols = new Set();

      for (const pos of positions) {
        // Alpaca returns symbol as "BTCUSD", convert to "BTC/USD"
        const raw = pos.symbol;
        const symbol = raw.length > 3 && !raw.includes('/')
          ? raw.replace(/USD$/, '/USD')
          : raw;
        alpacaSymbols.add(symbol);

        // Only add if not already tracked by the bot
        if (!this.state.positions[symbol]) {
          const entryPrice = parseFloat(pos.avg_entry_price);
          const qty = parseFloat(pos.qty);
          const notional = entryPrice * qty;

          this.state.positions[symbol] = {
            symbol,
            orderId: null,
            entryPrice,
            qty,
            notional,
            entryCost: notional * SPREAD_COST_PCT,
            entryTime: fillsBySymbol[symbol] || new Date().toISOString(),
            stopPrice: entryPrice * (1 - this.config.stopLoss),
            targetPrice: entryPrice * (1 + this.config.takeProfit),
            synced: true,
          };

          this.addEvent('info',
            `Synced position: ${symbol} | ${qty.toFixed(6)} @ $${entryPrice.toFixed(4)} | P&L: ${pos.unrealized_pl}`
          );
        } else {
          // Update qty from Alpaca in case of partial fills
          this.state.positions[symbol].qty = parseFloat(pos.qty);
          // Fix entry time from activities if it was previously set to bot start time
          if (fillsBySymbol[symbol] && this.state.positions[symbol].synced) {
            this.state.positions[symbol].entryTime = fillsBySymbol[symbol];
          }
        }
      }

      // Remove bot positions that no longer exist in Alpaca (closed externally)
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
      savePersistedState(this.state);
    } catch (err) {
      this.addEvent('warning', `Position sync failed: ${err.message}`);
    }
  }

  // ─── TRADE HISTORY SYNC ─────────────────────────────────────────

  async syncTradeHistory() {
    try {
      const fills = await alpaca.getActivities(
        this.config.apiKey, this.config.secretKey, this.config.mode, 'FILL', 100
      );
      if (!fills || fills.length === 0) return;

      // Build trades exclusively from Alpaca activity history
      const trades = [];
      for (const fill of fills) {
        const raw = fill.symbol || '';
        const symbol = raw.includes('/') ? raw : raw.replace(/USD$/, '/USD');
        const side = (fill.side || '').toUpperCase();
        const qty = parseFloat(fill.qty) || 0;
        const price = parseFloat(fill.price) || 0;
        const time = fill.transaction_time || fill.timestamp;
        const notional = qty * price;

        trades.push({ symbol, side, qty, price, notional, time, pnl: null });
      }

      // Sort oldest-first for P&L pairing
      trades.sort((a, b) => new Date(a.time) - new Date(b.time));

      // Pair sells with their preceding buys to compute P&L
      const buyMap = {}; // symbol -> most recent unmatched buy
      for (const trade of trades) {
        if (trade.side === 'BUY') {
          buyMap[trade.symbol] = trade;
        } else if (trade.side === 'SELL' && buyMap[trade.symbol]) {
          const buy = buyMap[trade.symbol];
          const pnl = (trade.price - buy.price) * trade.qty;
          trade.pnl = parseFloat(pnl.toFixed(4));
          delete buyMap[trade.symbol];
        }
      }

      // Store newest-first, cap at 100
      trades.reverse();
      this.state.trades = trades.slice(0, 100);

      // Compute wins/losses from closed trades
      let wins = 0, losses = 0;
      for (const t of this.state.trades) {
        if (t.pnl != null) {
          if (t.pnl > 0) wins++;
          else losses++;
        }
      }
      this.state.wins = wins;
      this.state.losses = losses;

      savePersistedState(this.state);
      this.addEvent('info', `Loaded ${trades.length} trades from account history`);
    } catch (err) {
      this.addEvent('warning', `Trade history sync failed: ${err.message}`);
    }
  }

  // ─── SCAN CYCLE ───────────────────────────────────────────────

  async runScan() {
    if (!this.running) return;
    this.state.lastScan = new Date().toISOString();

    // Determine regime first to select the right watchlist (cached, essentially free)
    const gate = await isBtcGateOpen(this.config.apiKey, this.config.secretKey, this.streamHandle);
    this._lastBtcPrice = gate.btcPrice; // Phase 3: used for bear rally BTC hard stop
    const isBear = !gate.open;
    const entryWatchlist = isBear && this.config.bearWatchlist
      ? this.config.bearWatchlist : this.config.watchlist;

    // Phase 1: log detailed regime at each scan (observation only)
    try {
      const detailed = await getDetailedRegime(this.config.apiKey, this.config.secretKey, this.streamHandle);
      console.log(`[MAIN][REGIME] ${detailed.label} | ADX ${detailed.signals.adx} RSI ${detailed.signals.rsi} F&G ${detailed.signals.fng} Gap ${detailed.signals.gapPct}%`);
      if (this._lastDetailedRegime && this._lastDetailedRegime !== detailed.state) {
        this.addEvent('info', `[REGIME] Transition: ${this._lastDetailedRegime} → ${detailed.state} (${detailed.label})`);
      }
      this._lastDetailedRegime = detailed.state;
      this._currentDetailedRegime = detailed; // Phase 2: full object for entry logic
    } catch (err) {
      console.log(`[MAIN][REGIME] fetch failed: ${err.message}`);
    }

    // Merge with open position symbols so exits are always monitored
    const openSymbols = Object.keys(this.state.positions);
    const scanWatchlist = [...new Set([...entryWatchlist, ...openSymbols])];
    this.state.activeWatchlist = entryWatchlist;

    const signals = [];

    // Batch fetch: get bars + prices for all symbols in 2 API calls instead of 2N
    let allBars, allPrices;
    try {
      [allBars, allPrices] = await Promise.all([
        alpaca.getCryptoBarsMulti(
          this.config.apiKey, this.config.secretKey,
          scanWatchlist, '1Min', 50, 6 * 60 * 60 * 1000  // 6h lookback for sparse coins
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

        const signal = evaluateSignal(symbol, bars, {
          rsiBuy: this.config.rsiBuy,
          rsiSell: this.config.rsiSell,
        });

        const livePrice = allPrices.get(sym) || 0;
        if (livePrice > 0) {
          signal.price = livePrice;
        }

        // Detect stale bars: flag as stale only if >2 hours old
        if (bars.length > 0) {
          const lastBarTime = new Date(bars[bars.length - 1].t).getTime();
          const barAgeMin = (Date.now() - lastBarTime) / 60000;
          signal.barAgeMin = Math.round(barAgeMin);
          signal.stale = barAgeMin > 120;

          // Enrich with bar data for bear strategy
          const lastBar = bars[bars.length - 1];
          signal.rsi14 = signal.rsi;
          signal.volume = lastBar.v;
          const volBars = bars.slice(-20);
          signal.avgVolume20 = volBars.reduce((a, b) => a + b.v, 0) / volBars.length;
          signal.open = lastBar.o;
          signal.high = lastBar.h;
          signal.low = lastBar.l;
          signal.close = lastBar.c;
          // 6h price change proxy (for bear rally coin check)
          signal.sixHourChange = bars.length > 1
            ? (signal.price - bars[0].c) / bars[0].c * 100
            : 0;
        }

        signals.push(signal);

        // Check exits for open positions using live price
        if (this.state.positions[symbol] && livePrice > 0) {
          this.state.positions[symbol].livePrice = livePrice;
          await this.checkExit(symbol, livePrice, bars);
        }
      } catch (err) {
        this.addEvent('danger', `Error scanning ${symbol}: ${err.message}`);
      }
    }

    // Sort by score descending
    signals.sort((a, b) => b.score - a.score);
    this.state.signals = signals;

    // Check daily loss circuit breaker
    const dailyLossPct = this.state.todayStartValue > 0
      ? (this.state.portfolioValue - this.state.todayStartValue) / this.state.todayStartValue
      : 0;
    if (dailyLossPct <= -this.config.dailyLossLimit) {
      this.addEvent('danger', `Daily loss limit hit (${(dailyLossPct * 100).toFixed(2)}%) — halting new entries`);
    } else {
      // BTC macro gate: skip entries if BTC is below 50-day SMA (reuse pre-fetched gate)
      if (!gate.open) {
        // Only log gate status on regime transitions
        if (this._lastGateOpen !== false) {
          this.addEvent('warning', `[BTC GATE] Closed — BTC $${gate.btcPrice} below 50-SMA $${gate.sma50} — switching to BEAR mode`);
          this._lastGateOpen = false;
        }

        const detailedState = this._currentDetailedRegime?.state;

        // FLAT: no directional edge — sit out entirely
        if (detailedState === 'FLAT') {
          // No entries; regime transition event already logged above

        // CAPITULATION: Main sits out — too volatile, no edge for momentum bot
        } else if (detailedState === 'CAPITULATION') {
          this.addEvent('info', '[MAIN][REGIME] Capitulation — sitting out. No entries during panic conditions.');

        // BEAR_RALLY: micro-strategy — 25% size, 5% TP, BTC hard stop, max 1 position
        } else if (detailedState === 'BEAR_RALLY') {
          const bearRallyPositions = Object.values(this.state.positions).filter(p => p.bearRally);
          if (bearRallyPositions.length === 0) {
            const entrySet = new Set(entryWatchlist);
            let openCount = Object.keys(this.state.positions).length;
            for (const candidate of signals) {
              if (openCount >= this.config.maxPositions) break;
              if (!entrySet.has(candidate.symbol)) continue;
              if (candidate.price <= 0 || candidate.stale) continue;
              if (this.state.positions[candidate.symbol]) continue;
              // Coin conditions: RSI 45–65, volume >2x, 6h gain >2%, BTC still >3% below SMA
              if (candidate.rsi < 45 || candidate.rsi > 65) continue;
              if ((candidate.volumeRatio || 0) < 2.0) continue;
              if ((candidate.sixHourChange || 0) < 2.0) continue;
              if ((this._currentDetailedRegime?.signals?.gapPct || -5) > -3) continue;
              const bearRallyConf = sizer.scoreBearRally({
                btcBounce: candidate.sixHourChange || 3,
                rsi: candidate.rsi,
                volumeRatio: candidate.volumeRatio || 2,
                fearGreed: this._currentDetailedRegime?.signals?.fng || 20,
              });
              const currentExposure = Object.values(this.state.positions).reduce((s, p) => s + (p.notional || 0), 0);
              const bearRallySize = sizer.calculateSize({
                confidence: bearRallyConf,
                portfolioValue: this.state.portfolioValue,
                cashBalance: this.state.cashBalance,
                currentExposure,
                atrPct: candidate.atrPct || 2,
                tradeType: 'bearRally',
              });
              if (bearRallySize.blocked) {
                this.addEvent('info', `[MAIN][BEAR_RALLY] Size blocked for ${candidate.symbol}: ${bearRallySize.reason}`);
                continue;
              }
              this.addEvent('info',
                `[MAIN][BEAR_RALLY] Micro-entry: ${candidate.symbol} | RSI ${candidate.rsi.toFixed(0)} Vol ×${(candidate.volumeRatio || 0).toFixed(1)} 6h +${(candidate.sixHourChange || 0).toFixed(1)}% | conf ${bearRallyConf} size ${bearRallySize.sizeLabel}`
              );
              await this.executeEntry(candidate, {
                dynamicNotional: bearRallySize.size,
                takeProfitPct: 0.015,
                regimeLabel: 'Bear Rally Scalp',
                bearRally: true,
                btcRallyHigh: gate.btcPrice,
                maxHoldMs: 25 * 60 * 1000,
              });
              openCount++;
              break; // Max 1 bear rally position
            }
          }

        // BEAR_EXHAUSTED: 50% size on range entries — reduced conviction
        // BEAR_TRENDING: full size range entries
        } else {
          const regime = await getMarketRegime(this.config.apiKey, this.config.secretKey, this.streamHandle);
          if (regime.regime === 'bear') {
            const bearSizeFactor = detailedState === 'BEAR_EXHAUSTED' ? 0.5 : 1.0;
            const entrySet = new Set(entryWatchlist);
            let openCount = Object.keys(this.state.positions).length;
            for (const candidate of signals) {
              if (openCount >= this.config.maxPositions) break;
              if (!entrySet.has(candidate.symbol)) continue;
              if (candidate.price <= 0) continue;
              if (this.state.positions[candidate.symbol]) continue;
              if (candidate.stale) continue;

              const bearSignal = await evaluateBearEntry(candidate, regime, candidate.symbol, {
                apiKey: this.config.apiKey,
                secretKey: this.config.secretKey,
              });
              if (bearSignal) {
                // Momentum bot: require green candle confirmation
                if (candidate.close <= candidate.open) {
                  this.addEvent('info', `[MAIN][BEAR] Skipping ${candidate.symbol} — candle not green`);
                  continue;
                }
                await this.executeBearEntry(bearSignal, candidate, { sizeFactor: bearSizeFactor });
                openCount++;
              }
            }
          }
        }
      } else {
      // Log regime transition to bull
      if (this._lastGateOpen !== true) {
        this.addEvent('success', `[BTC GATE] Open — BTC $${gate.btcPrice} above 50-SMA $${gate.sma50} — switching to BULL mode`);
        this._lastGateOpen = true;
      }

      // Phase 2: regime-aware entry sizing and thresholds
      const regime2 = this._currentDetailedRegime?.state;
      const isBullWeakening = regime2 === 'BULL_WEAKENING';
      const isBullPullback  = regime2 === 'BULL_PULLBACK';
      // BULL_PULLBACK: lower score threshold — be more aggressive on dips
      const effectiveThreshold = isBullPullback
        ? Math.max(55, this.config.entryScoreThreshold - 10)
        : this.config.entryScoreThreshold;
      // BULL_WEAKENING: 50% size, tighter stops
      const sizeFactor  = isBullWeakening ? 0.5 : 1.0;
      const tightStops  = isBullWeakening;
      const regimeLabel = this._currentDetailedRegime?.label;

      // Bull mode — SWING entry logic (only on bull watchlist coins)
      // Scalp positions do NOT count toward the swing position limit
      const bullEntrySet = new Set(entryWatchlist);
      let swingCount = Object.values(this.state.positions).filter(p => !p.scalpMode && !p.bearRally).length;
      for (const candidate of signals) {
        if (swingCount >= this.config.maxPositions) break;
        if (!bullEntrySet.has(candidate.symbol)) continue;
        if (candidate.score < effectiveThreshold || candidate.price <= 0) continue;
        if (candidate.stale) {
          this.addEvent('warning', `Skipping ${candidate.symbol} — bar data is ${candidate.barAgeMin}min stale`);
          continue;
        }

        // If a scalp is open on this coin, close it first before opening the swing
        const existingPos = this.state.positions[candidate.symbol];
        if (existingPos && existingPos.scalpMode) {
          this.addEvent('info', `Closing scalp on ${candidate.symbol} — swing entry triggered`);
          await this.executeExit(candidate.symbol, candidate.price, 'SCALP CLOSED FOR SWING UPGRADE');
        } else if (existingPos) {
          continue; // Non-scalp position already open on this coin
        }

        // Multi-timeframe confirmation: check 1h trend before entering
        try {
          const htfBars = await alpaca.getCryptoBars(
            this.config.apiKey, this.config.secretKey, candidate.symbol, '1Hour', 30
          );
          const htf = evaluateHigherTimeframe(htfBars);
          if (!htf.confirmed) {
            this.addEvent('info', `Skipping ${candidate.symbol} — HTF ${htf.bias} (${htf.reasons.join(', ')})`);
            continue;
          }
        } catch (err) {
          this.addEvent('warning', `HTF check failed for ${candidate.symbol}: ${err.message} — entering anyway`);
        }

        const htfOk = true; // passed HTF check above
        const swingConf = sizer.scoreSwing({ score: candidate.score, regime: regime2, htfConfirmed: htfOk });
        const currentExposure = Object.values(this.state.positions).reduce((s, p) => s + (p.notional || 0), 0);
        const swingSize = sizer.calculateSize({
          confidence: swingConf,
          portfolioValue: this.state.portfolioValue,
          cashBalance: this.state.cashBalance,
          currentExposure,
          atrPct: candidate.atrPct || 2,
          tradeType: 'swing',
        });
        if (swingSize.blocked) {
          this.addEvent('info', `[MAIN] Swing size blocked for ${candidate.symbol}: ${swingSize.reason}`);
          continue;
        }
        await this.executeEntry(candidate, { dynamicNotional: swingSize.size, tightStops, regimeLabel });
        swingCount++;
      }

      // Bull mode — SCALP entry logic (1-min SMA dip, parallel to swings)
      for (const candidate of signals) {
        if (!bullEntrySet.has(candidate.symbol)) continue;
        if (candidate.price <= 0 || candidate.stale) continue;
        if (this.state.positions[candidate.symbol]) continue;
        if (isCoinDisabled(candidate.symbol)) {
          console.log(`[MAIN][SCALP] Skipping ${candidate.symbol} — coin disabled (low win rate)`);
          continue;
        }

        const sym = candidate.symbol.includes('/') ? candidate.symbol : candidate.symbol.replace(/USD$/, '/USD');
        const minBars = allBars.get(sym) || [];
        if (minBars.length < scalp.DEFAULTS.smaPeriod) continue;

        const closes = minBars.map(b => b.c);
        const { sma: sma20, rsi: rsi14 } = scalp.computeIndicators(closes, candidate.price);
        const { shouldEnter, smaDip, spreadBlocked, expectedNet } = scalp.evalEntry(candidate.price, sma20, rsi14, { symbol: candidate.symbol });

        if (spreadBlocked) {
          console.log(`[MAIN][SCALP] Skipping ${candidate.symbol} — spread filter: expected net ${expectedNet}%`);
        } else if (shouldEnter) {
          const scalpConf = sizer.scoreScalp({ smaDipPct: parseFloat(smaDip), rsi: rsi14, expectedNetPct: parseFloat(expectedNet || '0') });
          const currentExposure = Object.values(this.state.positions).reduce((s, p) => s + (p.notional || 0), 0);
          const scalpSize = sizer.calculateSize({
            confidence: scalpConf,
            portfolioValue: this.state.portfolioValue,
            cashBalance: this.state.cashBalance,
            currentExposure,
            atrPct: candidate.atrPct || 2,
            tradeType: 'scalp',
          });
          if (scalpSize.blocked) continue;
          recordFeatureSnapshot({
            bot: 'main', coin: candidate.symbol, price: candidate.price,
            sma20, rsi14, smaDipPct: parseFloat(smaDip), expectedNetPct: parseFloat(expectedNet || '0'),
            regime: this._currentDetailedRegime?.state, regimeState: regimeLabel,
            fearGreed: this._currentDetailedRegime?.signals?.fng,
            btcPrice: gate.btcPrice, btcGateOpen: gate.open,
            volumeRatio: candidate.volumeRatio,
          });
          await this.executeScalpEntry(candidate, sma20, rsi14, smaDip, regimeLabel, scalpSize.size);
        }
      }
      }
    }

    // Sync positions with Alpaca (picks up external changes)
    await this.syncPositions();

    // Refresh account balance from Alpaca
    try {
      const account = await alpaca.getAccount(
        this.config.apiKey, this.config.secretKey, this.config.mode
      );
      this.state.portfolioValue = parseFloat(account.portfolio_value);
      this.state.cashBalance = parseFloat(account.cash);
      // Reset today P&L at midnight
      const currentDate = new Date().toDateString();
      if (this.state.todayDate && currentDate !== this.state.todayDate) {
        this.state.todayStartValue = this.state.portfolioValue;
        this.state.todayDate = currentDate;
        this.addEvent('info', `New day — today P&L reset at $${this.state.portfolioValue.toFixed(2)}`);
      }
      this.state.equityHistory.push({ t: Date.now(), v: this.state.portfolioValue });
      if (this.state.equityHistory.length > 2000) this.state.equityHistory.shift();

      // Update benchmarks with live prices from signals (already overridden with live prices)
      const currentPrices = {};
      for (const sig of this.state.signals) {
        if (sig.price > 0) currentPrices[sig.symbol] = sig.price;
      }
      benchmark.update(currentPrices);
      updateBalance('main', this.state.portfolioValue);
    } catch {}
  }

  // ─── ENTRY ────────────────────────────────────────────────────

  async executeEntry(signal, opts = {}) {
    const { symbol, price } = signal;
    const stopLossPct = opts.tightStops ? Math.min(this.config.stopLoss, 0.03) : this.config.stopLoss;
    const takeProfitPct = opts.takeProfitPct || this.config.takeProfit;
    // Use dynamic notional if provided, otherwise fall back to config-based sizing
    const notional = opts.dynamicNotional
      ? Math.min(opts.dynamicNotional, this.state.cashBalance)
      : Math.min(this.state.portfolioValue * this.config.positionSize * (opts.sizeFactor || 1.0), this.state.cashBalance);

    if (notional < 1) {
      this.addEvent('warning', `Skipping ${symbol} — insufficient cash ($${this.state.cashBalance.toFixed(2)})`);
      return;
    }

    try {
      const order = await alpaca.placeOrder(
        this.config.apiKey, this.config.secretKey, this.config.mode,
        { symbol, side: 'buy', notional }
      );

      // Get actual fill price from Alpaca instead of using signal price
      const fill = await getFillPrice(
        this.config.apiKey, this.config.secretKey, this.config.mode,
        order.id, price
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
        symbol,
        orderId: order.id,
        entryPrice: fillPrice,
        qty,
        notional,
        entryCost,
        entryTime: new Date().toISOString(),
        stopPrice: fillPrice * (1 - stopLossPct),
        targetPrice: fillPrice * (1 + takeProfitPct),
        ...(opts.bearRally && { bearRally: true, btcRallyHigh: opts.btcRallyHigh || this._lastBtcPrice || 0 }),
        ...(opts.maxHoldHours && { maxHoldHours: opts.maxHoldHours }),
        ...(opts.maxHoldMs && { maxHoldMs: opts.maxHoldMs }),
      };

      const regimeTag = opts.regimeLabel ? ` [${opts.regimeLabel}]` : '';
      const sizeLabel = sizeFactor < 1 ? `${(this.config.positionSize * sizeFactor * 100).toFixed(0)}%` : `${(this.config.positionSize * 100).toFixed(0)}%`;
      this.addEvent('success',
        `BUY ${symbol} @ $${fillPrice.toFixed(4)} | $${notional.toFixed(2)} (${sizeLabel} of portfolio)${regimeTag} | spread ~$${entryCost.toFixed(2)}`
      );

      this.recordTrade({
        symbol, side: 'BUY', qty, price: fillPrice, notional,
        time: new Date().toISOString(), pnl: null
      });

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

      this.state.positions[symbol] = {
        symbol, orderId: order.id, entryPrice: fillPrice, qty, notional, entryCost,
        entryTime: new Date().toISOString(),
        scalpMode: true,
      };

      const regimeTag = regimeLabel ? ` [${regimeLabel}]` : '';
      this.addEvent('success',
        `SCALP BUY ${symbol} @ $${fillPrice.toFixed(4)} | $${notional.toFixed(2)} | SMA $${sma20.toFixed(4)} | RSI ${rsi.toFixed(1)} | dip ${smaDip}%${regimeTag}`
      );
      this.recordTrade({ symbol, side: 'BUY', qty, price: fillPrice, notional, time: new Date().toISOString(), pnl: null });
    } catch (err) {
      this.addEvent('danger', `Scalp order failed for ${symbol}: ${err.message}`);
    }
  }

  // ─── BEAR ENTRY ─────────────────────────────────────────────

  async executeBearEntry(bearSignal, signal, opts = {}) {
    const { symbol, price } = signal;
    const sizeFactor = opts.sizeFactor || 1.0;
    const targetNotional = this.state.portfolioValue * this.config.positionSize * sizeFactor;
    const notional = Math.min(targetNotional, this.state.cashBalance);

    if (notional < 1) {
      this.addEvent('warning', `Skipping ${symbol} — insufficient cash ($${this.state.cashBalance.toFixed(2)})`);
      return;
    }

    try {
      const order = await alpaca.placeOrder(
        this.config.apiKey, this.config.secretKey, this.config.mode,
        { symbol, side: 'buy', notional }
      );

      const fill = await getFillPrice(
        this.config.apiKey, this.config.secretKey, this.config.mode,
        order.id, price
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

      this.state.positions[symbol] = {
        symbol,
        orderId: order.id,
        entryPrice: fillPrice,
        qty,
        notional,
        entryCost,
        entryTime: new Date().toISOString(),
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

      const sizeTag = sizeFactor < 1 ? ` [${(sizeFactor * 100).toFixed(0)}% size — ${this._currentDetailedRegime?.label || 'reduced'}]` : '';
      this.addEvent('success',
        `[MAIN][BEAR] Range entry on ${symbol} @ $${fillPrice.toFixed(4)} | $${notional.toFixed(2)} | TP $${bearSignal.takeProfitPrice.toFixed(2)} SL $${bearSignal.stopLossPrice.toFixed(2)}${sizeTag}`
      );

      this.recordTrade({
        symbol, side: 'BUY', qty, price: fillPrice, notional,
        time: new Date().toISOString(), pnl: null
      });

    } catch (err) {
      this.addEvent('danger', `Order failed for ${symbol}: ${err.message}`);
    }
  }

  // ─── EXIT ─────────────────────────────────────────────────────

  async checkExit(symbol, currentPrice, minuteBars) {
    const pos = this.state.positions[symbol];
    if (!pos) return;

    const holdMs = Date.now() - new Date(pos.entryTime).getTime();
    const pnlPct = ((currentPrice - pos.entryPrice) / pos.entryPrice * 100);
    const pnlTag = `P&L ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(3)}%`;

    // ── BEAR RALLY SCALP EXIT HIERARCHY ──────────────────────
    if (pos.bearRally) {
      const holdMin = (holdMs / 60000).toFixed(1);

      // (1) BTC hard stop — exit if BTC drops 3% from rally high (UNCHANGED)
      if (pos.btcRallyHigh > 0) {
        const btcNow = this._lastBtcPrice || 0;
        if (btcNow > pos.btcRallyHigh) pos.btcRallyHigh = btcNow;
        if (btcNow > 0 && btcNow <= pos.btcRallyHigh * 0.97) {
          await this.executeExit(symbol, currentPrice,
            `BEAR RALLY BTC DROP EXIT — BTC $${btcNow.toFixed(0)} dropped 3% from rally high $${pos.btcRallyHigh.toFixed(0)} | ${holdMin}min | ${pnlTag}`
          );
          return;
        }
      }

      // (2) SMA reversion — price returned to 20-period 1-min SMA
      if (minuteBars && minuteBars.length >= scalp.DEFAULTS.smaPeriod) {
        const closes = minuteBars.map(b => b.c);
        const { sma: sma20 } = scalp.computeIndicators(closes, currentPrice);
        if (currentPrice >= sma20) {
          await this.executeExit(symbol, currentPrice,
            `BEAR RALLY SMA REVERSION — price $${currentPrice.toFixed(4)} >= SMA $${sma20.toFixed(4)} | ${holdMin}min | ${pnlTag}`
          );
          return;
        }
      }

      // (3) TP hit — 1.5%
      if (currentPrice >= pos.targetPrice) {
        await this.executeExit(symbol, currentPrice,
          `BEAR RALLY TP HIT — price $${currentPrice.toFixed(4)} >= target $${pos.targetPrice.toFixed(4)} | ${holdMin}min | ${pnlTag}`
        );
        return;
      }

      // (4) Time exit — 25 minutes
      const maxHoldMs = pos.maxHoldMs || 25 * 60 * 1000;
      if (holdMs >= maxHoldMs) {
        await this.executeExit(symbol, currentPrice,
          `BEAR RALLY TIME EXIT — ${holdMin}min > ${(maxHoldMs / 60000).toFixed(0)}min max | ${pnlTag}`
        );
        return;
      }

      // (5) Stop loss — use position's stop price
      if (currentPrice <= pos.stopPrice) {
        await this.executeExit(symbol, currentPrice,
          `BEAR RALLY STOP LOSS — price $${currentPrice.toFixed(4)} <= stop $${pos.stopPrice.toFixed(4)} | ${holdMin}min | ${pnlTag}`
        );
        return;
      }

      return; // Bear rally positions only use the above exits
    }

    // ── BULL SCALP EXIT HIERARCHY ────────────────────────────
    if (pos.scalpMode) {
      if (minuteBars && minuteBars.length >= scalp.DEFAULTS.smaPeriod) {
        const closes = minuteBars.map(b => b.c);
        const { sma } = scalp.computeIndicators(closes, currentPrice);
        const exitResult = scalp.evalExit(pos, currentPrice, sma);
        if (exitResult) {
          await this.executeExit(symbol, currentPrice, exitResult.reason);
          return;
        }
      }
      return; // Scalp positions only use shared engine exits
    }

    // ── STANDARD EXIT LOGIC (swing + bear range positions) ───

    // Time-based exit
    const holdHours = holdMs / (1000 * 60 * 60);
    const maxHoldHours = pos.maxHoldHours || this.config.maxHoldHours;
    if (holdHours >= maxHoldHours) {
      await this.executeExit(symbol, currentPrice, `TIME EXIT (${Math.round(holdHours)}h)`);
      return;
    }

    // Track peak price for profit giveback calculation
    if (!pos.highPrice || currentPrice > pos.highPrice) {
      pos.highPrice = currentPrice;
    }

    // Profit giveback: if we've gained, sell when we lose X% of peak profit
    const peakPnl = (pos.highPrice - pos.entryPrice) / pos.entryPrice;
    const currentPnl = (currentPrice - pos.entryPrice) / pos.entryPrice;
    if (peakPnl > 0.01 && currentPnl > 0) {
      const givebackPct = 1 - (currentPnl / peakPnl);
      if (givebackPct >= this.config.profitGiveback) {
        await this.executeExit(symbol, currentPrice, `PROFIT PROTECT (peak +${(peakPnl * 100).toFixed(1)}% → +${(currentPnl * 100).toFixed(1)}%)`);
        return;
      }
    }

    const shouldStop = currentPrice <= pos.stopPrice;
    const shouldTakeProfit = currentPrice >= pos.targetPrice;

    if (shouldStop || shouldTakeProfit) {
      const reason = shouldTakeProfit ? 'TAKE PROFIT' : 'STOP LOSS';
      await this.executeExit(symbol, currentPrice, reason);
      if (pos.bearMode && shouldStop && !shouldTakeProfit) {
        setBearCooldown(symbol);
      }
    }
  }

  async executeExit(symbol, price, reason) {
    const pos = this.state.positions[symbol];
    if (!pos) return;

    try {
      const closeOrder = await alpaca.closePosition(
        this.config.apiKey, this.config.secretKey, this.config.mode, symbol
      );

      // Get actual fill price from the close order
      const exitFill = closeOrder?.id
        ? await getFillPrice(this.config.apiKey, this.config.secretKey, this.config.mode, closeOrder.id, price)
        : { price, status: 'direct' };
      const exitPrice = exitFill.price;

      if (exitFill.status === 'canceled' || exitFill.status === 'expired') {
        this.addEvent('danger', `Exit order ${exitFill.status} for ${symbol} — position may still be open`);
        return;
      }

      // P&L = price movement minus spread costs on both sides
      const exitCost = pos.notional * SPREAD_COST_PCT;
      const totalCost = (pos.entryCost || 0) + exitCost;
      const grossPnl = (exitPrice - pos.entryPrice) / pos.entryPrice * pos.notional;
      const pnl = grossPnl - totalCost;
      const isWin = pnl > 0;
      if (isWin) this.state.wins++; else this.state.losses++;

      this.addEvent(
        isWin ? 'success' : 'danger',
        `${reason}: ${symbol} @ $${exitPrice.toFixed(4)} | P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (fees ~$${totalCost.toFixed(2)})`
      );

      this.recordTrade({
        symbol, side: 'SELL', qty: pos.qty, price: exitPrice,
        notional: pos.notional, time: new Date().toISOString(),
        pnl: parseFloat(pnl.toFixed(4)), fees: parseFloat(totalCost.toFixed(4)), reason
      });

      // Record to performance tracker
      const pnlPct = (exitPrice - pos.entryPrice) / pos.entryPrice * 100;
      let perfExitReason = 'timeExit';
      if (reason.includes('TAKE PROFIT')) perfExitReason = 'takeProfit';
      else if (reason.includes('STOP LOSS')) perfExitReason = 'stopLoss';
      else if (reason.includes('PROFIT PROTECT')) perfExitReason = 'takeProfit';
      else if (reason.includes('TIME EXIT')) perfExitReason = 'timeExit';
      const exitTime = new Date().toISOString();
      recordPerfTrade({
        bot: 'main',
        coin: symbol,
        entryPrice: pos.entryPrice,
        exitPrice,
        entryTime: pos.entryTime,
        exitTime,
        pnlPct: parseFloat(pnlPct.toFixed(2)),
        pnlUsd: parseFloat(pnl.toFixed(2)),
        exitReason: perfExitReason,
        regime: pos.bearMode ? 'bear' : 'bull',
        type: pos.bearMode ? 'bear_range_trade' : 'momentum',
      });

      // Scalp trade log (bull scalps + bear rally scalps)
      if (pos.scalpMode || pos.bearRally) {
        recordScalpTrade({
          bot: 'main',
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

      delete this.state.positions[symbol];
      savePersistedState(this.state);

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
    savePersistedState(this.state);
  }

  computeRiskMetrics() {
    const closedTrades = this.state.trades.filter(t => t.pnl != null);
    const equity = this.state.equityHistory;

    // Profit Factor: gross wins / gross losses
    let grossWins = 0, grossLosses = 0;
    const wins = [], losses = [];
    for (const t of closedTrades) {
      if (t.pnl > 0) { grossWins += t.pnl; wins.push(t.pnl); }
      else if (t.pnl < 0) { grossLosses += Math.abs(t.pnl); losses.push(t.pnl); }
    }
    const profitFactor = grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? Infinity : 0;
    const avgWin = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;
    const avgWinLossRatio = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : avgWin > 0 ? Infinity : 0;

    // Win/Loss Streaks
    let curStreak = 0, curStreakType = null;
    let maxWinStreak = 0, maxLossStreak = 0;
    // Iterate oldest-first (trades are stored newest-first)
    for (let i = closedTrades.length - 1; i >= 0; i--) {
      const isWin = closedTrades[i].pnl > 0;
      const type = isWin ? 'win' : 'loss';
      if (type === curStreakType) { curStreak++; }
      else { curStreak = 1; curStreakType = type; }
      if (isWin && curStreak > maxWinStreak) maxWinStreak = curStreak;
      if (!isWin && curStreak > maxLossStreak) maxLossStreak = curStreak;
    }

    // Max Drawdown from equity history
    let maxDrawdown = 0, maxDrawdownPct = 0;
    let peak = 0;
    for (const pt of equity) {
      if (pt.v > peak) peak = pt.v;
      const dd = peak - pt.v;
      if (dd > maxDrawdown) {
        maxDrawdown = dd;
        maxDrawdownPct = peak > 0 ? (dd / peak) * 100 : 0;
      }
    }

    // Sharpe & Sortino from equity returns
    // Use period-over-period returns from equity history
    let sharpeRatio = null, sortinoRatio = null;
    if (equity.length >= 3) {
      const returns = [];
      for (let i = 1; i < equity.length; i++) {
        if (equity[i - 1].v > 0) {
          returns.push((equity[i].v - equity[i - 1].v) / equity[i - 1].v);
        }
      }
      if (returns.length >= 2) {
        const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + (r - meanReturn) ** 2, 0) / returns.length;
        const stdDev = Math.sqrt(variance);

        // Annualize: assume ~1440 data points per day (1-min scans), 365 days
        const intervalsPerYear = (365 * 24 * 3600 * 1000) /
          ((equity[equity.length - 1].t - equity[0].t) / (equity.length - 1) || 60000);
        const annualizedReturn = meanReturn * intervalsPerYear;
        const annualizedStd = stdDev * Math.sqrt(intervalsPerYear);
        const riskFreeRate = 0.05; // 5% annual

        sharpeRatio = annualizedStd > 0 ? (annualizedReturn - riskFreeRate) / annualizedStd : 0;

        // Sortino: only downside deviation
        const downsideReturns = returns.filter(r => r < 0);
        if (downsideReturns.length > 0) {
          const downsideVariance = downsideReturns.reduce((sum, r) => sum + r ** 2, 0) / returns.length;
          const downsideDev = Math.sqrt(downsideVariance) * Math.sqrt(intervalsPerYear);
          sortinoRatio = downsideDev > 0 ? (annualizedReturn - riskFreeRate) / downsideDev : 0;
        } else {
          sortinoRatio = annualizedReturn > riskFreeRate ? Infinity : 0;
        }
      }
    }

    return {
      profitFactor: isFinite(profitFactor) ? parseFloat(profitFactor.toFixed(2)) : null,
      avgWin: parseFloat(avgWin.toFixed(2)),
      avgLoss: parseFloat(avgLoss.toFixed(2)),
      avgWinLossRatio: isFinite(avgWinLossRatio) ? parseFloat(avgWinLossRatio.toFixed(2)) : null,
      maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
      maxDrawdownPct: parseFloat(maxDrawdownPct.toFixed(2)),
      sharpeRatio: sharpeRatio != null && isFinite(sharpeRatio) ? parseFloat(sharpeRatio.toFixed(2)) : null,
      sortinoRatio: sortinoRatio != null && isFinite(sortinoRatio) ? parseFloat(sortinoRatio.toFixed(2)) : null,
      currentStreak: curStreak,
      currentStreakType: curStreakType,
      maxWinStreak,
      maxLossStreak,
    };
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
        scanInterval: 'adaptive (15s/60s)',
        watchlist: this.config.watchlist,
        bearWatchlist: this.config.bearWatchlist || this.config.watchlist,
        activeWatchlist: this.state.activeWatchlist || this.config.watchlist,
        maxPositions: this.config.maxPositions,
        dailyLossLimit: this.config.dailyLossLimit,
        maxHoldHours: this.config.maxHoldHours,
        entryScoreThreshold: this.config.entryScoreThreshold,
        profitGiveback: this.config.profitGiveback,
        scalpTradeSize: this.config.scalpTradeSize,
      },
      portfolioValue: this.state.portfolioValue,
      cashBalance: this.state.cashBalance,
      startValue: this.state.startValue,
      todayStartValue: this.state.todayStartValue,
      positions: Object.fromEntries(
        Object.entries(this.state.positions).map(([k, v]) => [k, {
          ...v,
          targetPrice: v.targetPrice === Infinity ? 'TRAILING' : v.targetPrice,
        }])
      ),
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
      benchmarks: benchmark.getStatus(),
      riskMetrics: this.computeRiskMetrics(),
    };
  }
}

module.exports = new TradingBot();
