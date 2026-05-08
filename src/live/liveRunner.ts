// Live runner — one "tick" of the live strategy loop.
//
// A tick:
//   1. Fetch the latest N bars per symbol (enough for indicator warmup + regime)
//   2. Pull current Alpaca account + positions
//   3. For each sleeve: build a StrategyContext and run strategy.onBar
//   4. Execute resulting signals via Alpaca (respecting TRADING_ENABLED flag)
//   5. Log tick + any trades to SQLite
//
// Scheduling is external — call this from a cron (daily for 1D-timeframe
// strategies) or a node-cron entry. Idempotent: running twice in the same bar
// just re-checks and re-submits no-op orders.
//
// Multi-sleeve composition: each sleeve gets a share of current account equity
// as its "target sleeve equity". Position sizing within a sleeve uses that
// share, so if BTC sleeve is 50% of a $10k account, the BTC strategy sees
// equity=$5000. This mirrors the backtest semantics.

import {
  fetchHistoricalBars,
  getAccount,
  getPositions,
  loadCredentials,
  placeMarketOrder,
  closePosition,
  type AlpacaCredentials,
  type AlpacaMode,
  type AlpacaPosition,
} from '../alpaca.js';
import {
  insertLiveTick,
  insertLiveTrade,
} from '../db.js';
import type {
  Bar,
  Position,
  Signal,
  Strategy,
  StrategyContext,
  Timeframe,
  Trade,
} from '../types.js';

export interface LiveSleeve {
  symbol: string;
  strategy: Strategy;
  allocationPct: number;
  params?: Record<string, number>;
}

export interface LiveRunConfig {
  name: string;                    // identifier for logs, e.g. "v2-primary"
  mode: AlpacaMode;                // 'paper' | 'live'
  timeframe: Timeframe;            // bars timeframe for all sleeves
  sleeves: LiveSleeve[];
  // How far back to fetch bars for each sleeve. Must cover strategy warmup +
  // indicator lookback. For 1D crash-protected hold we need ~35 bars; default
  // 250 is safe for all currently-registered strategies.
  lookbackBars: number;
  creds: AlpacaCredentials;
}

export interface SleeveSignal {
  symbol: string;
  strategy: string;
  action: string;
  reason: string;
  signal: Signal;
  warnings: string[];
}

export interface TickResult {
  runName: string;
  mode: AlpacaMode;
  t: number;
  accountEquity: number | null;
  accountCash: number | null;
  sleeveSignals: SleeveSignal[];
  ordersPlaced: Array<{
    symbol: string;
    side: 'buy' | 'sell';
    notional: number | null;
    qty: number | null;
    orderId: string;
    status: string;
    submitted: boolean;
    reason: string;
  }>;
  errors: string[];
}

function lookbackMsFor(timeframe: Timeframe, bars: number): number {
  const msPerBar: Record<Timeframe, number> = {
    '1Min': 60_000,
    '5Min': 300_000,
    '15Min': 900_000,
    '1H': 3_600_000,
    '4H': 14_400_000,
    '1D': 86_400_000,
  };
  // Add a 2x buffer so Alpaca's weekend-aligned returns don't starve us.
  return msPerBar[timeframe] * bars * 2;
}

