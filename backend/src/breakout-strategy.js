// src/breakout-strategy.js - 20-Bar Momentum Breakout Strategy (4-hour candles)
//
// ENTRY: All 4 conditions must be true:
//   1. Price > 20-bar high (breakout)
//   2. Volume > 1.5x 20-bar average (confirmation)
//   3. Price > 50-bar SMA (trend filter)
//   4. RSI(14) between 52-72 (momentum, not overbought)
//
// EXIT: Trailing stop (15%), hard stop (20%), take profit (45%), time (72h)

/**
 * RSI using Wilder's smoothing.
 */
function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return 50;

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const delta = closes[i] - closes[i - 1];
    if (delta > 0) avgGain += delta;
    else avgLoss += Math.abs(delta);
  }
  avgGain /= period;
  avgLoss /= period;

  for (let i = period + 1; i < closes.length; i++) {
    const delta = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (delta > 0 ? delta : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (delta < 0 ? Math.abs(delta) : 0)) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return parseFloat((100 - 100 / (1 + rs)).toFixed(2));
}

/**
 * Evaluate breakout signal for a symbol.
 *
 * @param {string} symbol
 * @param {Array} bars - 4-hour OHLCV bars (need at least 50 for SMA50)
 * @param {number} currentPrice - live price
 * @returns {{ symbol, price, signal, breakoutHigh, volumeRatio, sma50, rsi, conditions, reasons }}
 */
function evaluate(symbol, bars, currentPrice) {
  if (!bars || bars.length < 21 || !currentPrice || currentPrice <= 0) {
    return {
      symbol, price: currentPrice || 0, signal: 'hold',
      breakoutHigh: 0, volumeRatio: 0, sma50: 0, rsi: 50,
      conditions: { breakout: false, volume: false, trend: false, rsi: false },
      reasons: ['Insufficient data'],
    };
  }

  const closes = bars.map(b => b.c);
  const highs = bars.map(b => b.h);
  const volumes = bars.map(b => b.v);

  // 1. 20-bar high (excluding current bar — look at previous 20)
  const lookbackHighs = highs.slice(-21, -1);
  const breakoutHigh = Math.max(...lookbackHighs);
  const isBreakout = currentPrice > breakoutHigh;

  // 2. Volume confirmation: current bar volume > 1.5x 20-bar average
  const recentVols = volumes.slice(-20);
  const avgVolume = recentVols.reduce((a, b) => a + b, 0) / recentVols.length;
  const currentVolume = volumes[volumes.length - 1] || 0;
  const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 0;
  const isVolumeConfirmed = volumeRatio > 1.5;

  // 3. Trend filter: price above 50-bar SMA
  let sma50 = 0;
  if (closes.length >= 50) {
    sma50 = closes.slice(-50).reduce((a, b) => a + b, 0) / 50;
  } else {
    sma50 = closes.reduce((a, b) => a + b, 0) / closes.length;
  }
  const isTrendUp = currentPrice > sma50;

  // 4. RSI filter: between 52-72
  const rsi = calcRSI(closes);
  const isRsiValid = rsi >= 52 && rsi <= 72;

  const conditions = {
    breakout: isBreakout,
    volume: isVolumeConfirmed,
    trend: isTrendUp,
    rsi: isRsiValid,
  };

  const allConditionsMet = isBreakout && isVolumeConfirmed && isTrendUp && isRsiValid;
  const signal = allConditionsMet ? 'buy' : 'hold';

  const reasons = [];
  if (isBreakout) reasons.push(`Breakout above $${breakoutHigh < 1 ? breakoutHigh.toFixed(4) : breakoutHigh.toFixed(2)}`);
  else reasons.push(`Below 20-bar high ($${breakoutHigh < 1 ? breakoutHigh.toFixed(4) : breakoutHigh.toFixed(2)})`);

  if (isVolumeConfirmed) reasons.push(`Vol ${volumeRatio.toFixed(1)}x avg`);
  else reasons.push(`Vol ${volumeRatio.toFixed(1)}x (need >1.5x)`);

  if (isTrendUp) reasons.push(`Above SMA50`);
  else reasons.push(`Below SMA50`);

  reasons.push(`RSI ${rsi}${isRsiValid ? '' : ' (need 52-72)'}`);

  return {
    symbol,
    price: currentPrice,
    signal,
    breakoutHigh: parseFloat(breakoutHigh < 1 ? breakoutHigh.toFixed(6) : breakoutHigh.toFixed(2)),
    volumeRatio: parseFloat(volumeRatio.toFixed(2)),
    sma50: parseFloat(sma50 < 1 ? sma50.toFixed(6) : sma50.toFixed(2)),
    rsi,
    conditions,
    reasons,
  };
}

module.exports = { evaluate, calcRSI };
