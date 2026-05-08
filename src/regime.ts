// Market regime classifier. Two outputs per snapshot:
//
//   regime    — the "instant" classification at the current bar only
//   confirmed — hysteresis-applied classification: only switches off the
//               default ('sideways') when the last N bars *all* agree on the
//               same non-sideways regime.
//
// The confirmed field exists because the instant classifier gets chopped to
// pieces in prolonged bears: every dead cat bounce briefly crosses into bull
// territory, triggering false exits. Requiring N consecutive bars of agreement
// filters out that noise while still catching genuine trend shifts.
//
// Efficient sliding-SMA implementation so cost is O(fastPeriod + slowPeriod +
// confirmationBars) per call, not O(bars × slowPeriod).

import { sma } from './indicators.js';
import type { Bar } from './types.js';

export type Regime = 'bull' | 'sideways' | 'bear' | 'unknown';

export interface RegimeParams {
  fastPeriod: number;
  slowPeriod: number;
  bullThresholdPct: number;
  bearThresholdPct: number;
  confirmationBars: number;
}

export const DEFAULT_REGIME_PARAMS: RegimeParams = {
  fastPeriod: 168,        // 7 days on 1H bars
  slowPeriod: 720,        // 30 days on 1H bars
  bullThresholdPct: 1.5,
  bearThresholdPct: -1.5,
  confirmationBars: 72,   // 3 days on 1H bars — filters typical dead cat bounces
};

export interface RegimeSnapshot {
  regime: Regime;         // instant snapshot (no hysteresis)
  confirmed: Regime;      // hysteresis-applied (requires N bars of agreement)
  trendPct: number;
  smaFast: number;
  smaSlow: number;
  price: number;
  recentRaws: Regime[];   // the last confirmationBars instant classifications
  reason: string;
}

function labelRegime(
  trendPct: number,
  bullT: number,
  bearT: number,
): Regime {
  if (trendPct > bullT) return 'bull';
  if (trendPct < bearT) return 'bear';
  return 'sideways';
}

export function classifyRegime(
  bars: Bar[],
  params: RegimeParams = DEFAULT_REGIME_PARAMS,
): RegimeSnapshot {
  const {
    fastPeriod,
    slowPeriod,
    bullThresholdPct,
    bearThresholdPct,
    confirmationBars,
  } = params;

  const n = bars.length;
  const price = n > 0 ? bars[n - 1]!.c : 0;

  if (n < slowPeriod + confirmationBars) {
    // Not enough history for a confirmed classification. Fall back to a
    // best-effort instant regime if we have the slow window, else unknown.
    if (n >= slowPeriod) {
      const closes = bars.map(b => b.c);
      const smaFast = sma(closes, fastPeriod);
      const smaSlow = sma(closes, slowPeriod);
      const trendPct = ((smaFast - smaSlow) / smaSlow) * 100;
      const instant = labelRegime(trendPct, bullThresholdPct, bearThresholdPct);
      return {
        regime: instant,
        confirmed: 'unknown',
        trendPct,
        smaFast,
        smaSlow,
        price,
        recentRaws: [],
        reason: `warming up (need ${confirmationBars} more bars for confirmation)`,
      };
    }
    return {
      regime: 'unknown',
      confirmed: 'unknown',
      trendPct: 0,
      smaFast: 0,
      smaSlow: 0,
      price,
      recentRaws: [],
      reason: `need ${slowPeriod} bars, have ${n}`,
    };
  }

  // Sliding SMAs. Compute sums at the position (n - confirmationBars), then
  // slide forward one bar at a time, recording the instant regime at each.
  const startIdx = n - confirmationBars;

  let sumFast = 0;
  for (let i = startIdx - fastPeriod; i < startIdx; i++) sumFast += bars[i]!.c;
  let sumSlow = 0;
  for (let i = startIdx - slowPeriod; i < startIdx; i++) sumSlow += bars[i]!.c;

  const recentRaws: Regime[] = [];
  let lastTrendPct = 0;
  let lastFast = 0;
  let lastSlow = 0;
  for (let i = startIdx; i < n; i++) {
    sumFast += bars[i]!.c - bars[i - fastPeriod]!.c;
    sumSlow += bars[i]!.c - bars[i - slowPeriod]!.c;
    const smaF = sumFast / fastPeriod;
    const smaS = sumSlow / slowPeriod;
    const trendPct = ((smaF - smaS) / smaS) * 100;
    const raw = labelRegime(trendPct, bullThresholdPct, bearThresholdPct);
    recentRaws.push(raw);
    lastTrendPct = trendPct;
    lastFast = smaF;
    lastSlow = smaS;
  }

  const instant = recentRaws[recentRaws.length - 1]!;
  // Confirmed = all recent bars agree on a non-sideways regime.
  // 'sideways' is the default / unconfirmed state — it means "don't act".
  const allAgree = recentRaws.every(r => r === recentRaws[0]);
  const confirmed: Regime =
    allAgree && recentRaws[0] !== 'sideways' ? recentRaws[0]! : 'sideways';

  const reason =
    confirmed === instant
      ? `${confirmed} confirmed (${confirmationBars} bars agree)`
      : `instant ${instant}, confirmed ${confirmed} (last ${confirmationBars} bars mixed)`;

  return {
    regime: instant,
    confirmed,
    trendPct: lastTrendPct,
    smaFast: lastFast,
    smaSlow: lastSlow,
    price,
    recentRaws,
    reason,
  };
}
