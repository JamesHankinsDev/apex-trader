// src/mean-reversion-strategy.js - Mean Reversion + Momentum Hybrid Strategy
//
// ENTRY (Contrarian): Buy when price dips below 24h average, confirmed by
//   oversold RSI and elevated volume (capitulation signal).
//
// HOLD  (Momentum): Stay in while short-term momentum is positive —
//   rising rate of change, no consecutive dips.
//
// EXIT  (Momentum Exhaustion): Sell when above average AND momentum fades —
//   consecutive minute-over-minute dips, declining volume, or RSI overbought.

// ─── INDICATORS ─────────────────────────────────────────────

/**
 * RSI (Relative Strength Index) using Wilder's smoothing.
 */
function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return 50; // neutral when insufficient data

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
 * Rate of change over `n` bars (percentage).
 */
function calcROC(closes, n = 5) {
  if (closes.length < n + 1) return 0;
  const prev = closes[closes.length - 1 - n];
  const curr = closes[closes.length - 1];
  return prev > 0 ? parseFloat((((curr - prev) / prev) * 100).toFixed(3)) : 0;
}

// ─── EXIT DECISION ──────────────────────────────────────────

/**
 * Multi-signal momentum exhaustion check.
 * Requires 2+ of these to confirm a sell (or 3+ consecutive dips alone):
 *   - 2+ consecutive minute-over-minute dips
 *   - Hourly RSI overbought (>70)
 *   - Negative minute-level rate of change
 *   - Volume fading (recent vol < 70% of prior)
 *   - Minute RSI overbought (>75)
 */
function shouldExit(consecutiveDips, rsi, minuteRSI, minuteROC, volumeFading) {
  if (consecutiveDips >= 3) return true; // strong single signal

  let exitSignals = 0;
  if (consecutiveDips >= 2) exitSignals++;
  if (rsi > 70) exitSignals++;
  if (minuteROC < -0.05) exitSignals++;
  if (volumeFading) exitSignals++;
  if (minuteRSI > 75) exitSignals++;

  return exitSignals >= 2;
}

// ─── MAIN EVALUATOR ─────────────────────────────────────────

function evaluate(symbol, hourlyBars, currentPrice, minuteBars, dipThreshold = 0.015) {
  if (!hourlyBars || hourlyBars.length < 6 || !currentPrice || currentPrice <= 0) {
    return {
      symbol, price: currentPrice || 0, avg24h: 0, deviation: 0,
      signal: 'hold', trend: 'unknown', rsi: 50, minuteRSI: 50, minuteROC: 0,
      consecutiveDips: 0, volumeFading: false, volRatio: 1,
      reasons: ['Insufficient data'],
    };
  }

  // ── 24-hour mean ──
  const hourlyCloses = hourlyBars.map(b => b.c);
  const avg24h = hourlyCloses.reduce((a, b) => a + b, 0) / hourlyCloses.length;
  const deviation = (currentPrice - avg24h) / avg24h;

  // ── RSI from hourly bars ──
  const rsi = calcRSI(hourlyCloses);

  // ── Minute-bar momentum ──
  let consecutiveDips = 0;
  let trend = 'flat';
  let minuteROC = 0;
  let minuteRSI = 50;
  let volumeFading = false;

  if (minuteBars && minuteBars.length >= 3) {
    const recent = minuteBars.slice(-10);
    const minuteCloses = recent.map(b => b.c);

    // Consecutive dips from the end
    for (let i = recent.length - 1; i > 0; i--) {
      if (recent[i].c < recent[i - 1].c) consecutiveDips++;
      else break;
    }

    // Short-term trend
    const last = recent[recent.length - 1].c;
    const first = recent[0].c;
    trend = last > first ? 'rising' : last < first ? 'falling' : 'flat';

    // Minute-level ROC and RSI
    minuteROC = calcROC(minuteCloses, Math.min(5, minuteCloses.length - 1));
    minuteRSI = calcRSI(minuteCloses, Math.min(6, minuteCloses.length - 2));

    // Volume trend: last 3 bars vs previous 3 bars
    if (recent.length >= 6) {
      const recentVol = recent.slice(-3).reduce((a, b) => a + (b.v || 0), 0) / 3;
      const priorVol = recent.slice(-6, -3).reduce((a, b) => a + (b.v || 0), 0) / 3;
      volumeFading = priorVol > 0 && recentVol < priorVol * 0.7;
    }
  }

  // ── Hourly volume context ──
  const recentHourlyVol = hourlyBars.slice(-3).reduce((a, b) => a + b.v, 0) / 3;
  const avgHourlyVol = hourlyBars.reduce((a, b) => a + b.v, 0) / hourlyBars.length;
  const volRatio = avgHourlyVol > 0 ? recentHourlyVol / avgHourlyVol : 1;

  // ── SIGNAL LOGIC ──────────────────────────────────────────

  const reasons = [];
  let signal = 'hold';

  // ── ENTRY: Mean Reversion with momentum confirmation ──
  if (deviation <= -dipThreshold) {
    let entryScore = 0;
    entryScore += Math.min(Math.abs(deviation) / dipThreshold, 3); // 1-3 pts for dip depth
    if (rsi < 35) entryScore += 2;         // hourly RSI oversold
    else if (rsi < 45) entryScore += 1;
    if (minuteRSI < 30) entryScore += 1;   // minute RSI deeply oversold
    if (volRatio > 1.3) entryScore += 1;   // volume spike (capitulation)
    if (trend === 'rising') entryScore += 1; // already bouncing

    if (entryScore >= 2) {
      signal = 'buy';
      reasons.push(
        `${(deviation * 100).toFixed(2)}% below avg`,
        `RSI ${rsi}`,
        `score ${entryScore.toFixed(1)}/8`
      );
    } else {
      reasons.push(`${(deviation * 100).toFixed(2)}% below avg · weak (${entryScore.toFixed(1)}/8)`);
    }

  // ── EXIT: Momentum Exhaustion (multi-signal confirmation) ──
  } else if (deviation >= 0 && shouldExit(consecutiveDips, rsi, minuteRSI, minuteROC, volumeFading)) {
    signal = 'sell';
    reasons.push(
      `+${(deviation * 100).toFixed(2)}% above avg`,
      `${consecutiveDips} dips`,
      `RSI ${rsi}`,
      `ROC ${minuteROC > 0 ? '+' : ''}${minuteROC}%`
    );
    if (volumeFading) reasons.push('vol fading');

  // ── HOLD: Riding momentum upward ──
  } else if (deviation >= 0) {
    reasons.push(
      `+${(deviation * 100).toFixed(2)}% above avg`,
      `${trend}`,
      `RSI ${rsi}`,
      `ROC ${minuteROC > 0 ? '+' : ''}${minuteROC}%`
    );

  // ── WAITING: Below average but not deep enough ──
  } else {
    reasons.push(`${(deviation * 100).toFixed(2)}% from avg`, `RSI ${rsi}`, 'waiting');
  }

  return {
    symbol,
    price: currentPrice,
    avg24h: parseFloat(avg24h.toFixed(6)),
    deviation: parseFloat((deviation * 100).toFixed(2)),
    volRatio: parseFloat(volRatio.toFixed(2)),
    trend,
    consecutiveDips,
    rsi,
    minuteRSI,
    minuteROC,
    volumeFading,
    signal,
    reasons,
  };
}

module.exports = { evaluate, calcRSI, calcROC };
