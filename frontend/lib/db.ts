// Thin read-only SQLite reader for the frontend. Opens the same database the
// CLI writes to (v2/data/apex.db). Never writes — the backtest CLIs own that.

import Database from 'better-sqlite3';
import { resolve } from 'node:path';

const DB_PATH = resolve(process.cwd(), '..', 'data', 'apex.db');

let instance: Database.Database | null = null;
function db(): Database.Database {
  if (instance) return instance;
  instance = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  return instance;
}

export interface RunListRow {
  id: number;
  kind: string;
  strategy: string;
  symbol: string;
  timeframe: string;
  startT: number;
  endT: number | null;
  startingEquity: number;
  endingEquity: number | null;
  createdAt: number;
  totalReturnPct: number | null;
  buyHoldReturnPct: number | null;
  tradeCount: number | null;
  winRatePct: number | null;
  maxDrawdownPct: number | null;
  sharpe: number | null;
}

export function listRuns(): RunListRow[] {
  const rows = db()
    .prepare(
      `SELECT id, kind, strategy, symbol, timeframe, start_t, end_t,
              starting_equity, ending_equity, created_at, summary
       FROM runs
       ORDER BY created_at DESC`,
    )
    .all() as Array<{
      id: number;
      kind: string;
      strategy: string;
      symbol: string;
      timeframe: string;
      start_t: number;
      end_t: number | null;
      starting_equity: number;
      ending_equity: number | null;
      created_at: number;
      summary: string | null;
    }>;

  return rows.map(r => {
    let s: Record<string, unknown> = {};
    try {
      s = r.summary ? JSON.parse(r.summary) : {};
    } catch {
      /* ignore */
    }
    return {
      id: r.id,
      kind: r.kind,
      strategy: r.strategy,
      symbol: r.symbol,
      timeframe: r.timeframe,
      startT: r.start_t,
      endT: r.end_t,
      startingEquity: r.starting_equity,
      endingEquity: r.ending_equity,
      createdAt: r.created_at,
      totalReturnPct: (s.totalReturnPct as number | undefined) ?? null,
      buyHoldReturnPct: (s.buyHoldReturnPct as number | undefined) ?? null,
      tradeCount: (s.tradeCount as number | undefined) ?? null,
      winRatePct: (s.winRatePct as number | undefined) ?? null,
      maxDrawdownPct: (s.maxDrawdownPct as number | undefined) ?? null,
      sharpe: (s.sharpe as number | null | undefined) ?? null,
    };
  });
}

export interface RunDetail {
  id: number;
  kind: string;
  strategy: string;
  params: Record<string, unknown>;
  symbol: string;
  timeframe: string;
  startT: number;
  endT: number | null;
  startingEquity: number;
  endingEquity: number | null;
  summary: Record<string, unknown>;
}

export function getRun(id: number): RunDetail | null {
  const row = db()
    .prepare(
      `SELECT id, kind, strategy, params, symbol, timeframe, start_t, end_t,
              starting_equity, ending_equity, summary
       FROM runs WHERE id = ?`,
    )
    .get(id) as
    | {
        id: number;
        kind: string;
        strategy: string;
        params: string;
        symbol: string;
        timeframe: string;
        start_t: number;
        end_t: number | null;
        starting_equity: number;
        ending_equity: number | null;
        summary: string | null;
      }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    kind: row.kind,
    strategy: row.strategy,
    params: safeJsonParse(row.params),
    symbol: row.symbol,
    timeframe: row.timeframe,
    startT: row.start_t,
    endT: row.end_t,
    startingEquity: row.starting_equity,
    endingEquity: row.ending_equity,
    summary: safeJsonParse(row.summary),
  };
}

export interface TradeRow {
  id: number;
  symbol: string;
  entryT: number;
  entryPrice: number;
  exitT: number;
  exitPrice: number;
  qty: number;
  entryReason: string | null;
  exitReason: string | null;
  pnlUsd: number;
  pnlPct: number;
  holdMs: number;
}

export function getTrades(runId: number): TradeRow[] {
  return db()
    .prepare(
      `SELECT id, symbol, entry_t AS entryT, entry_price AS entryPrice,
              exit_t AS exitT, exit_price AS exitPrice, qty,
              entry_reason AS entryReason, exit_reason AS exitReason,
              pnl_usd AS pnlUsd, pnl_pct AS pnlPct, hold_ms AS holdMs
       FROM trades WHERE run_id = ? ORDER BY entry_t ASC`,
    )
    .all(runId) as TradeRow[];
}

