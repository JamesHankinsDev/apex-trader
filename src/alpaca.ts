// Alpaca historical crypto bars client. Minimal: only what the backtester
// needs today. Live trading / order placement / streaming will come later.

import axios from 'axios';
import type { Bar, Timeframe } from './types.js';

const BASE = 'https://data.alpaca.markets/v1beta3/crypto/us';

export interface AlpacaCredentials {
  apiKey: string;
  secretKey: string;
}

interface RawBar {
  t: string; // ISO timestamp
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface BarsResponse {
  bars: Record<string, RawBar[]>;
  next_page_token: string | null;
}

function normalizeSymbol(symbol: string): string {
  return symbol.includes('/') ? symbol : symbol.replace(/USD$/, '/USD');
}

function toBar(raw: RawBar): Bar {
  return {
    t: new Date(raw.t).getTime(),
    o: raw.o,
    h: raw.h,
    l: raw.l,
    c: raw.c,
    v: raw.v,
  };
}

// Fetch all bars for a symbol between two timestamps. Paginates automatically.
// `start` / `end` are unix ms. Returns oldest-first.
export async function fetchHistoricalBars(
  creds: AlpacaCredentials,
  symbol: string,
  timeframe: Timeframe,
  startMs: number,
  endMs: number,
): Promise<Bar[]> {
  const sym = normalizeSymbol(symbol);
  const headers = {
    'APCA-API-KEY-ID': creds.apiKey,
    'APCA-API-SECRET-KEY': creds.secretKey,
  };

  const all: Bar[] = [];
  let pageToken: string | null = null;
  let pages = 0;
  const MAX_PAGES = 200; // safety cap; 200 pages * 10k bars is ample for years of 1h data

  do {
    const params: Record<string, string | number> = {
      symbols: sym,
      timeframe,
      start: new Date(startMs).toISOString(),
      end: new Date(endMs).toISOString(),
      limit: 10000,
    };
    if (pageToken) params.page_token = pageToken;

    const res = await getWithRetry<BarsResponse>(
      `${BASE}/bars`,
      params,
      headers,
    );

    const raws = res.bars?.[sym] ?? [];
    for (const r of raws) all.push(toBar(r));

    pageToken = res.next_page_token ?? null;
    pages++;
  } while (pageToken && pages < MAX_PAGES);

  // Sort + dedupe by timestamp (API pagination is already ordered but be defensive).
  all.sort((a, b) => a.t - b.t);
  const deduped: Bar[] = [];
  let lastT = -1;
  for (const b of all) {
    if (b.t !== lastT) {
      deduped.push(b);
      lastT = b.t;
    }
  }
  return deduped;
}

// Fetch with retry on 429 (rate limit) or transient network errors.
// Alpaca crypto data API has a low burst budget — this lets us spread out
// large historical fetches without tripping the limiter.
async function getWithRetry<T>(
  url: string,
  params: Record<string, string | number>,
  headers: Record<string, string>,
  maxAttempts = 6,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await axios.get<T>(url, { params, headers, timeout: 30_000 });
      return res.data;
    } catch (err) {
      lastErr = err;
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 429 || (status !== undefined && status >= 500)) {
        // exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s
        const delayMs = 1000 * 2 ** attempt;
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }
      throw err;
    }
  }
  throw lastErr ?? new Error('fetch failed after retries');
}

export function loadCredentials(): AlpacaCredentials {
  const apiKey = process.env.ALPACA_API_KEY;
  const secretKey = process.env.ALPACA_SECRET_KEY;
  if (!apiKey || !secretKey) {
    throw new Error(
      'Missing ALPACA_API_KEY / ALPACA_SECRET_KEY. Copy .env.example to .env and fill in Alpaca paper credentials.',
    );
  }
  return { apiKey, secretKey };
}

// ── TRADING API ──────────────────────────────────────────────
// The data API above is read-only and safe. The trading API places orders
// against paper or live accounts. Trading is gated behind TRADING_ENABLED
// to prevent accidental orders from a misconfigured dev environment.

export type AlpacaMode = 'paper' | 'live';

function tradingBaseUrl(mode: AlpacaMode): string {
  return mode === 'live'
    ? 'https://api.alpaca.markets'
    : 'https://paper-api.alpaca.markets';
}

function tradingCreds(): {
  paper: AlpacaCredentials | null;
  live: AlpacaCredentials | null;
} {
  return {
    paper:
      process.env.ALPACA_PAPER_API_KEY && process.env.ALPACA_PAPER_SECRET_KEY
        ? {
            apiKey: process.env.ALPACA_PAPER_API_KEY,
            secretKey: process.env.ALPACA_PAPER_SECRET_KEY,
          }
        : null,
    live:
      process.env.ALPACA_LIVE_API_KEY && process.env.ALPACA_LIVE_SECRET_KEY
        ? {
            apiKey: process.env.ALPACA_LIVE_API_KEY,
            secretKey: process.env.ALPACA_LIVE_SECRET_KEY,
          }
        : null,
  };
}

export function loadTradingCredentials(mode: AlpacaMode): AlpacaCredentials {
  const creds = tradingCreds();
  const c = creds[mode];
  if (!c) {
    throw new Error(
      `Missing ALPACA_${mode.toUpperCase()}_API_KEY / SECRET_KEY env vars — required for ${mode} trading.`,
    );
  }
  return c;
}

function tradingHeaders(c: AlpacaCredentials): Record<string, string> {
  return {
    'APCA-API-KEY-ID': c.apiKey,
    'APCA-API-SECRET-KEY': c.secretKey,
    'Content-Type': 'application/json',
  };
}

