// Crash-protected hold (v2, with position-driven hysteresis).
//
// Rules:
//   - Default state is LONG the symbol.
//   - EXIT only if the last N bars *all* classify as bear.
//   - RE-ENTER only if the last N bars *none* classify as bear.
//   - Otherwise hold current position.
//
// The hysteresis is encoded via the current position state — not external
// flags. If we're in a position, we must have last entered during a
// non-bear spell, so we require N consecutive bear bars to give up. If
// we're flat, we must have last exited during a bear, so we require N
// consecutive non-bear bars to get back in. This filters the dead-cat-
// bounce chop that destroyed v1 in 2022.

import { classifyRegime } from '../regime.js';
import type { Signal, Strategy, StrategyContext } from '../types.js';

const DEFAULTS = {
  fastPeriod: 168,             // 7 days on 1H
  slowPeriod: 720,             // 30 days on 1H
  bullThresholdPct: 1.5,
  bearThresholdPct: -1.5,
  confirmationBars: 72,        // 3 days on 1H — must last to switch
  allocationPctOfEquity: 99,
};

export const crashProtectedHoldStrategy: Strategy = {
  name: 'hold-crash-protected',
  defaultParams: DEFAULTS,
  paramGrid: [
    { name: 'fastPeriod', values: [120, 168, 240] },
    { name: 'slowPeriod', values: [480, 720, 1200] },
    { name: 'bearThresholdPct', values: [-3.0, -1.5, -0.5] },
    { name: 'confirmationBars', values: [24, 72, 144] },
  ],

  onBar(ctx: StrategyContext): Signal {
    const { history, position, params, equity } = ctx;

    const snap = classifyRegime(history, {
      fastPeriod: params.fastPeriod!,
      slowPeriod: params.slowPeriod!,
      bullThresholdPct: params.bullThresholdPct ?? DEFAULTS.bullThresholdPct,
      bearThresholdPct: params.bearThresholdPct!,
      confirmationBars: params.confirmationBars!,
    });

    const factors = [
      { name: 'regime_instant', value: regimeCode(snap.regime), note: snap.regime },
      { name: 'regime_confirmed', value: regimeCode(snap.confirmed), note: snap.confirmed },
      { name: 'trend_pct', value: +snap.trendPct.toFixed(2) },
      { name: 'sma_fast', value: +snap.smaFast.toFixed(2) },
      { name: 'sma_slow', value: +snap.smaSlow.toFixed(2) },
      {
        name: 'bear_bars_in_window',
        value: snap.recentRaws.filter(r => r === 'bear').length,
      },
    ];

    if (snap.confirmed === 'unknown' && snap.recentRaws.length === 0) {
      // Still warming up — no confirmation window yet.
      return { action: 'hold', reason: 'warming up regime', factors };
    }

    // ── Position-status-driven hysteresis ────────────────────
    // If we hold a position, only bail out when the last N bars are ALL bear.
    // If we're flat, only step in when the last N bars are ALL non-bear.
    const allBear =
      snap.recentRaws.length > 0 &&
      snap.recentRaws.every(r => r === 'bear');
    const noneBear =
      snap.recentRaws.length > 0 &&
      snap.recentRaws.every(r => r !== 'bear');

    if (position) {
      if (allBear) {
        return {
          action: 'exit',
          reason: `${snap.recentRaws.length}-bar bear streak (${snap.reason})`,
          factors,
        };
      }
      return {
        action: 'hold',
        reason: `holding through ${snap.regime} (${snap.recentRaws.filter(r => r === 'bear').length}/${snap.recentRaws.length} bar(s) bear)`,
        factors,
      };
    }

    // Not in position — require an all-clear window.
    if (noneBear) {
      const sizeUsd = equity * (params.allocationPctOfEquity! / 100);
      return {
        action: 'enter',
        sizeUsd,
        reason: `${snap.recentRaws.length}-bar non-bear window (${snap.reason})`,
        factors,
      };
    }

    return {
      action: 'hold',
      reason: `staying flat — ${snap.recentRaws.filter(r => r === 'bear').length}/${snap.recentRaws.length} bar(s) bear`,
      factors,
    };
  },
};

function regimeCode(r: string): number {
  if (r === 'bull') return 1;
  if (r === 'bear') return -1;
  if (r === 'sideways') return 0;
  return 99;
}
