// Breakout-momentum strategy.
//
// Enter long when the close breaks above the highest high of the previous N
// bars AND volume is elevated (confirms conviction, not a stop-run). Exit on
// trailing stop from peak, hard stop from entry, or max hold.
//
// This is a trend-following mirror of RSI mean-reversion: where mean-reversion
// buys weakness and sells strength, breakout buys strength and sells weakness.
// Expect it to win in trending regimes and bleed in chop.

import { atr, volumeRatio } from '../indicators.js';
import type { Signal, Strategy, StrategyContext } from '../types.js';

const DEFAULTS = {
  breakoutLookback: 20,       // bars to measure "previous high" over
  minVolumeRatio: 1.5,         // current volume / avg(prev 10 bars)
  trailStopAtrMult: 2.0,       // trailing stop = peak - N*ATR
  hardStopPct: 3.0,            // hard stop from entry price
  maxHoldBars: 72,             // bail out if thesis hasn't played out
  minAtrPct: 0.2,              // skip dead-flat markets (ATR as % of price)
  allocationPctOfEquity: 95,
};

export const breakoutMomentumStrategy: Strategy = {
  name: 'breakout-momentum',
  defaultParams: DEFAULTS,
  paramGrid: [
    { name: 'breakoutLookback', values: [10, 20, 40] },
    { name: 'minVolumeRatio', values: [1.2, 1.5, 2.0] },
    { name: 'trailStopAtrMult', values: [1.5, 2.5] },
    { name: 'hardStopPct', values: [3.0, 5.0] },
  ], // 3×3×2×2 = 36 combinations per window

  onBar(ctx: StrategyContext): Signal {
    const { bar, history, position, params, equity } = ctx;
    const lookback = params.breakoutLookback!;
    if (history.length < lookback + 2) {
      return { action: 'hold', reason: 'warming up', factors: [] };
    }

    const atrVal = atr(history, 14);
    const atrPct = (atrVal / bar.c) * 100;
    const volRatio = volumeRatio(history, 10);

    const factors = [
      { name: 'atr_pct', value: +atrPct.toFixed(3) },
      { name: 'vol_ratio', value: +volRatio.toFixed(2) },
    ];

    // ── Exit logic ───────────────────────────────────────────
    if (position) {
      // Peak high since entry — derived from history, no external state needed
      // so the strategy is pure and re-entrant across backtests.
      const entryIdx = history.findIndex(b => b.t === position.entryT);
      let peak = position.entryPrice;
      for (let i = entryIdx; i < history.length; i++) {
        const h = history[i]!.h;
        if (h > peak) peak = h;
      }

      const pnlPct = ((bar.c - position.entryPrice) / position.entryPrice) * 100;
      const trailStopPrice = peak - atrVal * params.trailStopAtrMult!;
      const barsHeld = history.length - entryIdx;

      factors.push(
        { name: 'pnl_pct', value: +pnlPct.toFixed(2) },
        { name: 'peak_since_entry', value: +peak.toFixed(2) },
        { name: 'trail_stop', value: +trailStopPrice.toFixed(2) },
        { name: 'bars_held', value: barsHeld },
      );

      if (pnlPct <= -params.hardStopPct!) {
        return {
          action: 'exit',
          reason: `hard-stop at ${pnlPct.toFixed(2)}%`,
          factors,
        };
      }
      if (bar.c <= trailStopPrice) {
        return {
          action: 'exit',
          reason: `trail-stop (peak $${peak.toFixed(2)} → ${bar.c.toFixed(2)})`,
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

    // ── Entry logic: breakout above N-bar high with volume ───
    // Previous N-bar high, excluding the current bar.
    const priorWindow = history.slice(-lookback - 1, -1);
    let priorHigh = -Infinity;
    for (const b of priorWindow) if (b.h > priorHigh) priorHigh = b.h;

    const brokeOut = bar.c > priorHigh;
    const liveMarket = atrPct >= params.minAtrPct!;
    const volumeConfirmed = volRatio >= params.minVolumeRatio!;

    factors.push(
      { name: 'prior_high', value: +priorHigh.toFixed(2) },
      { name: 'close', value: bar.c },
      { name: 'broke_out', value: brokeOut ? 1 : 0 },
      { name: 'volume_confirmed', value: volumeConfirmed ? 1 : 0 },
      { name: 'live_market', value: liveMarket ? 1 : 0 },
    );

    if (brokeOut && volumeConfirmed && liveMarket) {
      const sizeUsd = equity * (params.allocationPctOfEquity! / 100);
      // Intrabar hard stop at hardStopPct below entry. The trailing stop is
      // still evaluated bar-by-bar since it requires tracking the peak-since-
      // entry, but the hard stop is a simple price level we can enforce live.
      const stopLoss = bar.c * (1 - params.hardStopPct! / 100);
      return {
        action: 'enter',
        sizeUsd,
        stopLoss,
        reason: `breakout +${((bar.c / priorHigh - 1) * 100).toFixed(2)}% above ${lookback}-bar high, vol x${volRatio.toFixed(2)}`,
        factors,
      };
    }

    return { action: 'hold', reason: 'no breakout', factors };
  },
};
