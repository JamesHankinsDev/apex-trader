// Backtest engine. Replays historical bars through a Strategy, producing a
// trade ledger and summary stats.
//
// Execution model: the strategy decides at bar close; fills happen at the NEXT
// bar's open. This eliminates look-ahead bias. The final open position (if
// any) is force-closed at the last bar's close.

import type {
  BacktestSummary,
  Bar,
  Signal,
  SpreadModel,
  Strategy,
  Timeframe,
  Trade,
} from './types.js';
import { Portfolio } from './portfolio.js';
import { defaultSpreadModel } from './spread.js';
import {
  createRun,
  finalizeRun,
  insertSignal,
  insertTrade,
} from './db.js';

export interface BacktestOptions {
  strategy: Strategy;
  params?: Record<string, number>;
  symbol: string;
  timeframe: Timeframe;
  bars: Bar[];
  startingEquity: number;
  // Strategy is called starting from bars[warmupBars]. Earlier bars are still
  // part of `history` so indicators warm up properly.
  warmupBars?: number;
  spreadModel?: SpreadModel;
  // If true, persist run + trades + signals to the database.
  persist?: boolean;
}

export interface EquityPoint {
  t: number;
  equity: number;
}

export interface BacktestResult {
  runId: number | null;
  trades: Trade[];
  equityCurve: EquityPoint[];
  summary: BacktestSummary;
}

export function runBacktest(opts: BacktestOptions): BacktestResult {
  const {
    strategy,
    symbol,
    timeframe,
    bars,
    startingEquity,
    warmupBars = 50,
    spreadModel = defaultSpreadModel,
    persist = false,
  } = opts;
  const params = { ...strategy.defaultParams, ...(opts.params ?? {}) };

  if (bars.length < warmupBars + 2) {
    throw new Error(
      `Not enough bars: have ${bars.length}, need at least ${warmupBars + 2}`,
    );
  }

  const portfolio = new Portfolio(startingEquity, spreadModel);
  const equityCurve: EquityPoint[] = [];
  const pendingSignals: Signal[] = [];

  let runId: number | null = null;
  if (persist) {
    runId = createRun({
      kind: 'backtest',
      strategy: strategy.name,
      params,
      symbol,
      timeframe,
      startT: bars[warmupBars]!.t,
      startingEquity,
    });
  }

  // Execute deferred signals from bar i-1 at bar i's open, then evaluate bar i.
  for (let i = warmupBars; i < bars.length; i++) {
    const bar = bars[i]!;

    // 1) Execute the signal produced at the close of bar[i-1] using bar[i].open
    const pending = pendingSignals.pop();
    if (pending) {
      applySignal(portfolio, symbol, pending, bar.o, bar.t);
      if (persist && runId !== null) {
        insertSignal(runId, symbol, bar.t, pending);
      }
    }

    // 2) Check intrabar stops on any open position using this bar's low/high.
    // If a stop would have fired, exit at the stop price (not lagged to close).
    // For long positions: stop-loss fires if bar.l <= stopLoss; take-profit
    // fires if bar.h >= takeProfit. If both would have fired in the same bar
    // we conservatively assume the stop-loss fires first (worst case for P&L).
    const position = portfolio.getPosition(symbol);
    if (position) {
      if (position.stopLoss !== undefined && bar.l <= position.stopLoss) {
        portfolio.exit({
          symbol,
          fillPrice: position.stopLoss,
          t: bar.t,
          reason: `intrabar stop-loss at ${position.stopLoss.toFixed(4)}`,
        });
      } else if (
        position.takeProfit !== undefined &&
        bar.h >= position.takeProfit
      ) {
        portfolio.exit({
          symbol,
          fillPrice: position.takeProfit,
          t: bar.t,
          reason: `intrabar take-profit at ${position.takeProfit.toFixed(4)}`,
        });
      }
    }

    // 3) Evaluate current bar and queue a signal for next bar's open
    const history = bars.slice(0, i + 1); // includes current bar
    const prices = new Map([[symbol, bar.c]]);
    const equity = portfolio.equity(prices);
    const signal = strategy.onBar({
      symbol,
      bar,
      history,
      position: portfolio.getPosition(symbol),
      lastTrade: portfolio.lastTradeBySymbol.get(symbol) ?? null,
      equity,
      cash: portfolio.cash,
      now: bar.t,
      params,
    });
    if (signal.action !== 'hold') {
      pendingSignals.push(signal);
    }

    // 4) Record equity after this bar
    equityCurve.push({ t: bar.t, equity });
  }

  // Close any remaining position at final bar close.
  const finalBar = bars[bars.length - 1]!;
  if (portfolio.getPosition(symbol)) {
    portfolio.exit({
      symbol,
      fillPrice: finalBar.c,
      t: finalBar.t,
      reason: 'backtest-end',
    });
  }
  const endingEquity = portfolio.equity(new Map([[symbol, finalBar.c]]));
  // Replace the last equity point with post-close equity.
  if (equityCurve.length > 0) {
    equityCurve[equityCurve.length - 1] = { t: finalBar.t, equity: endingEquity };
  }

  const summary = summarize({
    runId: runId ?? 0,
    strategy: strategy.name,
    params,
    symbol,
    timeframe,
    bars,
    warmupBars,
    startingEquity,
    endingEquity,
    trades: portfolio.trades,
    equityCurve,
  });

  if (persist && runId !== null) {
    for (const t of portfolio.trades) insertTrade(runId, t);
    finalizeRun(runId, finalBar.t, endingEquity, summary);
  }

  return { runId, trades: portfolio.trades, equityCurve, summary };
}