export async function runTick(config: LiveRunConfig): Promise<TickResult> {
  const now = Date.now();
  const errors: string[] = [];

  // 1. Account snapshot ────────────────────────────────────────
  let accountEquity: number | null = null;
  let accountCash: number | null = null;
  let positions: AlpacaPosition[] = [];
  try {
    const [account, pos] = await Promise.all([
      getAccount(config.creds, config.mode),
      getPositions(config.creds, config.mode),
    ]);
    accountEquity = account.equity;
    accountCash = account.cash;
    positions = pos;
  } catch (err) {
    errors.push(`account/positions fetch: ${(err as Error).message}`);
  }

  const positionBySymbol = new Map<string, AlpacaPosition>();
  for (const p of positions) positionBySymbol.set(p.symbol, p);

  // 2. Fetch recent bars for each sleeve symbol ───────────────
  // Alpaca's crypto data API requires live-account credentials even for
  // read-only bar fetches — paper keys return 401. We use ALPACA_API_KEY
  // (the data-API credentials loaded from env) here and the config-supplied
  // trading creds for account/order operations above.
  const barsBySymbol = new Map<string, Bar[]>();
  const lookbackMs = lookbackMsFor(config.timeframe, config.lookbackBars);
  let dataCreds: AlpacaCredentials;
  try {
    dataCreds = loadCredentials();
  } catch (err) {
    errors.push(`data credentials: ${(err as Error).message}`);
    dataCreds = config.creds; // fall back; will likely still 401 but surface it
  }
  for (const sleeve of config.sleeves) {
    try {
      const bars = await fetchHistoricalBars(
        dataCreds,
        sleeve.symbol,
        config.timeframe,
        now - lookbackMs,
        now,
      );
      barsBySymbol.set(sleeve.symbol, bars);
    } catch (err) {
      errors.push(
        `${sleeve.symbol} bars fetch: ${(err as Error).message}`,
      );
    }
  }

  // 3. Run each sleeve's strategy ─────────────────────────────
  const sleeveSignals: SleeveSignal[] = [];
  const orders: TickResult['ordersPlaced'] = [];

  for (const sleeve of config.sleeves) {
    const bars = barsBySymbol.get(sleeve.symbol);
    if (!bars || bars.length < 5) {
      sleeveSignals.push({
        symbol: sleeve.symbol,
        strategy: sleeve.strategy.name,
        action: 'hold',
        reason: 'insufficient bars',
        signal: { action: 'hold', reason: 'insufficient bars', factors: [] },
        warnings: [`only ${bars?.length ?? 0} bars`],
      });
      continue;
    }

    const lastBar = bars[bars.length - 1]!;
    const livePos = positionBySymbol.get(sleeve.symbol);

    // Target sleeve equity = account_equity × allocation
    const sleeveTargetEquity =
      accountEquity !== null
        ? accountEquity * (sleeve.allocationPct / 100)
        : 0;

    // Construct a pseudo-Position from Alpaca's live position (if any).
    // Live state fills in for the backtest Portfolio — the strategy sees the
    // same shape regardless of source.
    const position: Position | null = livePos
      ? {
          symbol: sleeve.symbol,
          qty: livePos.qty,
          entryPrice: livePos.avgEntryPrice,
          entryT: 0, // unknown without fills lookup; strategies should tolerate
          entryReason: 'live-existing',
          costBasisUsd: livePos.avgEntryPrice * livePos.qty,
        }
      : null;

    const ctx: StrategyContext = {
      symbol: sleeve.symbol,
      bar: lastBar,
      history: bars,
      position,
      lastTrade: null as Trade | null, // we could hydrate from DB but skip for MVP
      equity: sleeveTargetEquity,
      cash: accountCash ?? 0,
      now: lastBar.t,
      params: { ...sleeve.strategy.defaultParams, ...(sleeve.params ?? {}) },
    };

    let signal: Signal;
    try {
      signal = sleeve.strategy.onBar(ctx);
    } catch (err) {
      errors.push(`${sleeve.symbol} strategy: ${(err as Error).message}`);
      continue;
    }

    sleeveSignals.push({
      symbol: sleeve.symbol,
      strategy: sleeve.strategy.name,
      action: signal.action,
      reason: signal.reason,
      signal,
      warnings: [],
    });

    // 4. Apply signal via Alpaca ─────────────────────────────
    try {
      if (signal.action === 'enter' && !livePos) {
        const sizeUsd = Math.max(0, signal.sizeUsd ?? sleeveTargetEquity);
        if (sizeUsd > 0) {
          const order = await placeMarketOrder(config.creds, config.mode, {
            symbol: sleeve.symbol,
            side: 'buy',
            notional: sizeUsd,
          });
          orders.push({
            symbol: sleeve.symbol,
            side: 'buy',
            notional: sizeUsd,
            qty: null,
            orderId: order.id,
            status: order.status,
            submitted: order.submitted,
            reason: signal.reason,
          });
          insertLiveTrade({
            runName: config.name,
            mode: config.mode,
            symbol: sleeve.symbol,
            strategy: sleeve.strategy.name,
            side: 'buy',
            alpacaOrderId: order.submitted ? order.id : null,
            notional: sizeUsd,
            qty: null,
            reason: signal.reason,
            submitted: order.submitted,
            t: now,
          });
        }
      } else if (signal.action === 'exit' && livePos) {
        const order = await closePosition(
          config.creds,
          config.mode,
          sleeve.symbol,
        );
        orders.push({
          symbol: sleeve.symbol,
          side: 'sell',
          notional: null,
          qty: livePos.qty,
          orderId: order.id,
          status: order.status,
          submitted: order.submitted,
          reason: signal.reason,
        });
        insertLiveTrade({
          runName: config.name,
          mode: config.mode,
          symbol: sleeve.symbol,
          strategy: sleeve.strategy.name,
          side: 'sell',
          alpacaOrderId: order.submitted ? order.id : null,
          notional: null,
          qty: livePos.qty,
          reason: signal.reason,
          submitted: order.submitted,
          t: now,
        });
      }
      // signal.action === 'hold' — no action taken.
    } catch (err) {
      errors.push(
        `${sleeve.symbol} order submit: ${(err as Error).message}`,
      );
    }
  }

  // 5. Persist the tick record ─────────────────────────────────
  const result: TickResult = {
    runName: config.name,
    mode: config.mode,
    t: now,
    accountEquity,
    accountCash,
    sleeveSignals,
    ordersPlaced: orders,
    errors,
  };

  insertLiveTick({
    runName: result.runName,
    mode: result.mode,
    t: result.t,
    accountEquity: result.accountEquity,
    accountCash: result.accountCash,
    sleeveSignals: result.sleeveSignals.map(s => ({
      symbol: s.symbol,
      strategy: s.strategy,
      action: s.action,
      reason: s.reason,
    })),
    orders: result.ordersPlaced.map(o => ({
      symbol: o.symbol,
      side: o.side,
      notional: o.notional,
      qty: o.qty,
      submitted: o.submitted,
      orderId: o.orderId,
      status: o.status,
    })),
    errors: result.errors,
  });

  return result;
}