export interface BarRow {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

// ── PORTFOLIO RUNS ───────────────────────────────────────────

export interface PortfolioListRow {
  id: number;
  name: string;
  timeframe: string;
  startT: number;
  endT: number;
  startingEquity: number;
  endingEquity: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  sharpe: number | null;
  rebalanceIntervalDays: number | null;
  createdAt: number;
}

export function listPortfolios(): PortfolioListRow[] {
  return db()
    .prepare(
      `SELECT id, name, timeframe,
              start_t AS startT, end_t AS endT,
              starting_equity AS startingEquity,
              ending_equity AS endingEquity,
              total_return_pct AS totalReturnPct,
              max_drawdown_pct AS maxDrawdownPct,
              sharpe,
              rebalance_interval_days AS rebalanceIntervalDays,
              created_at AS createdAt
       FROM portfolio_runs
       ORDER BY created_at DESC, id DESC`,
    )
    .all() as PortfolioListRow[];
}

export interface PortfolioDetail extends PortfolioListRow {
  equityCurve: Array<{ t: number; equity: number }>;
  sleeves: Array<{
    symbol: string;
    strategy: string;
    allocation: number;
    startingCash: number;
    endingEquity: number;
    returnPct: number;
    tradeCount: number;
    warnings: string[];
  }>;
}

export function getPortfolio(id: number): PortfolioDetail | null {
  const row = db()
    .prepare(
      `SELECT id, name, timeframe,
              start_t AS startT, end_t AS endT,
              starting_equity AS startingEquity,
              ending_equity AS endingEquity,
              total_return_pct AS totalReturnPct,
              max_drawdown_pct AS maxDrawdownPct,
              sharpe,
              rebalance_interval_days AS rebalanceIntervalDays,
              created_at AS createdAt,
              equity_curve AS equityCurve,
              sleeves
       FROM portfolio_runs WHERE id = ?`,
    )
    .get(id) as
    | (PortfolioListRow & { equityCurve: string; sleeves: string })
    | undefined;
  if (!row) return null;
  return {
    ...row,
    equityCurve: safeJsonArray(row.equityCurve),
    sleeves: safeJsonArray(row.sleeves),
  } as PortfolioDetail;
}

function safeJsonArray<T = unknown>(s: string): T[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

// ── LIVE TICKS + TRADES ──────────────────────────────────────

export interface LiveTickRow {
  id: number;
  runName: string;
  mode: string;
  t: number;
  accountEquity: number | null;
  accountCash: number | null;
  sleeveSignals: Array<{ symbol: string; strategy: string; action: string; reason: string }>;
  orders: Array<{
    symbol: string;
    side: string;
    notional: number | null;
    qty: number | null;
    submitted: number | boolean;
    orderId: string;
    status: string;
  }>;
  errors: string[];
  createdAt: number;
}

// Safely check if live_ticks table exists (added after original schema).
function hasLiveTables(): boolean {
  const row = db()
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='live_ticks'`,
    )
    .get();
  return !!row;
}

export function listLiveTicks(limit = 20): LiveTickRow[] {
  if (!hasLiveTables()) return [];
  const rows = db()
    .prepare(
      `SELECT id, run_name AS runName, mode, t,
              account_equity AS accountEquity,
              account_cash AS accountCash,
              sleeve_signals AS sleeveSignals,
              orders, errors,
              created_at AS createdAt
       FROM live_ticks
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
    )
    .all(limit) as Array<{
      id: number;
      runName: string;
      mode: string;
      t: number;
      accountEquity: number | null;
      accountCash: number | null;
      sleeveSignals: string;
      orders: string;
      errors: string | null;
      createdAt: number;
    }>;
  return rows.map(r => ({
    id: r.id,
    runName: r.runName,
    mode: r.mode,
    t: r.t,
    accountEquity: r.accountEquity,
    accountCash: r.accountCash,
    sleeveSignals: safeJsonArray(r.sleeveSignals),
    orders: safeJsonArray(r.orders),
    errors: r.errors ? safeJsonArray(r.errors) : [],
    createdAt: r.createdAt,
  }));
}

export interface LiveTradeRow {
  id: number;
  runName: string;
  mode: string;
  symbol: string;
  strategy: string;
  side: string;
  alpacaOrderId: string | null;
  notional: number | null;
  qty: number | null;
  reason: string;
  submitted: number;
  t: number;
  createdAt: number;
}

export function listLiveTrades(limit = 50): LiveTradeRow[] {
  if (!hasLiveTables()) return [];
  return db()
    .prepare(
      `SELECT id, run_name AS runName, mode, symbol, strategy, side,
              alpaca_order_id AS alpacaOrderId, notional, qty, reason,
              submitted, t, created_at AS createdAt
       FROM live_trades
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
    )
    .all(limit) as LiveTradeRow[];
}

export function getBars(
  symbol: string,
  timeframe: string,
  fromT: number,
  toT: number,
): BarRow[] {
  return db()
    .prepare(
      `SELECT t, o, h, l, c, v FROM bars
       WHERE symbol = ? AND timeframe = ? AND t >= ? AND t <= ?
       ORDER BY t ASC`,
    )
    .all(symbol, timeframe, fromT, toT) as BarRow[];
}

function safeJsonParse(s: string | null): Record<string, unknown> {
  if (!s) return {};
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
