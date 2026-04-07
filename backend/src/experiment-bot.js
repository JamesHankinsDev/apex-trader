// src/experiment-bot.js - 1-Minute Scalp Bot (Bull) + Dead Cat Bounce (Bear)
// Bull: buys when price dips below 20-bar SMA on 1-min candles, exits on SMA revert / SL / time
// Bear: 5-condition dead cat bounce (unchanged)
const fs = require('fs');
const path = require('path');
const alpaca = require('./alpaca');
const cryptoStream = require('./crypto-stream');
const { isBtcGateOpen, getMarketRegime, getDetailedRegime } = require('./btcGate');
const { evaluateBearEntry1 } = require('./bearStrategy1');
const { setBearCooldown } = require('./bearStrategy');
const { recordTrade: recordPerfTrade, updateBalance } = require('./performance');
const scalp = require('./scalpEngine');
const { recordScalpTrade, recordFeatureSnapshot, isCoinDisabled } = require('./scalpLog');
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
      mode: 'paper',
      watchlist: (process.env.EXPERIMENT_1_WATCHLIST || 'BTC/USD,ETH/USD,SOL/USD').split(','),
      bearWatchlist: process.env.EXPERIMENT_1_WATCHLIST_BEAR
        ? process.env.EXPERIMENT_1_WATCHLIST_BEAR.split(',')
        : null,
      scalpTradeSize: parseFloat(process.env.SCALP_TRADE_SIZE) || 25,
      maxPositions: parseInt(process.env.EXPERIMENT_1_MAX_POSITIONS) || 2,
      scanInterval: parseInt(process.env.EXPERIMENT_1_SCAN_INTERVAL_SECONDS) || 30,
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

      await this.syncTradeHistory();
      await this.syncPositions();

      saveState(this.state);
      this.state.startedAt = new Date().toISOString();
      this.state.equityHistory.push({ t: Date.now(), v: this.state.portfolioValue });

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

      this.streamHandle = cryptoStream.connect(
        this.config.apiKey, this.config.secretKey, this.config.watchlist,
        (type, msg) => this.addEvent(type, `[Stream] ${msg}`)
      );

      this.running = true;
      this.addEvent('success', 'Experiment started (1-Min Scalp + Dead Cat Bounce)');
      this.addEvent('info', `Portfolio: $${this.state.portfolioValue.toFixed(2)} | Scalp size: $${this.config.scalpTradeSize}`);

      this.runScan();
      this.scheduleNextScan();

      return { ok: true, msg: 'Experiment started' };
    } catch (err) {
      return { ok: false, msg: `Connection failed: ${err.message}` };
    }
  }

  stop() {
    this.running = false;
    if (this.scanTimer) { clearTimeout(this.scanTimer); this.scanTimer = null; }
    if (this.streamHandle) { cryptoStream.disconnect(this.streamHandle); this.streamHandle = null; }
    this.addEvent('warning', 'Experiment stopped');
    return { ok: true, msg: 'Experiment stopped' };
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

    const gate = await isBtcGateOpen(this.config.apiKey, this.config.secretKey, this.streamHandle);
    const isBear = !gate.open;
    const entryWatchlist = isBear && this.config.bearWatchlist
      ? this.config.bearWatchlist : this.config.watchlist;

    // Log detailed regime
    try {
      const detailed = await getDetailedRegime(this.config.apiKey, this.config.secretKey, this.streamHandle);
      console.log(`[EXP1][REGIME] ${detailed.label} | ADX ${detailed.signals.adx} RSI ${detailed.signals.rsi} F&G ${detailed.signals.fng} Gap ${detailed.signals.gapPct}%`);
      if (this._lastDetailedRegime && this._lastDetailedRegime !== detailed.state) {
        this.addEvent('info', `[REGIME] Transition: ${this._lastDetailedRegime} → ${detailed.state} (${detailed.label})`);
      }
      this._lastDetailedRegime = detailed.state;
      this._currentDetailedRegime = detailed;
    } catch (err) {
      console.log(`[EXP1][REGIME] fetch failed: ${err.message}`);
    }

    // Merge open positions into watchlist so exits are always monitored
    const openSymbols = Object.keys(this.state.positions);
    const scanWatchlist = [...new Set([...entryWatchlist, ...openSymbols])];
    this.state.activeWatchlist = entryWatchlist;

    const signals = [];

    // Fetch 1-min bars (20 bars for SMA) + hourly bars (for bear strategy) + live prices
    let allMinuteBars, allHourlyBars, allPrices;
    try {
      [allMinuteBars, allHourlyBars, allPrices] = await Promise.all([
        scalp.fetchCandlesMulti(this.config.apiKey, this.config.secretKey, scanWatchlist),
        // Hourly bars still needed for bear mode enrichment
        alpaca.getCryptoBarsMulti(
          this.config.apiKey, this.config.secretKey,
          scanWatchlist, '1Hour', 24, TWENTY_FOUR_HOURS_MS
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
        const minuteBars = allMinuteBars.get(sym) || [];
        const hourlyBars = allHourlyBars.get(sym) || [];

        const livePrice = allPrices.get(sym) || 0;
        if (!livePrice || livePrice <= 0) continue;

        // ── Compute scalp indicators from 1-min bars ──
        const closes = minuteBars.map(b => b.c);
        const { sma: sma20, rsi: rsi14 } = scalp.computeIndicators(closes, livePrice);
        const { shouldEnter: belowSmaAndRsi, spreadBlocked } = scalp.evalEntry(livePrice, sma20, rsi14, { symbol });
        if (spreadBlocked) console.log(`[EXP1][SCALP] Skipping ${symbol} — spread filter`);
        const belowSma = livePrice < sma20 * (1 - scalp.DEFAULTS.dipPct);

        // Volume of the most recent 1-min bar (used for fade detection)
        const entryCandle = minuteBars.length > 0 ? minuteBars[minuteBars.length - 1] : null;
        const entryVolume = entryCandle ? entryCandle.v : 0;

        const signal = {
          symbol,
          price: livePrice,
          sma20: parseFloat(sma20.toFixed(4)),
          rsi: parseFloat(rsi14.toFixed(1)),
          belowSma,
          smaDip: parseFloat(((livePrice - sma20) / sma20 * 100).toFixed(3)),
          signal: belowSmaAndRsi ? 'buy' : 'hold',
          entryVolume,
          reasons: [],
        };

        if (belowSma) signal.reasons.push(`Price ${signal.smaDip}% below SMA20`);
        if (rsi14 < scalp.DEFAULTS.rsiThreshold) signal.reasons.push(`RSI ${rsi14.toFixed(1)} < ${scalp.DEFAULTS.rsiThreshold}`);

        // Enrich with hourly bar data for bear strategy
        if (hourlyBars && hourlyBars.length > 0) {
          const lastBar = hourlyBars[hourlyBars.length - 1];
          signal.rsi14 = signal.rsi;
          signal.volume = lastBar.v;
          const volBars = hourlyBars.slice(-20);
          signal.avgVolume20 = volBars.reduce((a, b) => a + b.v, 0) / volBars.length;
          signal.volumeRatio = signal.avgVolume20 > 0 ? lastBar.v / signal.avgVolume20 : 1;
          signal.open = lastBar.o;
          signal.high = lastBar.h;
          signal.low = lastBar.l;
          signal.close = lastBar.c;
        }

        signals.push(signal);

        // ── Check exits for open bull positions ──
        const pos = this.state.positions[symbol];
        if (pos && !pos.bearMode) {
          pos.livePrice = livePrice;
          pos.sma20 = sma20;
          pos.rsi = rsi14;

          const holdMs = Date.now() - new Date(pos.entryTime).getTime();
          const holdMin = (holdMs / 60000).toFixed(1);
          const pnlPct = ((livePrice - pos.entryPrice) / pos.entryPrice * 100);
          const pnlTag = `P&L ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(3)}%`;

          if (pos.scalpMode) {
            // ── SCALP EXIT HIERARCHY (first signal wins) ──

            // (1) SMA target / stop loss / time — shared engine
            const exitResult = scalp.evalExit(pos, livePrice, sma20);
            if (exitResult) {
              await this.executeExit(symbol, livePrice, exitResult.reason);
              continue;
            }

            // (2) RSI > 60 on 1-min — momentum exhausted, dip is over (Exp1-specific)
            if (rsi14 > 60) {
              const holdMin = ((Date.now() - new Date(pos.entryTime).getTime()) / 60000).toFixed(1);
              const pnlPct = ((livePrice - pos.entryPrice) / pos.entryPrice * 100);
              await this.executeExit(symbol, livePrice,
                `SCALP RSI EXIT — RSI ${rsi14.toFixed(1)} > 60 | SMA $${sma20.toFixed(4)} | ${holdMin}min | P&L ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(3)}%`
              );
              continue;
            }

            // (3) Volume fading — Exp1-specific (3 consecutive low-vol candles)
            if (pos.entryVolume > 0 && minuteBars.length > 0) {
              const currentVol = minuteBars[minuteBars.length - 1].v;
              if (currentVol < pos.entryVolume * 0.5) {
                pos.fadingCount = (pos.fadingCount || 0) + 1;
              } else {
                pos.fadingCount = 0;
              }
              if (pos.fadingCount >= 3) {
                const holdMin = ((Date.now() - new Date(pos.entryTime).getTime()) / 60000).toFixed(1);
                const pnlPct = ((livePrice - pos.entryPrice) / pos.entryPrice * 100);
                await this.executeExit(symbol, livePrice,
                  `SCALP VOL FADE — vol ${currentVol.toFixed(0)} < 50% of entry ${pos.entryVolume.toFixed(0)} for 3 scans | ${holdMin}min | P&L ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(3)}%`
                );
                continue;
              }
            }
          } else {
            // ── LEGACY SWING EXIT (for any non-scalp bull positions) ──

            // Stop loss: 0.65%
            const stopPrice = pos.entryPrice * (1 - scalp.DEFAULTS.stopLoss);
            if (livePrice <= stopPrice) {
              await this.executeExit(symbol, livePrice,
                `SWING STOP LOSS — price $${livePrice.toFixed(4)} | ${holdMin}min | ${pnlTag}`
              );
              continue;
            }

            // Time exit: 4h for legacy swing positions
            if (holdMs >= 4 * 60 * 60 * 1000) {
              await this.executeExit(symbol, livePrice,
                `SWING TIME EXIT — ${holdMin}min | ${pnlTag}`
              );
              continue;
            }
          }
        }

        // ── Check exits for open bear positions ──
        if (pos && pos.bearMode && livePrice > 0) {
          pos.livePrice = livePrice;

          if (livePrice <= pos.stopPrice) {
            await this.executeExit(symbol, livePrice, 'BEAR STOP LOSS');
            setBearCooldown(symbol);
            continue;
          }
          if (livePrice >= pos.targetPrice) {
            await this.executeExit(symbol, livePrice, 'BEAR TAKE PROFIT');
            continue;
          }

          // Bear time exit: 36h
          const holdHours = (Date.now() - new Date(pos.entryTime).getTime()) / (1000 * 60 * 60);
          if (holdHours >= 36) {
            await this.executeExit(symbol, livePrice, `BEAR TIME EXIT (${Math.round(holdHours)}h)`);
            continue;
          }
        }
      } catch (err) {
        this.addEvent('danger', `Error scanning ${symbol}: ${err.message}`);
      }
    }

    this.state.signals = signals;

    // ── BEAR MODE: dead cat bounce entries (unchanged) ──────
    if (!gate.open) {
      if (this._lastGateOpen !== false) {
        this.addEvent('warning', `[BTC GATE] Closed — BTC $${gate.btcPrice} below 50-SMA $${gate.sma50} — switching to BEAR mode`);
        this._lastGateOpen = false;
      }

      const detailedState = this._currentDetailedRegime?.state;
      const regimeLabel = this._currentDetailedRegime?.label;

      if (detailedState === 'FLAT') {
        // sit out
      } else if (detailedState === 'BEAR_RALLY') {
        this.addEvent('info', `[EXP1][REGIME] ${regimeLabel} — sitting out. Dead cat bounce needs exhaustion, not an active rally.`);
      } else if (detailedState === 'BEAR_EXHAUSTED') {
        this.addEvent('info', `[EXP1][REGIME] ${regimeLabel} — sitting out. Waiting for all dead cat conditions to align.`);
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

    // ── BULL MODE: 1-min scalp entries ──────────────────────
    } else {
      if (this._lastGateOpen !== true) {
        this.addEvent('success', `[BTC GATE] Open — BTC $${gate.btcPrice} above 50-SMA $${gate.sma50} — switching to BULL mode`);
        this._lastGateOpen = true;
      }

      const regime2 = this._currentDetailedRegime?.state;
      const regimeLabel = this._currentDetailedRegime?.label;

      // BULL_WEAKENING: sit out — scalps need clean momentum
      if (regime2 === 'BULL_WEAKENING') {
        this.addEvent('info', `[EXP1][REGIME] ${regimeLabel} — sitting out (no edge for scalps in weakening trend)`);
      } else {
        const entrySet = new Set(entryWatchlist);
        let openCount = Object.keys(this.state.positions).length;
        for (const sig of signals) {
          if (openCount >= this.config.maxPositions) break;
          if (!entrySet.has(sig.symbol)) continue;
          if (sig.signal !== 'buy') continue;
          if (this.state.positions[sig.symbol]) continue;
          if (isCoinDisabled(sig.symbol)) {
            console.log(`[EXP1][SCALP] Skipping ${sig.symbol} — coin disabled (low win rate)`);
            continue;
          }

          recordFeatureSnapshot({
            bot: 'exp1', coin: sig.symbol, price: sig.price,
            sma20: sig.sma20, rsi14: sig.rsi, smaDipPct: sig.smaDip, expectedNetPct: 0,
            regime: this._currentDetailedRegime?.state, regimeState: regimeLabel,
            fearGreed: this._currentDetailedRegime?.signals?.fng,
            btcPrice: gate.btcPrice, btcGateOpen: gate.open,
            volumeRatio: sig.volumeRatio,
          });
          await this.executeScalpEntry(sig, { regimeLabel });
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

      const currentPrices = {};
      for (const sig of this.state.signals) {
        if (sig.price > 0) currentPrices[sig.symbol] = sig.price;
      }
      benchmark.update(currentPrices);
      updateBalance('exp1', this.state.portfolioValue);
    } catch {}
  }

  // ─── SCALP ENTRY (BULL MODE) ───────────────────────────────

  async executeScalpEntry(signal, opts = {}) {
    const { symbol, price, sma20, rsi } = signal;
    const notional = Math.min(this.config.scalpTradeSize, this.state.cashBalance);
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
        sma20, rsi,
        entryVolume: signal.entryVolume || 0,
        fadingCount: 0,
        scalpMode: true,
      };

      const regimeTag = opts.regimeLabel ? ` [${opts.regimeLabel}]` : '';
      this.addEvent('success',
        `SCALP BUY ${symbol} @ $${fillPrice.toFixed(4)} | $${notional.toFixed(2)} | SMA $${sma20.toFixed(4)} | RSI ${rsi} | dip ${signal.smaDip}%${regimeTag}`
      );
      this.recordTrade({ symbol, side: 'BUY', qty, price: fillPrice, notional, time: new Date().toISOString(), pnl: null });
    } catch (err) {
      this.addEvent('danger', `Scalp order failed for ${symbol}: ${err.message}`);
    }
  }

  // ─── BEAR ENTRY (DEAD CAT BOUNCE — UNCHANGED) ─────────────

  async executeBearEntry(bearSignal, signal) {
    const { symbol, price } = signal;
    const targetNotional = this.state.portfolioValue * 0.33;
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

      const fillPrice = fill.price;
      const entryCost = notional * SPREAD_COST_PCT;
      const qty = (notional - entryCost) / fillPrice;

      const stopPrice = fillPrice * (1 - bearSignal.stopLoss);
      const targetPrice = fillPrice * (1 + bearSignal.takeProfit);

      this.state.positions[symbol] = {
        symbol, orderId: order.id, entryPrice: fillPrice, qty, notional, entryCost,
        entryTime: new Date().toISOString(),
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
      const pnlPct = (exitPrice - pos.entryPrice) / pos.entryPrice * 100;
      const isWin = pnl > 0;
      if (isWin) this.state.wins++; else this.state.losses++;

      const holdMs = Date.now() - new Date(pos.entryTime).getTime();
      const holdMin = (holdMs / 60000).toFixed(1);

      this.addEvent(isWin ? 'success' : 'danger',
        `SELL ${symbol} @ $${exitPrice.toFixed(4)} | ${reason} | P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(3)}%) | hold ${holdMin}min`
      );
      this.recordTrade({
        symbol, side: 'SELL', qty: pos.qty, price: exitPrice, notional: pos.notional,
        time: new Date().toISOString(), pnl: parseFloat(pnl.toFixed(4)), reason,
      });

      // Record to performance tracker
      let exitReason = 'timeExit';
      if (reason.includes('TARGET HIT')) exitReason = 'takeProfit';
      else if (reason.includes('STOP LOSS')) exitReason = 'stopLoss';
      else if (reason.includes('TIME EXIT')) exitReason = 'timeExit';
      else if (reason.includes('TAKE PROFIT')) exitReason = 'takeProfit';
      const exitTime = new Date().toISOString();
      recordPerfTrade({
        bot: 'exp1',
        coin: symbol,
        entryPrice: pos.entryPrice,
        exitPrice,
        entryTime: pos.entryTime,
        exitTime,
        pnlPct: parseFloat(pnlPct.toFixed(2)),
        pnlUsd: parseFloat(pnl.toFixed(2)),
        exitReason,
        regime: pos.bearMode ? 'bear' : 'bull',
        type: pos.bearMode ? (pos.bearType || 'dead_cat') : 'scalp',
      });

      // Scalp trade log
      if (pos.scalpMode) {
        recordScalpTrade({
          bot: 'exp1',
          coin: symbol,
          entryPrice: pos.entryPrice,
          exitPrice,
          entryTime: pos.entryTime,
          exitTime,
          pnlUsd: parseFloat(pnl.toFixed(2)),
          pnlPct: parseFloat(pnlPct.toFixed(2)),
          exitReason,
          smaAtEntry: pos.sma20 || 0,
          rsiAtEntry: pos.rsi || 0,
          notional: pos.notional,
        });
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
      strategy: '1min-scalp',
      config: {
        scalpTradeSize: this.config.scalpTradeSize,
        maxPositions: this.config.maxPositions,
        scanInterval: this.config.scanInterval,
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
