// src/bearStrategy.js - Shared bear market (Channel Range Trading) strategy
// Used by all three bots when market regime is 'bear'.
// Identifies descending channels and trades bounces from support to resistance.

const alpaca = require('./alpaca');
const { calcRSI } = require('./strategy');

// In-memory cooldown map: coin → timestamp (set after stop-loss exits)
const bearCooldowns = new Map();

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
const COOLDOWN_MS = 8 * 60 * 60 * 1000; // 8 hours

// ─── LINEAR REGRESSION ─────────────────────────────────────────

function linearRegression(points) {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.y || 0 };
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (const { x, y } of points) {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n };
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function getYAtX(regression, x) {
  return regression.slope * x + regression.intercept;
}

// ─── SWING DETECTION ────────────────────────────────────────────

function findSwingHighs(bars) {
  const swings = [];
  for (let i = 2; i < bars.length - 2; i++) {
    if (bars[i].h > bars[i - 1].h && bars[i].h > bars[i - 2].h &&
        bars[i].h > bars[i + 1].h && bars[i].h > bars[i + 2].h) {
      swings.push({ index: i, value: bars[i].h });
    }
  }
  return swings.slice(-3); // 3 most recent
}

function findSwingLows(bars) {
  const swings = [];
  for (let i = 2; i < bars.length - 2; i++) {
    if (bars[i].l < bars[i - 1].l && bars[i].l < bars[i - 2].l &&
        bars[i].l < bars[i + 1].l && bars[i].l < bars[i + 2].l) {
      swings.push({ index: i, value: bars[i].l });
    }
  }
  return swings.slice(-3); // 3 most recent
}

// ─── CHANNEL DETECTION ──────────────────────────────────────────

function detectChannel(bars) {
  const swingHighs = findSwingHighs(bars);
  const swingLows = findSwingLows(bars);

  if (swingHighs.length < 2 || swingLows.length < 2) {
    return null;
  }

  const highPoints = swingHighs.map(s => ({ x: s.index, y: s.value }));
  const lowPoints = swingLows.map(s => ({ x: s.index, y: s.value }));

  const resistReg = linearRegression(highPoints);
  const supportReg = linearRegression(lowPoints);

  const latestIndex = bars.length - 1;
  const resistance = getYAtX(resistReg, latestIndex);
  const support = getYAtX(supportReg, latestIndex);

  return {
    resistance,
    support,
    resistReg,
    supportReg,
    latestIndex,
  };
}

// ─── GET CHANNEL DATA (for status endpoint) ─────────────────────

async function getChannelData(coin, apiKey, secretKey) {
  try {
    const bars = await alpaca.getCryptoBars(
      apiKey, secretKey, coin, '1Hour', 48, FORTY_EIGHT_HOURS_MS + 4 * 60 * 60 * 1000
    );
    if (!bars || bars.length < 10) return { support: null, resist: null, width: null, volRatio: null, rsi: null };

    const channel = detectChannel(bars);

    // Compute hourly volume ratio (same metric used by bear entry check)
    const currentVolume = bars[bars.length - 1].v;
    const volBars = bars.slice(-21, -1);
    const avgVolume = volBars.length > 0 ? volBars.reduce((a, b) => a + b.v, 0) / volBars.length : 0;
    const volRatio = avgVolume > 0 ? parseFloat((currentVolume / avgVolume).toFixed(2)) : null;

    // Compute hourly RSI (same metric used by bear entry check)
    const closes = bars.map(b => b.c);
    const rsi = closes.length >= 15 ? parseFloat(calcRSI(closes).toFixed(1)) : null;

    if (!channel) return { support: null, resist: null, width: null, volRatio, rsi };

    const width = ((channel.resistance - channel.support) / channel.support) * 100;
    return {
      support: parseFloat(channel.support.toFixed(2)),
      resist: parseFloat(channel.resistance.toFixed(2)),
      width: parseFloat(width.toFixed(2)),
      volRatio,
      rsi,
    };
  } catch {
    return { support: null, resist: null, width: null, volRatio: null, rsi: null };
  }
}

// ─── MAIN ENTRY EVALUATION ──────────────────────────────────────

/**
 * Evaluate whether a bear channel range trade entry is warranted.
 *
 * @param {object} signals - Enriched signal object from any bot (used for price)
 * @param {object} regime - Object returned by getMarketRegime()
 * @param {string} coin - Symbol e.g. 'BTC/USD'
 * @param {object} [options] - Optional overrides
 * @param {number} [options.rsiOverride] - Override RSI threshold (default 40)
 * @param {string} [options.apiKey] - Alpaca API key
 * @param {string} [options.secretKey] - Alpaca secret key
 * @returns {Promise<object|null>} Entry signal or null
 */
