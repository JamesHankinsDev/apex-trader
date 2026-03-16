// src/btcGate.js - Shared BTC/USD macro gate for all bots
// Checks if BTC is trading above its 50-day SMA before allowing new entries.
// Cached for 15 minutes. Does NOT affect exits.
// Phase 1: adds 8-state detailed regime classification (observation only).

const alpaca = require('./alpaca');
const axios = require('axios');

let cache = null; // { result, fetchedAt, bars }
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

let fngCache = null; // { result, fetchedAt } — separate cache for Fear & Greed
const FNG_CACHE_TTL = 15 * 60 * 1000;
let detailedRegimeCache = null; // { result, fetchedAt }
const DETAILED_REGIME_TTL = 15 * 60 * 1000;
const FIFTY_FIVE_DAYS_MS = 55 * 24 * 60 * 60 * 1000; // extra margin for 50 daily bars

// ── Technical indicator helpers for regime detection ──

/**
 * Calculate RSI from an array of closing prices (Wilder's smoothing).
 */
function calcRSI(prices, period = 14) {
  if (prices.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const delta = prices[i] - prices[i - 1];
    if (delta > 0) gains += delta;
    else losses += Math.abs(delta);
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < prices.length; i++) {
    const delta = prices[i] - prices[i - 1];
    avgGain = (avgGain * (period - 1) + (delta > 0 ? delta : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (delta < 0 ? Math.abs(delta) : 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - (100 / (1 + avgGain / avgLoss));
}

/**
 * Calculate ATR from OHLCV bars ({ t, o, h, l, c, v }).
 */
function calcATR(bars, period = 14) {
  if (bars.length < 2) return 0;
  const trs = bars.slice(1).map((bar, i) => {
    const prev = bars[i];
    return Math.max(bar.h - bar.l, Math.abs(bar.h - prev.c), Math.abs(bar.l - prev.c));
  });
  return trs.slice(-period).reduce((a, b) => a + b, 0) / Math.min(period, trs.length);
}

/**
 * Calculate ADX (Average Directional Index) from OHLCV bars.
 * Returns { adx, plusDI, minusDI }.
 */
function calcADX(bars, period = 14) {
  if (bars.length < period + 2) return { adx: 0, plusDI: 0, minusDI: 0 };

  const trList = [];
  const plusDMList = [];
  const minusDMList = [];

  for (let i = 1; i < bars.length; i++) {
    const cur = bars[i];
    const prev = bars[i - 1];
    const tr = Math.max(cur.h - cur.l, Math.abs(cur.h - prev.c), Math.abs(cur.l - prev.c));
    const upMove = cur.h - prev.h;
    const downMove = prev.l - cur.l;
    trList.push(tr);
    plusDMList.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDMList.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  if (trList.length < period) return { adx: 0, plusDI: 0, minusDI: 0 };

  // Wilder's smoothing for TR, +DM, -DM
  let smoothTR = trList.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothPlusDM = plusDMList.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothMinusDM = minusDMList.slice(0, period).reduce((a, b) => a + b, 0);

  const dxList = [];

  for (let i = period; i < trList.length; i++) {
    if (i > period) {
      smoothTR = smoothTR - smoothTR / period + trList[i];
      smoothPlusDM = smoothPlusDM - smoothPlusDM / period + plusDMList[i];
      smoothMinusDM = smoothMinusDM - smoothMinusDM / period + minusDMList[i];
    }
    const plusDI = smoothTR > 0 ? (smoothPlusDM / smoothTR) * 100 : 0;
    const minusDI = smoothTR > 0 ? (smoothMinusDM / smoothTR) * 100 : 0;
    const diSum = plusDI + minusDI;
    const dx = diSum > 0 ? (Math.abs(plusDI - minusDI) / diSum) * 100 : 0;
    dxList.push({ dx, plusDI, minusDI });
  }

  if (dxList.length === 0) return { adx: 0, plusDI: 0, minusDI: 0 };

  // ADX = smoothed average of DX over `period` values
  const adxSlice = dxList.slice(-period);
  const adx = adxSlice.reduce((a, b) => a + b.dx, 0) / adxSlice.length;
  const last = dxList[dxList.length - 1];

  return { adx: parseFloat(adx.toFixed(2)), plusDI: parseFloat(last.plusDI.toFixed(2)), minusDI: parseFloat(last.minusDI.toFixed(2)) };
}

/**
 * Simple Moving Average from a price array.
 */
function calcSMA(prices, period) {
  if (prices.length < period) return prices[prices.length - 1] || 0;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

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

    cache = { result, fetchedAt: Date.now(), bars };
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

// ── 8-State Regime Classification (Phase 1 — observation only) ──
// States: BULL_TRENDING, BULL_WEAKENING, BULL_PULLBACK,
//         BEAR_RALLY, BEAR_TRENDING, BEAR_EXHAUSTED,
//         CAPITULATION, FLAT
const REGIME_LABELS = {
  BULL_TRENDING:   'Bull Trending',
  BULL_WEAKENING:  'Bull Weakening',
  BULL_PULLBACK:   'Bull Pullback',
  BEAR_RALLY:      'Bear Rally',
  BEAR_TRENDING:   'Bear Trending',
  BEAR_EXHAUSTED:  'Bear Exhausted',
  CAPITULATION:    'Capitulation',
  FLAT:            'Flat / Ranging',
};

/**
 * Detailed 8-state regime classification.
 * Uses BTC daily bars + Fear & Greed to classify the current market state.
 * Cached for 15 minutes (same cadence as gate/regime).
 *
 * @param {string} apiKey
 * @param {string} secretKey
 * @param {string} [streamHandle]
 * @returns {Promise<{ state, label, signals: { adx, atrRatio, rsi, sma5, sma20, btc24hPct, gapPct, fng } }>}
 */
async function getDetailedRegime(apiKey, secretKey, streamHandle) {
  if (detailedRegimeCache && (Date.now() - detailedRegimeCache.fetchedAt) < DETAILED_REGIME_TTL) {
    return detailedRegimeCache.result;
  }

  // Ensure gate data is fresh (this populates cache.bars)
  await isBtcGateOpen(apiKey, secretKey, streamHandle);

  const bars = cache?.bars;
  if (!bars || bars.length < 21) {
    const fallback = { state: 'FLAT', label: REGIME_LABELS.FLAT, signals: {} };
    return fallback;
  }

  // Fetch Fear & Greed (reuse fngCache)
  let fngValue = 50;
  if (fngCache && (Date.now() - fngCache.fetchedAt) < FNG_CACHE_TTL) {
    fngValue = fngCache.result.value;
  } else {
    try {
      const res = await axios.get('https://api.alternative.me/fng/');
      fngValue = parseInt(res.data.data[0].value);
      const label = res.data.data[0].value_classification;
      fngCache = { result: { value: fngValue, label }, fetchedAt: Date.now() };
    } catch {
      fngValue = 50;
    }
  }

  const closes = bars.map(b => b.c);
  const latestPrice = cache.result.btcPrice || closes[closes.length - 1];
  const sma50 = cache.result.sma50 || (closes.reduce((a, b) => a + b, 0) / closes.length);
  const sma5 = calcSMA(closes, 5);
  const sma20 = calcSMA(closes, 20);
  const rsi = calcRSI(closes);
  const { adx } = calcADX(bars);
  const atr14 = calcATR(bars, 14);
  const atr20Avg = calcATR(bars, 20);
  const atrRatio = atr20Avg > 0 ? atr14 / atr20Avg : 1;

  // BTC 24h % change (latest bar close vs previous bar close)
  const prevClose = closes.length >= 2 ? closes[closes.length - 2] : closes[closes.length - 1];
  const btc24hPct = prevClose > 0 ? ((latestPrice - prevClose) / prevClose) * 100 : 0;

  // Gap from SMA50 as %
  const gapPct = sma50 > 0 ? ((latestPrice - sma50) / sma50) * 100 : 0;

  const aboveMA = latestPrice > sma50;
  const sma5AboveSma20 = sma5 > sma20;

  // ── Classification logic ──
  let state;

  // CAPITULATION: extreme fear + big drawdown
  if (fngValue < 15 && gapPct < -10) {
    state = 'CAPITULATION';
  }
  // BULL states (price above 50-SMA)
  else if (aboveMA) {
    if (adx > 25 && sma5AboveSma20) {
      state = 'BULL_TRENDING';    // Strong trend, short MA leading
    } else if (adx > 25 && !sma5AboveSma20) {
      state = 'BULL_PULLBACK';    // Trending but short-term weakness
    } else if (adx <= 25 && rsi > 60) {
      state = 'BULL_WEAKENING';   // Weak trend, momentum fading but still bullish
    } else if (adx <= 25 && rsi <= 60) {
      state = 'FLAT';             // No trend, no momentum
    } else {
      state = 'BULL_TRENDING';    // Default bull
    }
  }
  // BEAR states (price below 50-SMA)
  else {
    if (fngValue < 20 && btc24hPct < -5) {
      state = 'CAPITULATION';     // Near-capitulation even if gap isn't extreme
    } else if (adx > 25 && !sma5AboveSma20) {
      state = 'BEAR_TRENDING';    // Strong downtrend
    } else if (adx > 25 && sma5AboveSma20) {
      state = 'BEAR_RALLY';       // Counter-trend bounce within bear
    } else if (adx <= 25 && rsi < 35) {
      state = 'BEAR_EXHAUSTED';   // Weak trend, oversold — potential bottom
    } else if (adx <= 25 && rsi >= 35) {
      state = 'FLAT';             // No clear direction
    } else {
      state = 'BEAR_TRENDING';    // Default bear
    }
  }

  const signals = {
    adx,
    atrRatio: parseFloat(atrRatio.toFixed(2)),
    rsi: parseFloat(rsi.toFixed(1)),
    sma5: parseFloat(sma5.toFixed(2)),
    sma20: parseFloat(sma20.toFixed(2)),
    btc24hPct: parseFloat(btc24hPct.toFixed(2)),
    gapPct: parseFloat(gapPct.toFixed(2)),
    fng: fngValue,
  };

  const result = { state, label: REGIME_LABELS[state], signals };
  detailedRegimeCache = { result, fetchedAt: Date.now() };
  return result;
}

module.exports = { isBtcGateOpen, getMarketRegime, getDetailedRegime };
