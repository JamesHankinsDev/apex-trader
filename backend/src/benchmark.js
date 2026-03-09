// src/benchmark.js - Benchmark tracking: equal-weight & market-cap weighted
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
    this.basePrices = {};         // Prices when benchmarks started { 'BTC/USD': 50000, ... }
    this.marketCaps = {};         // Market caps at start { 'BTC/USD': 1e12, ... }
    this.equalWeights = {};       // Equal-weight allocations { 'BTC/USD': 0.2, ... }
    this.mcapWeights = {};        // Market-cap weighted allocations
    this.equalHistory = [];       // [{ t, v }] — equal-weight benchmark equity curve
    this.mcapHistory = [];        // [{ t, v }] — market-cap weighted benchmark equity curve
    this.btcHistory = [];         // [{ t, v }] — BTC-only benchmark equity curve
    this.lastEqualValue = 0;
    this.lastMcapValue = 0;
    this.lastBtcValue = 0;
  }

  /**
   * Initialize benchmarks when bot starts.
   * @param {number} startValue - Portfolio starting value (benchmarks invest the same amount)
   * @param {string[]} watchlist - Array of symbols like ['BTC/USD', 'ETH/USD', ...]
   * @param {Function} getPriceFn - async (symbol) => price
   */
  async initialize(startValue, watchlist, getPriceFn) {
    this.startValue = startValue;
    this.basePrices = {};
    this.equalHistory = [];
    this.mcapHistory = [];
    this.btcHistory = [];

    // Fetch current prices for all watchlist assets
    const validSymbols = [];
    for (const sym of watchlist) {
      try {
        const price = await getPriceFn(sym);
        if (price && price > 0) {
          this.basePrices[sym] = price;
          validSymbols.push(sym);
        }
      } catch (err) {
        console.error(`Benchmark: failed to get price for ${sym}:`, err.message);
      }
    }

    if (validSymbols.length === 0) {
      console.error('Benchmark: no valid prices — benchmarks disabled');
      return;
    }

    // Equal weights
    const equalWeight = 1 / validSymbols.length;
    this.equalWeights = {};
    for (const sym of validSymbols) {
      this.equalWeights[sym] = equalWeight;
    }

    // Fetch market caps for market-cap weighting
    this.marketCaps = await fetchMarketCaps(validSymbols);
    const totalMcap = Object.values(this.marketCaps).reduce((sum, v) => sum + v, 0);

    this.mcapWeights = {};
    if (totalMcap > 0) {
      for (const sym of validSymbols) {
        this.mcapWeights[sym] = (this.marketCaps[sym] || 0) / totalMcap;
      }
    } else {
      // Fallback to equal weight if market caps unavailable
      for (const sym of validSymbols) {
        this.mcapWeights[sym] = equalWeight;
      }
      console.warn('Benchmark: market cap data unavailable — mcap benchmark falls back to equal weight');
    }

    this.lastEqualValue = startValue;
    this.lastMcapValue = startValue;
    this.lastBtcValue = this.basePrices['BTC/USD'] ? startValue : 0;

    const now = Date.now();
    this.equalHistory.push({ t: now, v: startValue });
    this.mcapHistory.push({ t: now, v: startValue });
    if (this.lastBtcValue > 0) this.btcHistory.push({ t: now, v: startValue });

    this.initialized = true;

    console.log('Benchmark initialized:');
    console.log('  Equal weights:', Object.entries(this.equalWeights).map(([s, w]) => `${s}: ${(w * 100).toFixed(1)}%`).join(', '));
    console.log('  Mcap weights:', Object.entries(this.mcapWeights).map(([s, w]) => `${s}: ${(w * 100).toFixed(1)}%`).join(', '));
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
    if (this.equalHistory.length > 500) this.equalHistory.shift();
    if (this.mcapHistory.length > 500) this.mcapHistory.shift();
    if (this.btcHistory.length > 500) this.btcHistory.shift();
  }

  /**
   * Get benchmark data for the status endpoint.
   */
  getStatus() {
    if (!this.initialized) {
      return {
        initialized: false,
        equalWeight: { value: 0, pnl: 0, pctReturn: 0, history: [] },
        mcapWeight: { value: 0, pnl: 0, pctReturn: 0, history: [] },
        btcOnly: { value: 0, pnl: 0, pctReturn: 0, history: [] },
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
      equalWeight: {
        value: this.lastEqualValue,
        pnl: equalPnl,
        pctReturn: equalPct,
        history: this.equalHistory.slice(-200),
      },
      mcapWeight: {
        value: this.lastMcapValue,
        pnl: mcapPnl,
        pctReturn: mcapPct,
        history: this.mcapHistory.slice(-200),
      },
      btcOnly: {
        value: this.lastBtcValue,
        pnl: btcPnl,
        pctReturn: btcPct,
        history: this.btcHistory.slice(-200),
      },
      weights: {
        equal: this.equalWeights,
        mcap: this.mcapWeights,
      },
    };
  }
}

module.exports = new BenchmarkTracker();
