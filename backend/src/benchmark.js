// src/benchmark.js - Benchmark tracking: BTC hold, equal-weight & market-cap weighted
// Uses 50-day lookback for base prices (aligns with 50-day SMA gate check).
// Each bot creates its own instance via `new BenchmarkTracker()`.
const axios = require('axios');

// CoinGecko symbol mapping (watchlist symbol → CoinGecko ID)
const COINGECKO_IDS = {
  'BTC/USD': 'bitcoin',
  'ETH/USD': 'ethereum',
  'SOL/USD': 'solana',
  'DOGE/USD': 'dogecoin',
  'AVAX/USD': 'avalanche-2',
  'LINK/USD': 'chainlink',
  'ADA/USD': 'cardano',
  'DOT/USD': 'polkadot',
  'MATIC/USD': 'matic-network',
  'SHIB/USD': 'shiba-inu',
  'XRP/USD': 'ripple',
  'LTC/USD': 'litecoin',
  'UNI/USD': 'uniswap',
  'ATOM/USD': 'cosmos',
  'NEAR/USD': 'near',
  'FTM/USD': 'fantom',
  'ALGO/USD': 'algorand',
  'XLM/USD': 'stellar',
  'BCH/USD': 'bitcoin-cash',
  'AAVE/USD': 'aave',
};

const HISTORY_CAP = 2000;      // ~33 hours at 60s intervals, ~16h at 30s
const LOOKBACK_DAYS = 50;

/**
 * Fetch market caps from CoinGecko (free, no auth, rate-limited to ~10-30 req/min)
 * Returns { 'BTC/USD': 1234567890, ... }
 */
async function fetchMarketCaps(watchlist) {
  const ids = watchlist
    .map(sym => COINGECKO_IDS[sym])
    .filter(Boolean);

  if (ids.length === 0) return {};

  try {
    const res = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
      params: {
        ids: ids.join(','),
        vs_currencies: 'usd',
        include_market_cap: true,
      },
      timeout: 10000,
    });

    const caps = {};
    for (const sym of watchlist) {
      const geckoId = COINGECKO_IDS[sym];
      if (geckoId && res.data[geckoId]) {
        caps[sym] = res.data[geckoId].usd_market_cap || 0;
      }
    }
    return caps;
  } catch (err) {
    console.error('CoinGecko market cap fetch failed:', err.message);
    return {};
  }
}

class BenchmarkTracker {
  constructor() {
    this.initialized = false;
    this.startValue = 0;          // Same as portfolio startValue
    this.basePrices = {};         // Prices from 50 days ago { 'BTC/USD': 50000, ... }
    this.marketCaps = {};         // Market caps at start { 'BTC/USD': 1e12, ... }
    this.equalWeights = {};       // Equal-weight allocations { 'BTC/USD': 0.2, ... }
    this.mcapWeights = {};        // Market-cap weighted allocations
    this.equalHistory = [];       // [{ t, v }] — real-time equal-weight benchmark
    this.mcapHistory = [];        // [{ t, v }] — real-time market-cap weighted benchmark
    this.btcHistory = [];         // [{ t, v }] — real-time BTC-only benchmark
    this.dailyEqualHistory = [];  // [{ t, v }] — daily equal-weight (computed from bars)
    this.dailyMcapHistory = [];   // [{ t, v }] — daily market-cap weighted
    this.dailyBtcHistory = [];    // [{ t, v }] — daily BTC-only
    this.lastEqualValue = 0;
    this.lastMcapValue = 0;
    this.lastBtcValue = 0;
  }

