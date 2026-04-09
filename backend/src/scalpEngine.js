// src/scalpEngine.js — Shared scalp logic used by all three bots
// Consolidates candle fetching, indicator math, entry/exit evaluation.
// Bot-specific logic (position guards, priority rules, DCA precedence) stays in each bot.

const alpaca = require('./alpaca');
const { calcRSI, calcSMA } = require('./strategy');

// ─── Spread cost estimates ───────────────────────────────────
// Per-side spread cost as a fraction of notional.
// Round-trip cost = spreadPerSide * 2
const SPREAD_PER_SIDE = {
  default: 0.0015,         // 0.15% per side — altcoins (AVAX, LINK, DOT, etc.)
  btc: 0.0008,             // 0.08% per side — BTC (tighter spreads)
  eth: 0.0010,             // 0.10% per side — ETH
  sol: 0.0012,             // 0.12% per side — SOL
};

// Minimum net expected profit after spread costs (as a fraction).
// If expected reversion gain minus round-trip spread < this, skip the entry.
const MIN_NET_PROFIT = 0.003; // 0.3% — must clear this after fees to be worth it

// ─── Default parameters (altcoin scalps) ─────────────────────
const DEFAULTS = {
  smaPeriod: 20,
  rsiPeriod: 14,
  dipPct: 0.008,           // entry: price < SMA * (1 - 0.8%) — deeper dip = better R:R
  rsiThreshold: 40,        // entry: RSI < 40 — require stronger oversold signal
  stopLoss: 0.015,         // exit: 1.5% stop loss — room for noise before SMA reversion
  maxHoldMs: 30 * 60 * 1000, // exit: 30 minutes — more time to revert
};

// ─── BTC-specific overrides (tighter for lower volatility) ───
const BTC_OVERRIDES = {
  dipPct: 0.005,           // price < SMA * (1 - 0.5%) — deeper dip for BTC
  rsiThreshold: 38,        // RSI < 38 — stricter for BTC
  stopLoss: 0.01,          // 1.0% stop loss — room for BTC noise
  maxHoldMs: 25 * 60 * 1000, // 25 minutes
};

/**
 * Fetch 1-minute candles for a coin.
 * Returns an array of bars: [{ t, o, h, l, c, v }, ...]
 *
 * @param {string} apiKey
 * @param {string} secretKey
 * @param {string} symbol - e.g. 'BTC/USD'
 * @param {number} [count] - number of bars (default: smaPeriod + 5 for RSI warmup)
 */
async function fetchCandles(apiKey, secretKey, symbol, count) {
  const limit = count || DEFAULTS.smaPeriod + 5;
  return alpaca.getCryptoBars(apiKey, secretKey, symbol, '1Min', limit);
}

/**
 * Fetch 1-minute candles for multiple coins in a single batch call.
 *
 * @param {string} apiKey
 * @param {string} secretKey
 * @param {string[]} symbols
 * @param {number} [count]
 * @returns {Promise<Map<string, Array>>}
 */
async function fetchCandlesMulti(apiKey, secretKey, symbols, count) {
  const limit = count || DEFAULTS.smaPeriod + 5;
  return alpaca.getCryptoBarsMulti(apiKey, secretKey, symbols, '1Min', limit);
}

/**
 * Compute SMA and RSI from 1-min bar closes + live price.
 *
 * @param {number[]} barCloses - closes from 1-min bars
 * @param {number} livePrice - current price to append
 * @param {object} [opts] - { smaPeriod, rsiPeriod } overrides
 * @returns {{ sma: number, rsi: number, closes: number[] }}
 */
function computeIndicators(barCloses, livePrice, opts = {}) {
  const smaPeriod = opts.smaPeriod || DEFAULTS.smaPeriod;
  const rsiPeriod = opts.rsiPeriod || DEFAULTS.rsiPeriod;
  const closes = [...barCloses, livePrice];
  const sma = closes.length >= smaPeriod ? calcSMA(closes, smaPeriod) : livePrice;
  const rsi = closes.length >= rsiPeriod + 1 ? calcRSI(closes, rsiPeriod) : 50;
  return { sma, rsi, closes };
}

/**
 * Get the estimated per-side spread cost for a symbol.
 *
 * @param {string} symbol - e.g. 'BTC/USD'
 * @returns {number} spread as a fraction (e.g. 0.0015)
 */
function getSpreadForSymbol(symbol) {
  const s = (symbol || '').toUpperCase();
  if (s.includes('BTC')) return SPREAD_PER_SIDE.btc;
  if (s.includes('ETH')) return SPREAD_PER_SIDE.eth;
  if (s.includes('SOL')) return SPREAD_PER_SIDE.sol;
  return SPREAD_PER_SIDE.default;
}