export interface AlpacaAccount {
  cash: number;
  equity: number;
  buyingPower: number;
  portfolioValue: number;
}

export async function getAccount(
  creds: AlpacaCredentials,
  mode: AlpacaMode,
): Promise<AlpacaAccount> {
  const res = await axios.get(`${tradingBaseUrl(mode)}/v2/account`, {
    headers: tradingHeaders(creds),
    timeout: 10_000,
  });
  const d = res.data;
  return {
    cash: Number(d.cash),
    equity: Number(d.equity),
    buyingPower: Number(d.buying_power),
    portfolioValue: Number(d.portfolio_value),
  };
}

export interface AlpacaPosition {
  symbol: string;       // canonical form with slash: "BTC/USD"
  qty: number;
  avgEntryPrice: number;
  marketValue: number;
  unrealizedPlPct: number;
}

function canonicalSymbol(raw: string): string {
  // Alpaca returns positions as "BTCUSD"; we use "BTC/USD" everywhere else.
  if (raw.includes('/')) return raw;
  return raw.replace(/USD$/, '/USD');
}

export async function getPositions(
  creds: AlpacaCredentials,
  mode: AlpacaMode,
): Promise<AlpacaPosition[]> {
  const res = await axios.get(`${tradingBaseUrl(mode)}/v2/positions`, {
    headers: tradingHeaders(creds),
    timeout: 10_000,
  });
  // Alpaca returns an array; map to our shape.
  return (res.data as Array<Record<string, string>>).map(p => ({
    symbol: canonicalSymbol(p.symbol ?? ''),
    qty: Number(p.qty),
    avgEntryPrice: Number(p.avg_entry_price),
    marketValue: Number(p.market_value),
    unrealizedPlPct: Number(p.unrealized_plpc) * 100,
  }));
}

export interface OrderParams {
  symbol: string;              // "BTC/USD"
  side: 'buy' | 'sell';
  notional?: number;           // USD amount (for buys)
  qty?: number;                // unit quantity (for sells)
}

export interface OrderResult {
  id: string;
  status: string;
  submittedAt: string;
  symbol: string;
  side: string;
  notional: number | null;
  qty: number | null;
  // true if this was actually sent to Alpaca; false if blocked by safety flag
  submitted: boolean;
}

// Place a market order. Blocks submission unless TRADING_ENABLED=true in env.
// For buys: prefer notional (dollar amount). For sells: prefer qty (whole units).
export async function placeMarketOrder(
  creds: AlpacaCredentials,
  mode: AlpacaMode,
  params: OrderParams,
): Promise<OrderResult> {
  const { symbol, side, notional, qty } = params;
  const safetyOff = process.env.TRADING_ENABLED !== 'true';

  if (safetyOff) {
    console.log(
      `[TRADING_ENABLED=${process.env.TRADING_ENABLED ?? 'unset'}] blocked ` +
        `${side} ${symbol} ${notional ? '$' + notional.toFixed(2) : qty + ' units'}`,
    );
    return {
      id: 'dry-run',
      status: 'blocked-by-safety-flag',
      submittedAt: new Date().toISOString(),
      symbol,
      side,
      notional: notional ?? null,
      qty: qty ?? null,
      submitted: false,
    };
  }

  const body: Record<string, string> = {
    // Alpaca expects "BTCUSD" on orders (no slash)
    symbol: symbol.replace('/', ''),
    side,
    type: 'market',
    time_in_force: 'gtc',
  };
  if (side === 'buy' && notional !== undefined) {
    body.notional = notional.toFixed(2);
  } else if (qty !== undefined) {
    body.qty = qty.toString();
  } else {
    throw new Error('placeMarketOrder requires notional (buy) or qty (sell)');
  }

  const res = await axios.post(`${tradingBaseUrl(mode)}/v2/orders`, body, {
    headers: tradingHeaders(creds),
    timeout: 10_000,
  });
  const d = res.data;
  return {
    id: String(d.id),
    status: String(d.status),
    submittedAt: String(d.submitted_at),
    symbol,
    side,
    notional: notional ?? null,
    qty: qty ?? null,
    submitted: true,
  };
}

// Close an entire position at market. Useful for exit signals and crash-
// protection triggers where we want to sell everything we hold.
export async function closePosition(
  creds: AlpacaCredentials,
  mode: AlpacaMode,
  symbol: string,
): Promise<OrderResult> {
  const safetyOff = process.env.TRADING_ENABLED !== 'true';
  if (safetyOff) {
    console.log(
      `[TRADING_ENABLED=${process.env.TRADING_ENABLED ?? 'unset'}] blocked close ${symbol}`,
    );
    return {
      id: 'dry-run',
      status: 'blocked-by-safety-flag',
      submittedAt: new Date().toISOString(),
      symbol,
      side: 'sell',
      notional: null,
      qty: null,
      submitted: false,
    };
  }
  const sym = symbol.replace('/', '');
  const res = await axios.delete(
    `${tradingBaseUrl(mode)}/v2/positions/${sym}`,
    { headers: tradingHeaders(creds), timeout: 10_000 },
  );
  const d = res.data;
  return {
    id: String(d.id ?? 'close'),
    status: String(d.status ?? 'submitted'),
    submittedAt: String(d.submitted_at ?? new Date().toISOString()),
    symbol,
    side: 'sell',
    notional: null,
    qty: null,
    submitted: true,
  };
}
