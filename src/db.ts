// SQLite persistence layer. Schema is created on first connect and is idempotent.
// Path defaults to ./data/apex.db relative to cwd.

import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Bar, Signal, Timeframe, Trade } from './types.js';

const DEFAULT_PATH = resolve(process.cwd(), 'data', 'apex.db');

let dbInstance: Database.Database | null = null;

export function getDb(path = DEFAULT_PATH): Database.Database {
  if (dbInstance) return dbInstance;
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  dbInstance = db;
  return db;
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bars (
      symbol TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      t INTEGER NOT NULL,
      o REAL NOT NULL,
      h REAL NOT NULL,
      l REAL NOT NULL,
      c REAL NOT NULL,
      v REAL NOT NULL,
      PRIMARY KEY (symbol, timeframe, t)
    );

    CREATE INDEX IF NOT EXISTS idx_bars_lookup
      ON bars (symbol, timeframe, t);

    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      strategy TEXT NOT NULL,
      params TEXT NOT NULL,
      symbol TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      start_t INTEGER NOT NULL,
      end_t INTEGER,
      starting_equity REAL NOT NULL,
      ending_equity REAL,
      created_at INTEGER NOT NULL,
      summary TEXT
    );

    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      symbol TEXT NOT NULL,
      entry_t INTEGER NOT NULL,
      entry_price REAL NOT NULL,
      exit_t INTEGER NOT NULL,
      exit_price REAL NOT NULL,
      qty REAL NOT NULL,
      entry_reason TEXT,
      exit_reason TEXT,
      pnl_usd REAL NOT NULL,
      pnl_pct REAL NOT NULL,
      hold_ms INTEGER NOT NULL,
      FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_trades_run ON trades (run_id);

    CREATE TABLE IF NOT EXISTS signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      symbol TEXT NOT NULL,
      t INTEGER NOT NULL,
      action TEXT NOT NULL,
      reason TEXT NOT NULL,
      factors TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_signals_run ON signals (run_id);

    CREATE TABLE IF NOT EXISTS portfolio_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      start_t INTEGER NOT NULL,
      end_t INTEGER NOT NULL,
      starting_equity REAL NOT NULL,
      ending_equity REAL NOT NULL,
      total_return_pct REAL NOT NULL,
      max_drawdown_pct REAL NOT NULL,
      sharpe REAL,
      rebalance_interval_days INTEGER,
      equity_curve TEXT NOT NULL,
      sleeves TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_portfolio_runs_created
      ON portfolio_runs (created_at DESC);

    CREATE TABLE IF NOT EXISTS live_ticks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_name TEXT NOT NULL,
      mode TEXT NOT NULL,
      t INTEGER NOT NULL,
      account_equity REAL,
      account_cash REAL,
      sleeve_signals TEXT NOT NULL,
      orders TEXT NOT NULL,
      errors TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_live_ticks_created
      ON live_ticks (created_at DESC);

    CREATE TABLE IF NOT EXISTS live_trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_name TEXT NOT NULL,
      mode TEXT NOT NULL,
      symbol TEXT NOT NULL,
      strategy TEXT NOT NULL,
      side TEXT NOT NULL,
      alpaca_order_id TEXT,
      notional REAL,
      qty REAL,
      reason TEXT,
      submitted INTEGER NOT NULL,
      t INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_live_trades_created
      ON live_trades (created_at DESC);
  `);
}

// ── BARS ─────────────────────────────────────────────────────

export function insertBars(
  symbol: string,
  timeframe: Timeframe,
  bars: Bar[],
  path?: string,
): number {
  const db = getDb(path);
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO bars (symbol, timeframe, t, o, h, l, c, v)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertMany = db.transaction((rows: Bar[]) => {
    for (const b of rows) {
      stmt.run(symbol, timeframe, b.t, b.o, b.h, b.l, b.c, b.v);
    }
  });
  insertMany(bars);
  return bars.length;
}

export function getBars(
  symbol: string,
  timeframe: Timeframe,
  fromT: number,
  toT: number,
  path?: string,
): Bar[] {
  const db = getDb(path);
  const rows = db
    .prepare(
      `SELECT t, o, h, l, c, v FROM bars
       WHERE symbol = ? AND timeframe = ? AND t >= ? AND t <= ?
       ORDER BY t ASC`,
    )
    .all(symbol, timeframe, fromT, toT) as Bar[];
  return rows;
}

export function barsCoverage(
  symbol: string,
  timeframe: Timeframe,
  path?: string,
): { minT: number | null; maxT: number | null; count: number } {
  const db = getDb(path);
  const row = db
    .prepare(
      `SELECT MIN(t) AS minT, MAX(t) AS maxT, COUNT(*) AS cnt
       FROM bars WHERE symbol = ? AND timeframe = ?`,
    )
    .get(symbol, timeframe) as { minT: number | null; maxT: number | null; cnt: number };
  return { minT: row.minT, maxT: row.maxT, count: row.cnt };
}

// ── RUNS ─────────────────────────────────────────────────────

export interface RunInit {
  kind: 'backtest' | 'live';
  strategy: string;
  params: Record<string, number>;
  symbol: string;
  timeframe: Timeframe;
  startT: number;
  startingEquity: number;
}

export function createRun(init: RunInit, path?: string): number {
  const db = getDb(path);
  const info = db
    .prepare(
      `INSERT INTO runs (kind, strategy, params, symbol, timeframe, start_t, starting_equity, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      init.kind,
      init.strategy,
      JSON.stringify(init.params),
      init.symbol,
      init.timeframe,
      init.startT,
      init.startingEquity,
      Date.now(),
    );
  return info.lastInsertRowid as number;
}

