// Technical indicators. Pure functions over arrays of bars or closes.
// Ported from backend/src/strategy.js with type safety.

import type { Bar } from './types.js';

// Wilder-smoothed RSI. Returns 50 if not enough data (neutral).
export function rsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const delta = closes[i]! - closes[i - 1]!;
    if (delta > 0) gains += delta;
    else losses += -delta;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const delta = closes[i]! - closes[i - 1]!;
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? -delta : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// Simple moving average of the last `period` values. Falls back to the last
// value if history is shorter than `period`.
export function sma(values: number[], period: number): number {
  if (values.length === 0) return 0;
  if (values.length < period) return values[values.length - 1]!;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

// Average True Range over `period` bars. 0 if < 2 bars.
export function atr(bars: Bar[], period = 14): number {
  if (bars.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const bar = bars[i]!;
    const prev = bars[i - 1]!;
    trs.push(
      Math.max(
        bar.h - bar.l,
        Math.abs(bar.h - prev.c),
        Math.abs(bar.l - prev.c),
      ),
    );
  }
  const window = trs.slice(-period);
  return window.reduce((a, b) => a + b, 0) / window.length;
}

// Ratio of the most recent bar's volume to the average of the prior `period` bars.
// 1.0 = matches average, 2.0 = double average.
export function volumeRatio(bars: Bar[], period = 10): number {
  if (bars.length < 2) return 1;
  const recent = bars[bars.length - 1]!.v;
  const priorCount = Math.min(period, bars.length - 1);
  const prior = bars.slice(-priorCount - 1, -1);
  const avg = prior.reduce((a, b) => a + b.v, 0) / priorCount;
  return avg > 0 ? recent / avg : 1;
}

// Percentage return over the last `lookback` periods. 0 if insufficient data.
export function momentumPct(closes: number[], lookback = 10): number {
  if (closes.length < lookback + 1) return 0;
  const oldP = closes[closes.length - 1 - lookback]!;
  const nowP = closes[closes.length - 1]!;
  return ((nowP - oldP) / oldP) * 100;
}

// Convenience: most recent close.
export function lastClose(bars: Bar[]): number {
  if (bars.length === 0) return 0;
  return bars[bars.length - 1]!.c;
}