/**
 * Evaluate whether a scalp entry should trigger.
 * Includes a profitability filter: the expected reversion to SMA must
 * exceed the estimated round-trip spread cost by MIN_NET_PROFIT.
 *
 * @param {number} price - current live price
 * @param {number} sma - 20-period SMA
 * @param {number} rsi - 14-period RSI
 * @param {object} [opts] - { dipPct, rsiThreshold, symbol } overrides
 * @returns {{ shouldEnter: boolean, smaDip: string, spreadBlocked?: boolean, expectedNet?: string }}
 */
function evalEntry(price, sma, rsi, opts = {}) {
  const dipPct = opts.dipPct || DEFAULTS.dipPct;
  const rsiThreshold = opts.rsiThreshold || DEFAULTS.rsiThreshold;
  const smaDipThreshold = sma * (1 - dipPct);
  const belowSma = price < smaDipThreshold;
  const rsiOk = rsi < rsiThreshold;
  const smaDip = ((price - sma) / sma * 100).toFixed(3);

  // If basic conditions aren't met, exit early
  if (!belowSma || !rsiOk) {
    return { shouldEnter: false, smaDip };
  }

  // Spread-aware profitability check
  // Expected gain: price reverts from current to SMA = (sma - price) / price
  const expectedGain = (sma - price) / price;
  const spreadCost = getSpreadForSymbol(opts.symbol) * 2; // round trip
  const expectedNet = expectedGain - spreadCost;

  if (expectedNet < MIN_NET_PROFIT) {
    return {
      shouldEnter: false,
      smaDip,
      spreadBlocked: true,
      expectedNet: (expectedNet * 100).toFixed(3),
    };
  }

  return { shouldEnter: true, smaDip, expectedNet: (expectedNet * 100).toFixed(3) };
}

/**
 * Evaluate whether a scalp exit should trigger (first-hit-wins).
 * Returns null if no exit, or { reason, tag } if exit should fire.
 *
 * @param {object} pos - position object with entryPrice, entryTime
 * @param {number} price - current live price
 * @param {number} sma - current 20-period SMA
 * @param {object} [opts] - { stopLoss, maxHoldMs, label } overrides
 * @returns {{ reason: string, tag: string } | null}
 */
function evalExit(pos, price, sma, opts = {}) {
  const stopLossPct = opts.stopLoss || DEFAULTS.stopLoss;
  const maxHoldMs = opts.maxHoldMs || DEFAULTS.maxHoldMs;
  const label = opts.label || 'SCALP';

  const holdMs = Date.now() - new Date(pos.entryTime).getTime();
  const holdMin = (holdMs / 60000).toFixed(1);
  const pnlPct = ((price - pos.entryPrice) / pos.entryPrice * 100);
  const pnlTag = `P&L ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(3)}%`;

  // (1) SMA target — price reverted to mean, but only exit if net profitable
  // Require price to cover entry + round-trip spread before taking profit
  const spreadCost = getSpreadForSymbol(opts.symbol) * 2;
  const minProfitPrice = pos.entryPrice * (1 + spreadCost + MIN_NET_PROFIT);
  if (price >= sma && price >= minProfitPrice) {
    return {
      reason: `${label} TARGET HIT — price $${price.toFixed(4)} >= SMA $${sma.toFixed(4)} | ${holdMin}min | ${pnlTag}`,
      tag: 'targetHit',
    };
  }

  // (2) Stop loss
  const stopPrice = pos.entryPrice * (1 - stopLossPct);
  if (price <= stopPrice) {
    return {
      reason: `${label} STOP LOSS — price $${price.toFixed(4)} <= stop $${stopPrice.toFixed(4)} | ${holdMin}min | ${pnlTag}`,
      tag: 'stopLoss',
    };
  }

  // (3) Time exit
  if (holdMs >= maxHoldMs) {
    return {
      reason: `${label} TIME EXIT — ${holdMin}min > ${(maxHoldMs / 60000).toFixed(0)}min max | ${pnlTag}`,
      tag: 'timeExit',
    };
  }

  return null;
}

module.exports = {
  DEFAULTS,
  BTC_OVERRIDES,
  SPREAD_PER_SIDE,
  MIN_NET_PROFIT,
  fetchCandles,
  fetchCandlesMulti,
  computeIndicators,
  evalEntry,
  evalExit,
  getSpreadForSymbol,
  // Re-export for convenience so bots don't need to import strategy.js separately
  calcSMA,
  calcRSI,
};
