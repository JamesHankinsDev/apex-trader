// src/strategy.js - Technical indicators & signal engine

// RSI calculation from price array
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
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? Math.abs(delta) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// Simple Moving Average
function calcSMA(prices, period) {
  if (prices.length < period) return prices[prices.length - 1];
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

// Average True Range (volatility proxy)
function calcATR(bars, period = 14) {
  if (bars.length < 2) return 0;
  const trs = bars.slice(1).map((bar, i) => {
    const prev = bars[i];
    return Math.max(
      bar.h - bar.l,
      Math.abs(bar.h - prev.c),
      Math.abs(bar.l - prev.c)
    );
  });
  return trs.slice(-period).reduce((a, b) => a + b, 0) / Math.min(period, trs.length);
}

// Volume ratio vs recent average
function calcVolumeRatio(bars, period = 10) {
  if (bars.length < 2) return 1;
  const recent = bars[bars.length - 1].v;
  const avg = bars.slice(-period - 1, -1).reduce((a, b) => a + b.v, 0) / Math.min(period, bars.length - 1);
  return avg > 0 ? recent / avg : 1;
}

// 1h price momentum %
function calcMomentum(prices, lookback = 10) {
  if (prices.length < lookback + 1) return 0;
  const old = prices[prices.length - 1 - lookback];
  const now = prices[prices.length - 1];
  return ((now - old) / old) * 100;
}

// Main signal evaluator
function evaluateSignal(symbol, bars, params) {
  const { rsiBuy, rsiSell } = params;

  if (!bars || bars.length < 5) {
    return { symbol, score: 50, rsi: 50, volumeRatio: 1, momentum: 0, price: 0, reasons: [] };
  }

  const closes = bars.map(b => b.c);
  const price = closes[closes.length - 1];
  const rsi = calcRSI(closes);
  const sma20 = calcSMA(closes, 20);
  const sma5 = calcSMA(closes, 5);
  const volumeRatio = calcVolumeRatio(bars);
  const momentum = calcMomentum(closes);
  const atr = calcATR(bars);
  const atrPct = price > 0 ? (atr / price) * 100 : 0;

  let score = 50;
  const reasons = [];

  // RSI signal (strongest weight)
  if (rsi < rsiBuy) {
    score += 25;
    reasons.push(`RSI ${rsi.toFixed(1)} — oversold`);
  } else if (rsi < rsiBuy + 10) {
    score += 10;
    reasons.push(`RSI ${rsi.toFixed(1)} — approaching oversold`);
  } else if (rsi > rsiSell) {
    score -= 30;
    reasons.push(`RSI ${rsi.toFixed(1)} — overbought`);
  }

  // Trend: SMA crossover
  if (sma5 > sma20) {
    score += 10;
    reasons.push('SMA5 > SMA20 (uptrend)');
  } else {
    score -= 10;
    reasons.push('SMA5 < SMA20 (downtrend)');
  }

  // Volume spike
  if (volumeRatio > 2.0) {
    score += 15;
    reasons.push(`Volume ×${volumeRatio.toFixed(1)} (strong spike)`);
  } else if (volumeRatio > 1.5) {
    score += 8;
    reasons.push(`Volume ×${volumeRatio.toFixed(1)} (above avg)`);
  }

  // Momentum
  if (momentum > 2) {
    score += 12;
    reasons.push(`+${momentum.toFixed(2)}% momentum`);
  } else if (momentum > 0.5) {
    score += 5;
  } else if (momentum < -3) {
    score -= 15;
    reasons.push(`${momentum.toFixed(2)}% momentum (falling)`);
  }

  // Volatility bonus (high ATR = more opportunity for aggressive strategy)
  if (atrPct > 2) {
    score += 5;
    reasons.push(`High volatility (ATR ${atrPct.toFixed(1)}%)`);
  }

  return {
    symbol,
    price,
    rsi: parseFloat(rsi.toFixed(2)),
    volumeRatio: parseFloat(volumeRatio.toFixed(2)),
    momentum: parseFloat(momentum.toFixed(2)),
    sma5: parseFloat(sma5.toFixed(4)),
    sma20: parseFloat(sma20.toFixed(4)),
    atrPct: parseFloat(atrPct.toFixed(2)),
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons,
  };
}

// Higher-timeframe trend confirmation (e.g., 1h bars)
// Returns { confirmed, bias, reasons } — confirmed=true means the larger trend agrees with a buy
function evaluateHigherTimeframe(bars) {
  if (!bars || bars.length < 5) {
    return { confirmed: true, bias: 'neutral', reasons: ['Insufficient HTF data — allowing entry'] };
  }

  const closes = bars.map(b => b.c);
  const rsi = calcRSI(closes);
  const sma5 = calcSMA(closes, 5);
  const sma20 = calcSMA(closes, 20);
  const momentum = calcMomentum(closes, Math.min(10, closes.length - 1));

  const reasons = [];
  let score = 0;

  // HTF trend direction (SMA alignment)
  if (sma5 > sma20) {
    score += 1;
    reasons.push('HTF uptrend (SMA5 > SMA20)');
  } else {
    score -= 1;
    reasons.push('HTF downtrend (SMA5 < SMA20)');
  }

  // HTF RSI — block entry if overbought on higher timeframe
  if (rsi > 75) {
    score -= 2;
    reasons.push(`HTF RSI ${rsi.toFixed(1)} — overbought`);
  } else if (rsi < 30) {
    score += 1;
    reasons.push(`HTF RSI ${rsi.toFixed(1)} — oversold`);
  }

  // HTF momentum
  if (momentum > 0.5) {
    score += 1;
    reasons.push(`HTF momentum +${momentum.toFixed(2)}%`);
  } else if (momentum < -1) {
    score -= 1;
    reasons.push(`HTF momentum ${momentum.toFixed(2)}%`);
  }

  const bias = score > 0 ? 'bullish' : score < 0 ? 'bearish' : 'neutral';
  // Confirmed if not bearish (allow neutral + bullish)
  const confirmed = score >= 0;

  return { confirmed, bias, reasons };
}

module.exports = { evaluateSignal, evaluateHigherTimeframe, calcRSI, calcSMA, calcVolumeRatio, calcMomentum };
