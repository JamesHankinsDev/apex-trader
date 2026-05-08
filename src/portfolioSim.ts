// Portfolio simulator. Runs multiple "sleeves" independently and combines
// their equity curves into a portfolio-level equity curve. Each sleeve gets
// its share of starting capital and compounds on its own — NO rebalancing
// between sleeves (that would be a separate experiment).
//
// Time alignment: we take the union of all sleeve equity timestamps. For any
// timestamp a sleeve doesn't have yet (e.g. AVAX hasn't started yet), we use
// its allocated starting capital (it's sitting in cash).

import { runBacktest, type EquityPoint } from './backtest.js';
import type { Bar, Strategy, Timeframe } from './types.js';

export interface Sleeve {
  symbol: string;
  strategy: Strategy;
  allocationPct: number;     // e.g. 25 for 25%
  params?: Record<string, number>;
}

export interface PortfolioConfig {
  name: string;
  sleeves: Sleeve[];
}

export interface PortfolioInput {
  config: PortfolioConfig;
  barsBySymbol: Map<string, Bar[]>;
  timeframe: Timeframe;
  startingEquity: number;
  warmupBars?: number;
  // If set, rebalance sleeves to their target allocation every N milliseconds.
  // Approximates rebalancing by scaling each sleeve's equity multiplier against
  // its value at the last rebalance — no mid-backtest liquidation required.
  rebalanceIntervalMs?: number;
}

export interface SleeveResult {
  symbol: string;
  strategy: string;
  allocation: number;
  startingCash: number;
  endingEquity: number;
  returnPct: number;
  tradeCount: number;
  warnings: string[];
}

export interface PortfolioResult {
  name: string;
  startingEquity: number;
  endingEquity: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  sharpe: number | null;
  rebalanceIntervalMs: number | null;
  equityCurve: EquityPoint[];
  sleeveResults: SleeveResult[];
}

