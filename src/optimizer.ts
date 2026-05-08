// Walk-forward parameter optimizer.
//
// Splits the data into rolling (in-sample, out-of-sample) windows. For each
// window: grid-search every parameter combination on IS, pick the best by
// objective, then evaluate THOSE parameters on OOS. The aggregate of OOS
// results is the honest estimate of future performance — it's never seen the
// parameters before they were chosen.
//
// Anti-overfit guards:
//   - minTrades: require the IS backtest to have taken at least N trades, so
//     we don't pick a combination that only entered once and got lucky.
//   - paramStability: report the stddev of chosen params across windows. If it
//     swings wildly, the "optimal" params are noise.

import type {
  BacktestSummary,
  Bar,
  ParamRange,
  SpreadModel,
  Strategy,
  Timeframe,
} from './types.js';
import { runBacktest } from './backtest.js';

export type Objective = 'sharpe' | 'return' | 'calmar';

export interface WalkForwardOptions {
  strategy: Strategy;
  symbol: string;
  timeframe: Timeframe;
  bars: Bar[];
  startingEquity: number;
  inSampleMs: number;
  outOfSampleMs: number;
  stepMs: number;
  objective: Objective;
  minTrades?: number;
  warmupBars?: number;
  spreadModel?: SpreadModel;
  onWindow?: (window: Window) => void; // progress callback
}

export interface Window {
  index: number;
  inSampleStart: number;
  inSampleEnd: number;
  oosStart: number;
  oosEnd: number;
  bestParams: Record<string, number> | null;
  bestIsObjective: number | null;
  isTradeCount: number;
  oosSummary: BacktestSummary | null;
  candidatesEvaluated: number;
}

export interface WalkForwardResult {
  strategy: string;
  symbol: string;
  objective: Objective;
  windows: Window[];
  aggregate: {
    totalWindows: number;
    completedWindows: number;
    profitableOosWindows: number;
    meanOosReturnPct: number;
    medianOosReturnPct: number;
    meanOosSharpe: number | null;
    totalOosTrades: number;
    // For each tuned parameter: mean, stddev, and coefficient of variation.
    // High CV means optimal params were unstable across windows ⇒ overfitting.
    paramStability: Record<
      string,
      { mean: number; stddev: number; cv: number; values: number[] }
    >;
  };
}

// Generate all combinations of a parameter grid.
export function combinations(grid: ParamRange[]): Record<string, number>[] {
  if (grid.length === 0) return [{}];
  const out: Record<string, number>[] = [];
  function recurse(idx: number, partial: Record<string, number>) {
    if (idx === grid.length) {
      out.push({ ...partial });
      return;
    }
    const range = grid[idx]!;
    for (const v of range.values) {
      partial[range.name] = v;
      recurse(idx + 1, partial);
    }
    delete partial[range.name];
  }
  recurse(0, {});
  return out;
}

function scoreObjective(summary: BacktestSummary, objective: Objective): number {
  switch (objective) {
    case 'return':
      return summary.totalReturnPct;
    case 'sharpe':
      return summary.sharpe ?? -Infinity;
    case 'calmar': {
      // annualized return / max drawdown; guard against zero dd
      if (summary.maxDrawdownPct <= 0.01) return summary.totalReturnPct;
      return summary.totalReturnPct / summary.maxDrawdownPct;
    }
  }
}

// Slice bars for a window with warmup padding from earlier bars.
// Returns the slice and how many of its leading bars are warmup (not evaluated).
function sliceWithWarmup(
  bars: Bar[],
  windowStartMs: number,
  windowEndMs: number,
  warmup: number,
): { slice: Bar[]; warmupBars: number } | null {
  // First bar at or after windowStart
  let startIdx = bars.findIndex(b => b.t >= windowStartMs);
  if (startIdx === -1) return null;
  // Last bar before windowEnd
  let endIdx = bars.findIndex(b => b.t >= windowEndMs);
  if (endIdx === -1) endIdx = bars.length;
  if (endIdx - startIdx < 2) return null;

  const warmupStart = Math.max(0, startIdx - warmup);
  const actualWarmup = startIdx - warmupStart;
  return { slice: bars.slice(warmupStart, endIdx), warmupBars: actualWarmup };
}

