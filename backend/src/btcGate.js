// src/btcGate.js - Shared BTC/USD macro gate for all bots
// Checks if BTC is trading above its 50-day SMA before allowing new entries.
// Cached for 15 minutes. Does NOT affect exits.

const alpaca = require('./alpaca');
const axios = require('axios');

let cache = null; // { result, fetchedAt }
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

let fngCache = null; // { result, fetchedAt } — separate cache for Fear & Greed
const FNG_CACHE_TTL = 15 * 60 * 1000;
const FIFTY_FIVE_DAYS_MS = 55 * 24 * 60 * 60 * 1000; // extra margin for 50 daily bars

/**
 * Check if the BTC macro gate is open (BTC price > 50-day SMA).
 * Requires apiKey/secretKey to fetch data, but result is cached globally.
 *
 * @param {string} apiKey - Alpaca API key
 * @param {string} secretKey - Alpaca secret key
 * @param {string} [streamHandle] - Optional WebSocket stream handle for live price
 * @returns {Promise<{ open: boolean, btcPrice: number, sma50: number }>}
 */
async function isBtcGateOpen(apiKey, secretKey, streamHandle) {
  if (cache && (Date.now() - cache.fetchedAt) < CACHE_TTL) {
    return cache.result;
  }

  try {
    const bars = await alpaca.getCryptoBars(
      apiKey, secretKey, 'BTC/USD', '1Day', 50, FIFTY_FIVE_DAYS_MS
    );

    if (!bars || bars.length < 10) {
      console.log('[BTC GATE] Insufficient bar data — defaulting to open');
      // Don't cache failures — retry next call
      return { open: true, btcPrice: 0, sma50: 0 };
    }

    const closes = bars.map(b => b.c);
    const sma50 = closes.reduce((a, b) => a + b, 0) / closes.length;

    // Get current BTC price (stream first, REST fallback)
    const livePrice = await alpaca.getLatestCryptoPrice(apiKey, secretKey, 'BTC/USD', streamHandle);
    const btcPrice = livePrice || closes[closes.length - 1];

    const open = btcPrice > sma50;
    const result = {
      open,
      btcPrice: parseFloat(btcPrice.toFixed(2)),
      sma50: parseFloat(sma50.toFixed(2)),
    };

    cache = { result, fetchedAt: Date.now() };
    return result;
  } catch (err) {
    console.log(`[BTC GATE] Fetch error — defaulting to open: ${err.message}`);
    // Don't cache errors — retry next call
    return { open: true, btcPrice: 0, sma50: 0 };
  }
}

/**
 * Full market regime detection — layers Fear & Greed on top of BTC gate.
 * Cached separately from the gate check (15-min TTL each).
 *
 * @param {string} apiKey
 * @param {string} secretKey
 * @param {string} [streamHandle]
 * @returns {Promise<{ regime, btcPrice, sma50, btcGateOpen, fearGreed, extremeFear, capitulation }>}
 */
async function getMarketRegime(apiKey, secretKey, streamHandle) {
  const gateResult = await isBtcGateOpen(apiKey, secretKey, streamHandle);

  // Fetch Fear & Greed Index (cached separately)
  let fearGreed;
  if (fngCache && (Date.now() - fngCache.fetchedAt) < FNG_CACHE_TTL) {
    fearGreed = fngCache.result;
  } else {
    try {
      const res = await axios.get('https://api.alternative.me/fng/');
      const value = parseInt(res.data.data[0].value);
      const label = res.data.data[0].value_classification;
      fearGreed = { value, label };
      fngCache = { result: fearGreed, fetchedAt: Date.now() };
    } catch (err) {
      console.log('[REGIME] Fear & Greed fetch failed — defaulting to 50');
      fearGreed = { value: 50, label: 'Unknown' };
    }
  }

  return {
    regime: gateResult.open ? 'bull' : 'bear',
    btcPrice: gateResult.btcPrice,
    sma50: gateResult.sma50,
    btcGateOpen: gateResult.open,
    fearGreed,
    extremeFear: fearGreed.value < 20,
    capitulation: fearGreed.value < 15,
  };
}

module.exports = { isBtcGateOpen, getMarketRegime };