async function evaluateBearEntry(signals, regime, coin, options = {}) {
  const symbol = coin || signals.symbol;
  const rsiThreshold = options.rsiOverride || 40;
  const apiKey = options.apiKey;
  const secretKey = options.secretKey;

  if (!apiKey || !secretKey) {
    console.log(`[BEAR] Missing API credentials for channel detection — skipping ${symbol}`);
    return null;
  }

  // Cooldown check
  if (bearCooldowns.has(symbol)) {
    const elapsed = Date.now() - bearCooldowns.get(symbol);
    if (elapsed < COOLDOWN_MS) {
      const hoursRemaining = ((COOLDOWN_MS - elapsed) / (60 * 60 * 1000)).toFixed(1);
      console.log(`[BEAR] ${symbol} in cooldown — ${hoursRemaining}h remaining`);
      return null;
    }
    bearCooldowns.delete(symbol);
  }

  // Fetch 48 hourly bars for channel detection
  let bars;
  try {
    bars = await alpaca.getCryptoBars(
      apiKey, secretKey, symbol, '1Hour', 48, FORTY_EIGHT_HOURS_MS + 4 * 60 * 60 * 1000
    );
  } catch (err) {
    console.log(`[BEAR] Failed to fetch hourly bars for ${symbol}: ${err.message}`);
    return null;
  }

  if (!bars || bars.length < 10) {
    console.log(`[BEAR] Insufficient bar data for ${symbol} — ${bars?.length || 0} bars`);
    return null;
  }

  // Detect channel
  const channel = detectChannel(bars);
  if (!channel) {
    console.log(`[BEAR] Channel not established for ${symbol} — insufficient swings`);
    return null;
  }

  const { resistance, support, resistReg } = channel;
  const channelWidth = ((resistance - support) / support) * 100;

  // Channel width validation
  if (channelWidth < 5) {
    console.log(`[BEAR] Channel too tight for ${symbol} — ${channelWidth.toFixed(2)}% (needs 5%)`);
    return null;
  }

  const currentPrice = signals.price || bars[bars.length - 1].c;

  // CONDITION 1 — Price near channel support (but NOT below it — broken support = abort)
  if (currentPrice < support) {
    console.log(`[BEAR] ${symbol} BELOW support — support broken at ${support.toFixed(2)}, price ${currentPrice.toFixed(2)}`);
    return null;
  }
  if (currentPrice > support * 1.02) {
    console.log(`[BEAR] ${symbol} not near support — price ${currentPrice.toFixed(2)} vs support ${support.toFixed(2)}`);
    return null;
  }

  // CONDITION 2 — RSI oversold on hourly bars
  const closes = bars.map(b => b.c);
  const rsi = calcRSI(closes);
  if (rsi >= rsiThreshold) {
    console.log(`[BEAR] ${symbol} RSI ${rsi.toFixed(1)} not oversold enough (threshold ${rsiThreshold})`);
    return null;
  }

  // CONDITION 3 — Volume confirmation
  const currentVolume = bars[bars.length - 1].v;
  const volBars = bars.slice(-21, -1); // 20 bars before the current bar
  const avgVolume = volBars.length > 0 ? volBars.reduce((a, b) => a + b.v, 0) / volBars.length : 0;
  const volMultiple = avgVolume > 0 ? currentVolume / avgVolume : 0;
  if (volMultiple <= 1.5) {
    console.log(`[BEAR] ${symbol} volume ${volMultiple.toFixed(1)}x insufficient (needs 1.5x)`);
    return null;
  }

  // CONDITION 4 — Channel is descending
  const resistStart = getYAtX(resistReg, 0);
  const resistEnd = getYAtX(resistReg, bars.length - 1);
  if (resistEnd >= resistStart) {
    console.log(`[BEAR] ${symbol} channel not descending — skipping`);
    return null;
  }

  // Take profit: 80% of channel distance
  const targetPrice = support + ((resistance - support) * 0.80);
  const takeProfitPct = (targetPrice - currentPrice) / currentPrice;

  if (takeProfitPct < 0.05) {
    console.log(`[BEAR] ${symbol} channel too compressed for worthwhile trade (TP ${(takeProfitPct * 100).toFixed(1)}%)`);
    return null;
  }

  // Stop loss: 3% below support
  const stopLossPrice = support * 0.97;
  const stopLossPct = (currentPrice - stopLossPrice) / currentPrice;

  console.log(`[BEAR] Range entry signal — ${symbol}`);
  console.log(`  Channel: ${support.toFixed(2)} → ${resistance.toFixed(2)} (${channelWidth.toFixed(1)}%)`);
  console.log(`  TP: ${targetPrice.toFixed(2)} (+${(takeProfitPct * 100).toFixed(1)}%) SL: ${stopLossPrice.toFixed(2)} (-${(stopLossPct * 100).toFixed(1)}%)`);
  console.log(`  RSI: ${rsi.toFixed(1)} Vol: ${volMultiple.toFixed(1)}x`);

  return {
    entry: true,
    type: 'bear_range_trade',
    takeProfit: takeProfitPct,
    takeProfitPrice: targetPrice,
    stopLoss: stopLossPct,
    stopLossPrice: stopLossPrice,
    channelSupport: support,
    channelResist: resistance,
    channelWidth: channelWidth,
    maxHold: '48h',
    regime: 'bear',
    rsi,
    volMultiple,
  };
}

// ─── COOLDOWN MANAGEMENT ────────────────────────────────────────

function setBearCooldown(coin) {
  bearCooldowns.set(coin, Date.now());
  console.log(`[BEAR] Cooldown set for ${coin} — 8h`);
}

module.exports = { evaluateBearEntry, setBearCooldown, getChannelData };