export function walkForward(opts: WalkForwardOptions): WalkForwardResult {
  const {
    strategy,
    symbol,
    timeframe,
    bars,
    startingEquity,
    inSampleMs,
    outOfSampleMs,
    stepMs,
    objective,
    minTrades = 5,
    warmupBars = 50,
    spreadModel,
    onWindow,
  } = opts;

  if (bars.length === 0) {
    throw new Error('walkForward: no bars provided');
  }
  if (!strategy.paramGrid || strategy.paramGrid.length === 0) {
    throw new Error(
      `Strategy "${strategy.name}" has no paramGrid — can't optimize`,
    );
  }

  const grid = combinations(strategy.paramGrid);
  const firstT = bars[0]!.t;
  const lastT = bars[bars.length - 1]!.t;

  const windows: Window[] = [];
  let windowIdx = 0;
  for (
    let isStart = firstT;
    isStart + inSampleMs + outOfSampleMs <= lastT;
    isStart += stepMs
  ) {
    const isEnd = isStart + inSampleMs;
    const oosStart = isEnd;
    const oosEnd = oosStart + outOfSampleMs;

    const win: Window = {
      index: windowIdx++,
      inSampleStart: isStart,
      inSampleEnd: isEnd,
      oosStart,
      oosEnd,
      bestParams: null,
      bestIsObjective: null,
      isTradeCount: 0,
      oosSummary: null,
      candidatesEvaluated: 0,
    };

    const isSlice = sliceWithWarmup(bars, isStart, isEnd, warmupBars);
    if (!isSlice) {
      windows.push(win);
      onWindow?.(win);
      continue;
    }

    let bestScore = -Infinity;
    let bestParams: Record<string, number> | null = null;
    let bestTradeCount = 0;

    for (const params of grid) {
      try {
        const result = runBacktest({
          strategy,
          params,
          symbol,
          timeframe,
          bars: isSlice.slice,
          startingEquity,
          warmupBars: isSlice.warmupBars,
          spreadModel,
          persist: false,
        });
        win.candidatesEvaluated++;
        if (result.trades.length < minTrades) continue;
        const score = scoreObjective(result.summary, objective);
        if (score > bestScore) {
          bestScore = score;
          bestParams = params;
          bestTradeCount = result.trades.length;
        }
      } catch {
        // ignore this candidate
      }
    }

    win.bestParams = bestParams;
    win.bestIsObjective = bestParams ? bestScore : null;
    win.isTradeCount = bestTradeCount;

    // Evaluate the winning params on out-of-sample
    if (bestParams) {
      const oosSlice = sliceWithWarmup(bars, oosStart, oosEnd, warmupBars);
      if (oosSlice) {
        try {
          const oosResult = runBacktest({
            strategy,
            params: bestParams,
            symbol,
            timeframe,
            bars: oosSlice.slice,
            startingEquity,
            warmupBars: oosSlice.warmupBars,
            spreadModel,
            persist: false,
          });
          win.oosSummary = oosResult.summary;
        } catch {
          // leave oosSummary null
        }
      }
    }

    windows.push(win);
    onWindow?.(win);
  }

  return {
    strategy: strategy.name,
    symbol,
    objective,
    windows,
    aggregate: aggregate(windows, strategy.paramGrid.map(r => r.name)),
  };
}

function aggregate(
  windows: Window[],
  paramNames: string[],
): WalkForwardResult['aggregate'] {
  const done = windows.filter(w => w.oosSummary !== null);
  const returns = done.map(w => w.oosSummary!.totalReturnPct);
  const sharpes = done
    .map(w => w.oosSummary!.sharpe)
    .filter((s): s is number => s !== null);
  const meanOosReturn =
    returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const sortedReturns = [...returns].sort((a, b) => a - b);
  const medianOosReturn =
    sortedReturns.length > 0 ? sortedReturns[Math.floor(sortedReturns.length / 2)]! : 0;
  const meanOosSharpe =
    sharpes.length > 0 ? sharpes.reduce((a, b) => a + b, 0) / sharpes.length : null;

  const paramStability: WalkForwardResult['aggregate']['paramStability'] = {};
  for (const pname of paramNames) {
    const vals = windows
      .map(w => w.bestParams?.[pname])
      .filter((v): v is number => typeof v === 'number');
    if (vals.length === 0) {
      paramStability[pname] = { mean: 0, stddev: 0, cv: 0, values: [] };
      continue;
    }
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance =
      vals.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, vals.length - 1);
    const stddev = Math.sqrt(variance);
    const cv = mean !== 0 ? stddev / Math.abs(mean) : 0;
    paramStability[pname] = { mean, stddev, cv, values: vals };
  }

  return {
    totalWindows: windows.length,
    completedWindows: done.length,
    profitableOosWindows: done.filter(w => w.oosSummary!.totalReturnPct > 0).length,
    meanOosReturnPct: meanOosReturn,
    medianOosReturnPct: medianOosReturn,
    meanOosSharpe,
    totalOosTrades: done.reduce((a, w) => a + w.oosSummary!.tradeCount, 0),
    paramStability,
  };
}