  /**
   * Initialize benchmarks with 50-day lookback base prices.
   * @param {number} startValue - Portfolio starting value (benchmarks invest the same amount)
   * @param {string[]} watchlist - Array of symbols like ['BTC/USD', 'ETH/USD', ...]
   * @param {Function} getBarsFn - async (symbol, timeframe, limit, lookbackMs) => bars[]
   */
  async initialize(startValue, watchlist, getBarsFn) {
    this.startValue = startValue;
    this.basePrices = {};
    this.equalHistory = [];
    this.mcapHistory = [];
    this.btcHistory = [];
    this.dailyEqualHistory = [];
    this.dailyMcapHistory = [];
    this.dailyBtcHistory = [];

    // Fetch daily bars for 50-day lookback to get base prices
    const lookbackMs = (LOOKBACK_DAYS + 5) * 24 * 60 * 60 * 1000; // extra padding
    const validSymbols = [];
    const allBars = {}; // symbol -> bars[]

    // Always include BTC for the BTC Hold benchmark, even if not in this bot's watchlist
    const symbolsToFetch = new Set(watchlist);
    symbolsToFetch.add('BTC/USD');

    for (const sym of symbolsToFetch) {
      try {
        const bars = await getBarsFn(sym, '1Day', LOOKBACK_DAYS + 5, lookbackMs);
        if (bars && bars.length > 0 && bars[0].c > 0) {
          // Use the oldest bar's close as the 50-day-ago base price
          // Bars use { t, o, h, l, c, v } format (Alpaca shorthand)
          this.basePrices[sym] = bars[0].c;
          validSymbols.push(sym);
          allBars[sym] = bars;
        }
      } catch (err) {
        console.error(`Benchmark: failed to get 50-day bars for ${sym}:`, err.message);
      }
    }

    if (validSymbols.length === 0) {
      console.error('Benchmark: no valid 50-day prices — benchmarks disabled');
      return;
    }

    // Equal and MCAP weights use only the bot's watchlist symbols (not the extra BTC)
    const watchlistSymbols = validSymbols.filter(s => watchlist.includes(s));
    const equalWeight = watchlistSymbols.length > 0 ? 1 / watchlistSymbols.length : 0;
    this.equalWeights = {};
    for (const sym of watchlistSymbols) {
      this.equalWeights[sym] = equalWeight;
    }

    // Fetch market caps for market-cap weighting
    this.marketCaps = await fetchMarketCaps(watchlistSymbols);
    const totalMcap = Object.values(this.marketCaps).reduce((sum, v) => sum + v, 0);

    this.mcapWeights = {};
    if (totalMcap > 0) {
      for (const sym of watchlistSymbols) {
        this.mcapWeights[sym] = (this.marketCaps[sym] || 0) / totalMcap;
      }
    } else {
      // Fallback to equal weight if market caps unavailable
      for (const sym of watchlistSymbols) {
        this.mcapWeights[sym] = equalWeight;
      }
      console.warn('Benchmark: market cap data unavailable — mcap benchmark falls back to equal weight');
    }

    // ── Compute daily benchmark curves from historical bars ──
    // Find the bar count we can align across (use the shortest series)
    const btcBars = allBars['BTC/USD'] || [];
    const barCounts = watchlistSymbols.map(s => (allBars[s] || []).length).filter(n => n > 0);
    const alignedLen = barCounts.length > 0 ? Math.min(...barCounts, btcBars.length || Infinity) : 0;

    for (let i = 0; i < alignedLen; i++) {
      // Timestamp from BTC bars (or first available watchlist symbol)
      const refBars = btcBars.length >= alignedLen ? btcBars : allBars[watchlistSymbols[0]];
      const t = new Date(refBars[i].t).getTime();

      // Equal-weight & MCAP-weight benchmark values at day i
      let eqVal = 0, mcVal = 0;
      for (const sym of watchlistSymbols) {
        const bars = allBars[sym];
        if (!bars || !bars[i]) continue;
        const basePrice = this.basePrices[sym];
        const dayPrice = bars[i].c;
        const ret = (dayPrice - basePrice) / basePrice;
        eqVal += startValue * (this.equalWeights[sym] || 0) * (1 + ret);
        mcVal += startValue * (this.mcapWeights[sym] || 0) * (1 + ret);
      }
      if (eqVal > 0) this.dailyEqualHistory.push({ t, v: eqVal });
      if (mcVal > 0) this.dailyMcapHistory.push({ t, v: mcVal });

      // BTC-only benchmark at day i
      if (btcBars[i]) {
        const btcBase = this.basePrices['BTC/USD'];
        const btcDay = btcBars[i].c;
        const btcRet = (btcDay - btcBase) / btcBase;
        this.dailyBtcHistory.push({ t, v: startValue * (1 + btcRet) });
      }
    }

    this.lastEqualValue = startValue;
    this.lastMcapValue = startValue;
    this.lastBtcValue = this.basePrices['BTC/USD'] ? startValue : 0;

    const now = Date.now();
    this.equalHistory.push({ t: now, v: startValue });
    this.mcapHistory.push({ t: now, v: startValue });
    if (this.lastBtcValue > 0) this.btcHistory.push({ t: now, v: startValue });

    this.initialized = true;

    console.log(`Benchmark initialized (${LOOKBACK_DAYS}-day lookback):`);
    console.log('  Base prices:', Object.entries(this.basePrices).map(([s, p]) => `${s}: $${p.toFixed(2)}`).join(', '));
    console.log('  Equal weights:', Object.entries(this.equalWeights).map(([s, w]) => `${s}: ${(w * 100).toFixed(1)}%`).join(', '));
    console.log('  Mcap weights:', Object.entries(this.mcapWeights).map(([s, w]) => `${s}: ${(w * 100).toFixed(1)}%`).join(', '));
    console.log(`  Daily history: ${this.dailyBtcHistory.length} days`);
  }