export function runPortfolio(input: PortfolioInput): PortfolioResult {
  const {
    config,
    barsBySymbol,
    timeframe,
    startingEquity,
    warmupBars = 50,
    rebalanceIntervalMs,
  } = input;

  // Validate allocations sum to 100% (allow a small epsilon)
  const totalAlloc = config.sleeves.reduce((a, s) => a + s.allocationPct, 0);
  if (Math.abs(totalAlloc - 100) > 0.01) {
    throw new Error(
      `Sleeve allocations sum to ${totalAlloc}%, should be 100% (${config.name})`,
    );
  }

  const sleeveCurves: Array<{
    sleeve: Sleeve;
    startingCash: number;
    curve: EquityPoint[];
    tradeCount: number;
    warnings: string[];
  }> = [];

  for (const sleeve of config.sleeves) {
    const startingCash = startingEquity * (sleeve.allocationPct / 100);
    const bars = barsBySymbol.get(sleeve.symbol);
    if (!bars || bars.length < warmupBars + 2) {
      sleeveCurves.push({
        sleeve,
        startingCash,
        // Sleeve had no data — it just sits in cash the whole time.
        curve: [],
        tradeCount: 0,
        warnings: [`no bars available for ${sleeve.symbol}`],
      });
      continue;
    }
    try {
      const result = runBacktest({
        strategy: sleeve.strategy,
        params: sleeve.params,
        symbol: sleeve.symbol,
        timeframe,
        bars,
        startingEquity: startingCash,
        warmupBars,
        persist: false,
      });
      sleeveCurves.push({
        sleeve,
        startingCash,
        curve: result.equityCurve,
        tradeCount: result.trades.length,
        warnings: [],
      });
    } catch (err) {
      sleeveCurves.push({
        sleeve,
        startingCash,
        curve: [],
        tradeCount: 0,
        warnings: [`backtest failed: ${(err as Error).message}`],
      });
    }
  }

  // Build combined equity curve. Take the union of all timestamps; for each,
  // sum each sleeve's equity at that time (or its starting cash if the sleeve
  // hasn't started yet at that timestamp).
  const allTimestamps = new Set<number>();
  for (const sc of sleeveCurves) {
    for (const p of sc.curve) allTimestamps.add(p.t);
  }
  const sorted = [...allTimestamps].sort((a, b) => a - b);

  // Per-sleeve lookup map for O(1) lookup by timestamp.
  const sleeveMaps = sleeveCurves.map(sc => {
    const m = new Map<number, number>();
    for (const p of sc.curve) m.set(p.t, p.equity);
    return { sc, map: m };
  });

  // Running "last known" equity per sleeve to carry forward between ticks.
  const lastKnown: number[] = sleeveCurves.map(sc => sc.startingCash);

  // Rebalance state: each sleeve has an "allocation anchor" — the portfolio
  // capital earmarked to that sleeve at the last rebalance — and a "multiplier
  // anchor" — what the sleeve's equity multiplier was at that same time. The
  // sleeve's contribution to portfolio equity at time t is
  //   allocationAnchor × (currentEquity / anchorEquity).
  // With no rebalancing, these anchors never update and the math reduces to
  // the original "each sleeve compounds independently" behaviour.
  const allocationAnchor: number[] = sleeveCurves.map(sc => sc.startingCash);
  const anchorEquity: number[] = sleeveCurves.map(sc => sc.startingCash);
  const weights = config.sleeves.map(s => s.allocationPct / 100);
  let nextRebalanceT: number | null = null;
  if (rebalanceIntervalMs !== undefined && sorted.length > 0) {
    nextRebalanceT = sorted[0]! + rebalanceIntervalMs;
  }

  const combined: EquityPoint[] = [];
  for (const t of sorted) {
    // Update last-known equities
    for (let i = 0; i < sleeveMaps.length; i++) {
      const val = sleeveMaps[i]!.map.get(t);
      if (val !== undefined) lastKnown[i] = val;
    }

    // Compute portfolio equity as rebalanced allocation × sleeve return since anchor
    let sum = 0;
    for (let i = 0; i < sleeveMaps.length; i++) {
      const mult = anchorEquity[i]! > 0 ? lastKnown[i]! / anchorEquity[i]! : 1;
      sum += allocationAnchor[i]! * mult;
    }

    // Rebalance if we've crossed the next scheduled boundary
    if (
      rebalanceIntervalMs !== undefined &&
      nextRebalanceT !== null &&
      t >= nextRebalanceT
    ) {
      for (let i = 0; i < sleeveMaps.length; i++) {
        allocationAnchor[i] = weights[i]! * sum;
        anchorEquity[i] = lastKnown[i]!;
      }
      nextRebalanceT = t + rebalanceIntervalMs;
    }

    combined.push({ t, equity: sum });
  }

  // If no sleeve produced any timestamps, bail out with a trivial result.
  if (combined.length === 0) {
    return {
      name: config.name,
      startingEquity,
      endingEquity: startingEquity,
      totalReturnPct: 0,
      maxDrawdownPct: 0,
      sharpe: null,
      rebalanceIntervalMs: rebalanceIntervalMs ?? null,
      equityCurve: [],
      sleeveResults: sleeveCurves.map(sc => ({
        symbol: sc.sleeve.symbol,
        strategy: sc.sleeve.strategy.name,
        allocation: sc.sleeve.allocationPct,
        startingCash: sc.startingCash,
        endingEquity: sc.startingCash,
        returnPct: 0,
        tradeCount: sc.tradeCount,
        warnings: sc.warnings,
      })),
    };
  }

  const endingEquity = combined[combined.length - 1]!.equity;
  const totalReturnPct = ((endingEquity - startingEquity) / startingEquity) * 100;

  // Max drawdown
  let peak = -Infinity;
  let maxDd = 0;
  for (const p of combined) {
    if (p.equity > peak) peak = p.equity;
    if (peak > 0) {
      const dd = (peak - p.equity) / peak;
      if (dd > maxDd) maxDd = dd;
    }
  }

  // Annualized Sharpe — uses the correct periods-per-year for the portfolio's
  // timeframe. Without this the 1D numbers look ~5x better than 1H ones for
  // no real reason.
  const periodsPerYear: Record<Timeframe, number> = {
    '1Min': 525_600,
    '5Min': 105_120,
    '15Min': 35_040,
    '1H': 8_760,
    '4H': 2_190,
    '1D': 365,
  };
  const returns: number[] = [];
  for (let i = 1; i < combined.length; i++) {
    const prev = combined[i - 1]!.equity;
    const cur = combined[i]!.equity;
    if (prev > 0) returns.push((cur - prev) / prev);
  }
  let sharpe: number | null = null;
  if (returns.length >= 10) {
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance =
      returns.reduce((a, b) => a + (b - mean) ** 2, 0) /
      Math.max(1, returns.length - 1);
    const std = Math.sqrt(variance);
    if (std > 0) sharpe = (mean / std) * Math.sqrt(periodsPerYear[timeframe]);
  }

  return {
    name: config.name,
    startingEquity,
    endingEquity,
    totalReturnPct,
    maxDrawdownPct: maxDd * 100,
    sharpe,
    rebalanceIntervalMs: rebalanceIntervalMs ?? null,
    equityCurve: combined,
    sleeveResults: sleeveCurves.map(sc => ({
      symbol: sc.sleeve.symbol,
      strategy: sc.sleeve.strategy.name,
      allocation: sc.sleeve.allocationPct,
      startingCash: sc.startingCash,
      endingEquity:
        sc.curve.length > 0 ? sc.curve[sc.curve.length - 1]!.equity : sc.startingCash,
      returnPct:
        sc.curve.length > 0
          ? ((sc.curve[sc.curve.length - 1]!.equity - sc.startingCash) /
              sc.startingCash) *
            100
          : 0,
      tradeCount: sc.tradeCount,
      warnings: sc.warnings,
    })),
  };
}
