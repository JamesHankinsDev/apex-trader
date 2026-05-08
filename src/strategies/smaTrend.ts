// SMA trend-following strategy.
//
// Enter long on a "golden cross" — when SMA(fast) crosses above SMA(slow) with
// price also above the slow SMA. Exit on the opposite cross or a hard stop.
//
// This is the simplest trend-follower that exists: it's deliberately dumb so
// that complex strategies have to justify themselves against it.

import { sma } from '../indicators.js';
import type { Signal, Strategy, StrategyContext } from '../types.js';

const DEFAULTS = {
  fastPeriod: 10,
  slowPeriod: 30,
  hardStopPct: 4.0,
  maxHoldBars: 240,     // much longer than mean-reversion — trends take time
  cooldownBars: 3,
  allocationPctOfEquity: 95,
};

export const smaTrendStrategy: Strategy = {
  name: 'sma-trend',
  defaultParams: DEFAULTS,
  paramGrid: [
    { name: 'fastPeriod', values: [5, 10, 20] },
    { name: 'slowPeriod', values: [30, 50, 100] },
    { name: 'hardStopPct', values: [3.0, 4.0, 5.0] },
  ], // 3×3×3 = 27 combinations per window

  onBar(ctx: StrategyContext): Signal {
    const { bar, history, position, lastTrade, params, equity } = ctx;
    const closes = history.map(b => b.c);
    const fast = sma(closes, params.fastPeriod!);
    const slow = sma(closes, params.slowPeriod!);

    // Previous bar's SMAs, for cross detection.
    const prevCloses = closes.slice(0, -1);
    const prevFast = sma(prevCloses, params.fastPeriod!);
    const prevSlow = sma(prevCloses, params.slowPeriod!);

    const factors = [
      { name: 'sma_fast', value: +fast.toFixed(4) },
      { name: 'sma_slow', value: +slow.toFixed(4) },
      { name: 'prev_fast', value: +prevFast.toFixed(4) },
      { name: 'prev_slow', value: +prevSlow.toFixed(4) },
    ];

    // ── Exit logic ───────────────────────────────────────────
    if (position) {
      const pnlPct = ((bar.c - position.entryPrice) / position.entryPrice) * 100;
      const entryIdx = history.findIndex(b => b.t === position.entryT);
      const barsHeld = history.length - entryIdx;
      factors.push(
        { name: 'pnl_pct', value: +pnlPct.toFixed(2) },
        { name: 'bars_held', value: barsHeld },
      );

      const deathCross = prevFast >= prevSlow && fast < slow;
      if (deathCross) {
        return {
          action: 'exit',
          reason: `death-cross (fast ${fast.toFixed(2)} < slow ${slow.toFixed(2)})`,
          factors,
        };
      }
      if (pnlPct <= -params.hardStopPct!) {
        return {
          action: 'exit',
          reason: `hard-stop at ${pnlPct.toFixed(2)}%`,
          factors,
        };
      }
      if (barsHeld >= params.maxHoldBars!) {
        return {
          action: 'exit',
          reason: `max-hold ${barsHeld} bars`,
          factors,
        };
      }
      return { action: 'hold', reason: 'riding trend', factors };
    }

    // ── Cooldown after loss ──────────────────────────────────
    if (lastTrade && lastTrade.pnlUsd < 0) {
      const barsSinceExit = history.findIndex(b => b.t > lastTrade.exitT);
      const cooldownActive =
        barsSinceExit === -1 ||
        history.length - barsSinceExit < params.cooldownBars!;
      if (cooldownActive) {
        return {
          action: 'hold',
          reason: `cooldown after loss`,
          factors,
        };
      }
    }

    // ── Entry logic: golden cross with price above slow ──────
    const goldenCross = prevFast <= prevSlow && fast > slow;
    const priceConfirms = bar.c > slow;
    factors.push(
      { name: 'golden_cross', value: goldenCross ? 1 : 0 },
      { name: 'price_above_slow', value: priceConfirms ? 1 : 0 },
    );

    if (goldenCross && priceConfirms) {
      const sizeUsd = equity * (params.allocationPctOfEquity! / 100);
      // Hard stop at hardStopPct below entry — fires intrabar if breached.
      const stopLoss = bar.c * (1 - params.hardStopPct! / 100);
      return {
        action: 'enter',
        sizeUsd,
        stopLoss,
        reason: `golden-cross (fast ${fast.toFixed(2)} > slow ${slow.toFixed(2)}), price ${bar.c.toFixed(2)}`,
        factors,
      };
    }

    return { action: 'hold', reason: 'no cross', factors };
  },
};
