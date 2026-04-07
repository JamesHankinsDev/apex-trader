// src/scalpEngine.js — Shared scalp logic used by all three bots
// Consolidates candle fetching, indicator math, entry/exit evaluation.
// Bot-specific logic (position guards, priority rules, DCA precedence) stays in each bot.

const alpaca = require('./alpaca');
const { calcRSI, calcSMA } = require('./strategy');

// ─── Default parameters (altcoin scalps) ─────────────────────
const DEFAULTS = {
  smaPeriod: 20,
  rsiPeriod: 14,
  dipPct: 0.004,           // entry: price < SMA * (1 - 0.4%)
  rsiThreshold: 45,        // entry: RSI < 45
  stopLoss: 0.0065,        // exit: 0.65% stop loss
  maxHoldMs: 20 * 60 * 1000, // exit: 20 minutes
};

// ─── BTC-specific overrides (tighter for lower volatility) ───
const BTC_OVERRIDES = {
  dipPct: 0.0025,          // price < SMA * (1 - 0.25%)
  rsiThreshold: 42,        // RSI < 42
  stopLoss: 0.004,         // 0.4% stop loss
  maxHoldMs: 15 * 60 * 1000, // 15 minutes
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
 * Evaluate whether a scalp entry should trigger.
 *
 * @param {number} price - current live price
 * @param {number} sma - 20-period SMA
 * @param {number} rsi - 14-period RSI
 * @param {object} [opts] - { dipPct, rsiThreshold } overrides
 * @returns {{ shouldEnter: boolean, smaDip: string }}
 */
function evalEntry(price, sma, rsi, opts = {}) {
  const dipPct = opts.dipPct || DEFAULTS.dipPct;
  const rsiThreshold = opts.rsiThreshold || DEFAULTS.rsiThreshold;
  const smaDipThreshold = sma * (1 - dipPct);
  const belowSma = price < smaDipThreshold;
  const rsiOk = rsi < rsiThreshold;
  const smaDip = ((price - sma) / sma * 100).toFixed(3);
  return { shouldEnter: belowSma && rsiOk, smaDip };
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

  // (1) SMA target — price reverted to mean
  if (price >= sma) {
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
  fetchCandles,
  fetchCandlesMulti,
  computeIndicators,
  evalEntry,
  evalExit,
  // Re-export for convenience so bots don't need to import strategy.js separately
  calcSMA,
  calcRSI,
};