export function finalizeRun(
  runId: number,
  endT: number,
  endingEquity: number,
  summary: unknown,
  path?: string,
): void {
  const db = getDb(path);
  db.prepare(
    `UPDATE runs SET end_t = ?, ending_equity = ?, summary = ? WHERE id = ?`,
  ).run(endT, endingEquity, JSON.stringify(summary), runId);
}

// ── TRADES ───────────────────────────────────────────────────

export function insertTrade(runId: number, trade: Trade, path?: string): void {
  const db = getDb(path);
  db.prepare(
    `INSERT INTO trades
       (run_id, symbol, entry_t, entry_price, exit_t, exit_price, qty,
        entry_reason, exit_reason, pnl_usd, pnl_pct, hold_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    runId,
    trade.symbol,
    trade.entryT,
    trade.entryPrice,
    trade.exitT,
    trade.exitPrice,
    trade.qty,
    trade.entryReason,
    trade.exitReason,
    trade.pnlUsd,
    trade.pnlPct,
    trade.holdMs,
  );
}

// ── SIGNALS ──────────────────────────────────────────────────

// ── PORTFOLIO RUNS ───────────────────────────────────────────

export interface PortfolioRunInit {
  name: string;
  timeframe: Timeframe;
  startT: number;
  endT: number;
  startingEquity: number;
  endingEquity: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  sharpe: number | null;
  rebalanceIntervalDays: number | null;
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

export function insertPortfolioRun(run: PortfolioRunInit, path?: string): number {
  const db = getDb(path);
  const info = db
    .prepare(
      `INSERT INTO portfolio_runs
        (name, timeframe, start_t, end_t, starting_equity, ending_equity,
         total_return_pct, max_drawdown_pct, sharpe,
         rebalance_interval_days, equity_curve, sleeves, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      run.name,
      run.timeframe,
      run.startT,
      run.endT,
      run.startingEquity,
      run.endingEquity,
      run.totalReturnPct,
      run.maxDrawdownPct,
      run.sharpe,
      run.rebalanceIntervalDays,
      JSON.stringify(run.equityCurve),
      JSON.stringify(run.sleeves),
      Date.now(),
    );
  return info.lastInsertRowid as number;
}

// ── LIVE TICKS + TRADES ──────────────────────────────────────

export interface LiveTickInit {
  runName: string;
  mode: 'paper' | 'live';
  t: number;
  accountEquity: number | null;
  accountCash: number | null;
  sleeveSignals: Array<{
    symbol: string;
    strategy: string;
    action: string;
    reason: string;
  }>;
  orders: Array<{
    symbol: string;
    side: string;
    notional: number | null;
    qty: number | null;
    submitted: boolean;
    orderId: string;
    status: string;
  }>;
  errors: string[];
}

export function insertLiveTick(tick: LiveTickInit, path?: string): number {
  const db = getDb(path);
  const info = db
    .prepare(
      `INSERT INTO live_ticks
        (run_name, mode, t, account_equity, account_cash,
         sleeve_signals, orders, errors, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      tick.runName,
      tick.mode,
      tick.t,
      tick.accountEquity,
      tick.accountCash,
      JSON.stringify(tick.sleeveSignals),
      JSON.stringify(tick.orders),
      tick.errors.length > 0 ? JSON.stringify(tick.errors) : null,
      Date.now(),
    );
  return info.lastInsertRowid as number;
}

export interface LiveTradeInit {
  runName: string;
  mode: 'paper' | 'live';
  symbol: string;
  strategy: string;
  side: 'buy' | 'sell';
  alpacaOrderId: string | null;
  notional: number | null;
  qty: number | null;
  reason: string;
  submitted: boolean;
  t: number;
}

export function insertLiveTrade(trade: LiveTradeInit, path?: string): void {
  const db = getDb(path);
  db.prepare(
    `INSERT INTO live_trades
      (run_name, mode, symbol, strategy, side, alpaca_order_id,
       notional, qty, reason, submitted, t, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    trade.runName,
    trade.mode,
    trade.symbol,
    trade.strategy,
    trade.side,
    trade.alpacaOrderId,
    trade.notional,
    trade.qty,
    trade.reason,
    trade.submitted ? 1 : 0,
    trade.t,
    Date.now(),
  );
}

export function insertSignal(
  runId: number,
  symbol: string,
  t: number,
  signal: Signal,
  path?: string,
): void {
  if (signal.action === 'hold') return; // don't flood the DB with holds
  const db = getDb(path);
  db.prepare(
    `INSERT INTO signals (run_id, symbol, t, action, reason, factors)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    runId,
    symbol,
    t,
    signal.action,
    signal.reason,
    JSON.stringify(signal.factors),
  );
}