function applySignal(
  portfolio: Portfolio,
  symbol: string,
  signal: Signal,
  fillPrice: number,
  t: number,
): void {
  if (signal.action === 'enter') {
    const sizeUsd = signal.sizeUsd ?? portfolio.cash;
    portfolio.enter({
      symbol,
      sizeUsd,
      fillPrice,
      t,
      reason: signal.reason,
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfit,
    });
  } else if (signal.action === 'exit') {
    portfolio.exit({ symbol, fillPrice, t, reason: signal.reason });
  }
}

function summarize(args: {
  runId: number;
  strategy: string;
  params: Record<string, number>;
  symbol: string;
  timeframe: Timeframe;
  bars: Bar[];
  warmupBars: number;
  startingEquity: number;
  endingEquity: number;
  trades: Trade[];
  equityCurve: EquityPoint[];
}): BacktestSummary {
  const {
    runId,
    strategy,
    params,
    symbol,
    timeframe,
    bars,
    warmupBars,
    startingEquity,
    endingEquity,
    trades,
    equityCurve,
  } = args;
  const wins = trades.filter(t => t.pnlUsd > 0);
  const losses = trades.filter(t => t.pnlUsd <= 0);
  const totalReturnPct = ((endingEquity - startingEquity) / startingEquity) * 100;
  const avgWinPct =
    wins.length > 0 ? wins.reduce((a, t) => a + t.pnlPct, 0) / wins.length : 0;
  const avgLossPct =
    losses.length > 0
      ? losses.reduce((a, t) => a + t.pnlPct, 0) / losses.length
      : 0;
  const bestTradePct = trades.length > 0 ? Math.max(...trades.map(t => t.pnlPct)) : 0;
  const worstTradePct = trades.length > 0 ? Math.min(...trades.map(t => t.pnlPct)) : 0;

  // Max drawdown on the equity curve
  let peak = -Infinity;
  let maxDd = 0;
  for (const p of equityCurve) {
    if (p.equity > peak) peak = p.equity;
    if (peak > 0) {
      const dd = (peak - p.equity) / peak;
      if (dd > maxDd) maxDd = dd;
    }
  }

  // Sharpe: bar-to-bar returns on the equity curve, annualized for the
  // timeframe. Assumes crypto trades 24/7/365.
  const sharpe = computeSharpe(equityCurve, timeframe);

  const firstPrice = bars[warmupBars]!.o; // first price strategy could act on
  const lastPrice = bars[bars.length - 1]!.c;
  const buyHoldReturnPct = ((lastPrice - firstPrice) / firstPrice) * 100;

  return {
    runId,
    strategy,
    params,
    symbol,
    timeframe,
    startT: bars[warmupBars]!.t,
    endT: bars[bars.length - 1]!.t,
    startingEquity,
    endingEquity,
    totalReturnPct,
    tradeCount: trades.length,
    winCount: wins.length,
    lossCount: losses.length,
    winRatePct: trades.length > 0 ? (wins.length / trades.length) * 100 : 0,
    avgWinPct,
    avgLossPct,
    bestTradePct,
    worstTradePct,
    maxDrawdownPct: maxDd * 100,
    sharpe,
    buyHoldReturnPct,
  };
}

function computeSharpe(
  curve: EquityPoint[],
  timeframe: Timeframe,
): number | null {
  if (curve.length < 10) return null;
  const returns: number[] = [];
  for (let i = 1; i < curve.length; i++) {
    const prev = curve[i - 1]!.equity;
    const cur = curve[i]!.equity;
    if (prev > 0) returns.push((cur - prev) / prev);
  }
  if (returns.length < 2) return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1);
  const std = Math.sqrt(variance);
  if (std === 0) return null;
  const periodsPerYear: Record<Timeframe, number> = {
    '1Min': 525_600,
    '5Min': 105_120,
    '15Min': 35_040,
    '1H': 8_760,
    '4H': 2_190,
    '1D': 365,
  };
  return (mean / std) * Math.sqrt(periodsPerYear[timeframe]);
}
