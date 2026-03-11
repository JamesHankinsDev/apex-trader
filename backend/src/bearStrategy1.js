// src/bearStrategy1.js - Dead Cat Bounce Anticipation strategy for Experiment 1
// Enters when conditions PREDICT an imminent panic bottom — before capitulation confirms.

const alpaca = require('./alpaca');
const { calcRSI } = require('./strategy');

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

/**
 * Evaluate whether a dead cat bounce entry is warranted.
 *
 * @param {object} signals - Enriched signal object (used for price)
 * @param {object} regime - Object returned by getMarketRegime()
 * @param {string} coin - Symbol e.g. 'BTC/USD'
 * @returns {Promise<object|null>} Entry signal or null
 */
async function evaluateBearEntry1(signals, regime, coin) {
  const symbol = coin || signals.symbol;
  const apiKey = process.env.EXPERIMENT_1_ALPACA_API_KEY;
  const secretKey = process.env.EXPERIMENT_1_ALPACA_SECRET_KEY;

  if (!apiKey || !secretKey) {
    console.log(`[EXP1][BEAR] Missing API credentials — skipping ${symbol}`);
    return null;
  }

  // Fetch 48 x 1-hour bars
  let bars;
  try {
    bars = await alpaca.getCryptoBars(
      apiKey, secretKey, symbol, '1Hour', 48, FORTY_EIGHT_HOURS_MS + 4 * 60 * 60 * 1000
    );
  } catch (err) {
    console.log(`[EXP1][BEAR] Failed to fetch hourly bars for ${symbol}: ${err.message}`);
    return null;
  }

  if (!bars || bars.length < 15) {
    console.log(`[EXP1][BEAR] Insufficient bar data for ${symbol} — ${bars?.length || 0} bars`);
    return null;
  }

  const currentPrice = signals.price || bars[bars.length - 1].c;

  // CONDITION 1 — Sustained extreme fear
  if (!regime.fearGreed || regime.fearGreed.value >= 15) {
    console.log(`[EXP1][BEAR] Fear & Greed ${regime.fearGreed?.value ?? '?'} not extreme enough (needs <15)`);
    return null;
  }

  // CONDITION 2 — RSI crosses below 25 on the hourly
  const closes = bars.map(b => b.c);
  const rsi = calcRSI(closes);
  if (rsi >= 25) {
    console.log(`[EXP1][BEAR] RSI ${rsi.toFixed(1)} not deep enough (needs <25)`);
    return null;
  }

  // CONDITION 3 — Price at or within 2% above a major support level
  const lowestClose = Math.min(...closes);
  if (currentPrice > lowestClose * 1.02) {
    console.log(`[EXP1][BEAR] Price ${currentPrice.toFixed(2)} not near support ${lowestClose.toFixed(2)}`);
    return null;
  }

  // CONDITION 4 — 3 or more consecutive red candles before current bar
  let redCount = 0;
  for (let i = bars.length - 2; i >= 0; i--) {
    if (bars[i].c < bars[i].o) {
      redCount++;
    } else {
      break;
    }
  }
  if (redCount < 3) {
    console.log(`[EXP1][BEAR] Insufficient red candles (${redCount})`);
    return null;
  }

  // CONDITION 5 — Current bar shows early reversal
  const currentBar = bars[bars.length - 1];
  const body = Math.abs(currentBar.c - currentBar.o);
  const lowerWick = Math.min(currentBar.o, currentBar.c) - currentBar.l;
  const isGreen = currentBar.c > currentBar.o;
  const hasRejectionWick = body > 0 ? lowerWick > 1.5 * body : lowerWick > 0;

  if (!isGreen && !hasRejectionWick) {
    console.log(`[EXP1][BEAR] No reversal signal on current bar`);
    return null;
  }

  console.log(`[EXP1][BEAR] Dead cat setup — RSI:${rsi.toFixed(1)} Support:${lowestClose.toFixed(2)} Reds:${redCount} Reversal confirmed`);

  return {
    entry: true,
    type: 'dead_cat_bounce',
    takeProfit: 0.15,
    stopLoss: 0.07,
    maxHold: '36h',
    regime: 'bear',
  };
}

module.exports = { evaluateBearEntry1 };
