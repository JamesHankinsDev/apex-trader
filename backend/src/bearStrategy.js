// src/bearStrategy.js - Shared bear market (Capitulation Recovery) strategy
// Used by all three bots when market regime is 'bear'.
// All four conditions must pass for an entry signal.

/**
 * Evaluate whether a capitulation recovery entry is warranted.
 *
 * @param {object} signals - Enriched signal object from any bot. Must include:
 *   rsi14, volume, avgVolume20, open, high, low, close
 * @param {object} regime - Object returned by getMarketRegime()
 * @returns {object|null} Entry signal or null
 */
async function evaluateBearEntry(signals, regime) {
  // CONDITION 1 — Extreme Fear gate
  if (!regime.extremeFear) {
    console.log(`[BEAR] Skipping — Fear & Greed at ${regime.fearGreed.value}, not extreme`);
    return null;
  }

  // CONDITION 2 — RSI deeply oversold
  if (signals.rsi14 >= 28) {
    console.log(`[BEAR] Skipping — RSI at ${signals.rsi14}, not oversold enough`);
    return null;
  }

  // CONDITION 3 — Capitulation volume spike (3x average)
  const volMultiple = signals.avgVolume20 > 0 ? signals.volume / signals.avgVolume20 : 0;
  if (volMultiple <= 3.0) {
    console.log(`[BEAR] Skipping — volume ${volMultiple.toFixed(1)}x avg, needs 3x`);
    return null;
  }

  // CONDITION 4 — Rejection wick (lower wick > candle body)
  const isGreen = signals.close >= signals.open;
  const wick = isGreen ? (signals.close - signals.low) : (signals.open - signals.low);
  const body = Math.abs(signals.close - signals.open);
  if (wick <= body) {
    console.log('[BEAR] Skipping — no rejection wick detected');
    return null;
  }

  console.log(`[BEAR] Capitulation signal — RSI:${signals.rsi14} Vol:${volMultiple.toFixed(1)}x Fear:${regime.fearGreed.value} Wick confirmed`);

  return {
    entry: true,
    type: 'capitulation_recovery',
    takeProfit: 0.10,   // 10% — realistic bear bounce target
    stopLoss: 0.05,     // 5%  — tight, bear bounces can fail fast
    maxHold: '24h',     // shorter than any bull mode hold time
    regime: 'bear',
  };
}

module.exports = { evaluateBearEntry };
