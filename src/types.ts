// Core types shared across backtest and live runners.

export type Timeframe = '1Min' | '5Min' | '15Min' | '1H' | '4H' | '1D';

export interface Bar {
  t: number; // unix ms of bar open
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface Position {
  symbol: string;
  qty: number;
  entryPrice: number;
  entryT: number;
  entryReason: string;
  // Cost basis in USD *paid* at entry (qty * entryPrice + spread cost on buy).
  costBasisUsd: number;
  // Optional static stop levels. If set, the backtester checks each bar's
  // low/high and exits at the stop price if triggered intrabar — more realistic
  // than waiting for the bar close to evaluate the stop condition.
  stopLoss?: number;
  takeProfit?: number;
}

export interface Trade {
  symbol: string;
  entryT: number;
  entryPrice: number;
  exitT: number;
  exitPrice: number;
  qty: number;
  entryReason: string;
  exitReason: string;
  pnlUsd: number;
  pnlPct: number;
  holdMs: number;
}

// Every factor the strategy considered, for transparency + ML features.
export interface SignalFactor {
  name: string;
  value: number;
  // How much this factor pushed toward enter (+) or exit (-). Optional — some
  // factors are informational only.
  contribution?: number;
  note?: string;
}

export type SignalAction = 'enter' | 'exit' | 'hold';

export interface Signal {
  action: SignalAction;
  // For 'enter': how much USD to allocate. Runner may clamp to available cash.
  sizeUsd?: number;
  // Human-readable one-liner. E.g. "RSI 27 oversold below SMA20".
  reason: string;
  // Structured breakdown of all factors that led to this decision.
  factors: SignalFactor[];
  // Optional static stops set at entry. Backtester honours these intrabar
  // using bar.l/bar.h so exits fire at the stop price, not the next bar close.
  stopLoss?: number;
  takeProfit?: number;
}

export interface StrategyContext {
  symbol: string;
  bar: Bar;
  // All bars up to and including `bar`, oldest first. Strategy may slice.
  history: Bar[];
  // Current open position in this symbol, or null.
  position: Position | null;
  // Most recent closed trade in this symbol (for cooldown logic).
  lastTrade: Trade | null;
  // Portfolio-level snapshot.
  equity: number;
  cash: number;
  now: number; // equals bar.t — convenience alias
  params: Record<string, number>;
}

// A range of values to try for one parameter during optimization.
export interface ParamRange {
  name: string;
  values: number[];
}

export interface Strategy {
  name: string;
  // Default parameters. CLI or optimizer can override.
  defaultParams: Record<string, number>;
  // What the walk-forward optimizer will sweep over. Omitted params stay at
  // defaultParams during optimization. Keep grids small — combinations explode.
  paramGrid?: ParamRange[];
  onBar(ctx: StrategyContext): Signal;
}

// Round-trip spread cost modelling. Per-symbol fraction applied on each side.
export interface SpreadModel {
  forSymbol(symbol: string): number; // e.g. 0.0008 = 8bps per side
}

export interface BacktestSummary {
  runId: number;
  strategy: string;
  params: Record<string, number>;
  symbol: string;
  timeframe: Timeframe;
  startT: number;
  endT: number;
  startingEquity: number;
  endingEquity: number;
  totalReturnPct: number;
  tradeCount: number;
  winCount: number;
  lossCount: number;
  winRatePct: number;
  avgWinPct: number;
  avgLossPct: number;
  bestTradePct: number;
  worstTradePct: number;
  maxDrawdownPct: number;
  sharpe: number | null;
  // Buy-and-hold return over the same period for context.
  buyHoldReturnPct: number;
}