  /**
   * Update benchmark values with current prices.
   * Call this each scan cycle.
   * @param {Object} currentPrices - { 'BTC/USD': 51000, ... }
   */
  update(currentPrices) {
    if (!this.initialized) return;

    let equalValue = 0;
    let mcapValue = 0;

    for (const sym of Object.keys(this.basePrices)) {
      const basePrice = this.basePrices[sym];
      const curPrice = currentPrices[sym];
      if (!curPrice || !basePrice) continue;

      const returnPct = (curPrice - basePrice) / basePrice;

      // Each benchmark allocates startValue * weight to this asset
      // Current value of that allocation = startValue * weight * (1 + return)
      const equalAlloc = this.startValue * (this.equalWeights[sym] || 0);
      const mcapAlloc = this.startValue * (this.mcapWeights[sym] || 0);

      equalValue += equalAlloc * (1 + returnPct);
      mcapValue += mcapAlloc * (1 + returnPct);
    }

    if (equalValue > 0) this.lastEqualValue = equalValue;
    if (mcapValue > 0) this.lastMcapValue = mcapValue;

    // BTC-only benchmark
    const btcBase = this.basePrices['BTC/USD'];
    const btcCur = currentPrices['BTC/USD'];
    if (btcBase && btcCur) {
      const btcReturn = (btcCur - btcBase) / btcBase;
      this.lastBtcValue = this.startValue * (1 + btcReturn);
    }

    const now = Date.now();
    this.equalHistory.push({ t: now, v: this.lastEqualValue });
    this.mcapHistory.push({ t: now, v: this.lastMcapValue });
    if (this.lastBtcValue > 0) this.btcHistory.push({ t: now, v: this.lastBtcValue });

    // Cap history length
    if (this.equalHistory.length > HISTORY_CAP) this.equalHistory.shift();
    if (this.mcapHistory.length > HISTORY_CAP) this.mcapHistory.shift();
    if (this.btcHistory.length > HISTORY_CAP) this.btcHistory.shift();
  }

  /**
   * Get benchmark data for the status endpoint.
   * Includes both real-time history and daily history for multi-period views.
   */
  getStatus() {
    if (!this.initialized) {
      return {
        initialized: false,
        lookbackDays: LOOKBACK_DAYS,
        equalWeight: { value: 0, pnl: 0, pctReturn: 0, history: [], dailyHistory: [] },
        mcapWeight: { value: 0, pnl: 0, pctReturn: 0, history: [], dailyHistory: [] },
        btcOnly: { value: 0, pnl: 0, pctReturn: 0, history: [], dailyHistory: [] },
        weights: { equal: {}, mcap: {} },
      };
    }

    const equalPnl = this.lastEqualValue - this.startValue;
    const mcapPnl = this.lastMcapValue - this.startValue;
    const btcPnl = this.lastBtcValue - this.startValue;
    const equalPct = this.startValue > 0 ? (equalPnl / this.startValue) * 100 : 0;
    const mcapPct = this.startValue > 0 ? (mcapPnl / this.startValue) * 100 : 0;
    const btcPct = this.startValue > 0 ? (btcPnl / this.startValue) * 100 : 0;

    return {
      initialized: true,
      lookbackDays: LOOKBACK_DAYS,
      equalWeight: {
        value: this.lastEqualValue,
        pnl: equalPnl,
        pctReturn: equalPct,
        history: this.equalHistory,
        dailyHistory: this.dailyEqualHistory,
      },
      mcapWeight: {
        value: this.lastMcapValue,
        pnl: mcapPnl,
        pctReturn: mcapPct,
        history: this.mcapHistory,
        dailyHistory: this.dailyMcapHistory,
      },
      btcOnly: {
        value: this.lastBtcValue,
        pnl: btcPnl,
        pctReturn: btcPct,
        history: this.btcHistory,
        dailyHistory: this.dailyBtcHistory,
      },
      weights: {
        equal: this.equalWeights,
        mcap: this.mcapWeights,
      },
    };
  }
}

module.exports = BenchmarkTracker;
