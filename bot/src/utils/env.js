/* Apex Trader — environment loading and validation.
   Fails fast and loudly: a misread env var in a trading bot costs money. */

import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// dotenv does not overwrite an already-set var, so the FIRST file to define a
// key wins. Order is most-specific to least: bot-local, bot, root-local, root.
// `.env.local` is included because that's the Next.js convention and it's what
// you reach for out of habit when the repo has a dashboard in it.
const ENV_FILES = [
  '../../.env.local',
  '../../.env',
  '../../../.env.local',
  '../../../.env',
];

for (const rel of ENV_FILES) {
  loadDotenv({ path: resolve(__dirname, rel) });
}

const PAPER_URL = 'https://paper-api.alpaca.markets';

class EnvError extends Error {
  constructor(message) {
    super(message);
    this.name = 'EnvError';
  }
}

function required(key) {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') {
    throw new EnvError(`Missing required env var ${key}. Copy bot/.env.example to bot/.env and fill it in.`);
  }
  return raw.trim();
}

function optional(key, fallback) {
  const raw = process.env[key];
  return raw === undefined || raw.trim() === '' ? fallback : raw.trim();
}

function num(key, fallback) {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') {
    if (fallback === undefined) throw new EnvError(`Missing required numeric env var ${key}.`);
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new EnvError(`Env var ${key} must be a finite number, got "${raw}".`);
  }
  return parsed;
}

/** Like num(), but returns undefined when unset instead of throwing. */
function optionalNum(key) {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return undefined;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new EnvError(`Env var ${key} must be a finite number, got "${raw}".`);
  }
  return parsed;
}

/** A ratio in (0, 1]. Accepts "0.15" or "15%". */
function pct(key, fallback) {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') {
    if (fallback === undefined) throw new EnvError(`Missing required ratio env var ${key}.`);
    return fallback;
  }
  const trimmed = raw.trim();
  const parsed = trimmed.endsWith('%') ? Number(trimmed.slice(0, -1)) / 100 : Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1) {
    throw new EnvError(`Env var ${key} must be a ratio in (0, 1] (e.g. 0.15 or 15%), got "${raw}".`);
  }
  return parsed;
}

/**
 * Like pct(), but the stop it configures can be switched OFF explicitly.
 *
 * A safety net that defaults ON needs a documented way to disable it, and
 * `MAX_DRAWDOWN_PCT=0` is what someone reaches for — pct() rejects that as
 * out of range, which reads as a config error rather than "off".
 */
function pctOrOff(key, fallback) {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  const v = raw.trim().toLowerCase();
  if (v === 'off' || v === 'none' || v === '0' || v === 'false') return undefined;
  return pct(key, fallback);
}

/** Defaults to `fallback`; only an explicit false-y word turns it off. */
function bool(key, fallback) {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  const v = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  throw new EnvError(`Env var ${key} must be true/false, got "${raw}".`);
}

/**
 * Per-symbol notional floor, falling back to the global default.
 * BTC/USD -> MIN_ORDER_NOTIONAL_BTCUSD, then MIN_ORDER_NOTIONAL, then 10.
 */
export function minNotionalFor(symbol) {
  const slug = String(symbol).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const specific = optionalNum(`MIN_ORDER_NOTIONAL_${slug}`);
  if (specific !== undefined) {
    if (specific <= 0) throw new EnvError(`MIN_ORDER_NOTIONAL_${slug} must be positive, got ${specific}.`);
    return specific;
  }
  return num('MIN_ORDER_NOTIONAL', 10);
}

function oneOf(key, allowed, fallback) {
  const value = optional(key, fallback);
  if (!allowed.includes(value)) {
    throw new EnvError(`Env var ${key} must be one of ${allowed.join(' | ')}, got "${value}".`);
  }
  return value;
}

/**
 * Load just the Alpaca credentials and trading mode.
 * Separate from loadEnv() so credential checks don't require a grid config.
 *
 * @returns {Readonly<object>} { alpaca: {...}, tradingMode }
 */
export function loadAlpacaEnv() {
  const tradingMode = oneOf('TRADING_MODE', ['paper', 'live'], 'paper');
  let baseUrl = optional('ALPACA_BASE_URL', PAPER_URL);

  // Safety interlock: paper mode can never reach the live endpoint, whatever
  // ALPACA_BASE_URL says. Going live must be a deliberate two-part change.
  if (tradingMode === 'paper' && baseUrl !== PAPER_URL) {
    console.warn(`[env] TRADING_MODE=paper — overriding ALPACA_BASE_URL "${baseUrl}" with ${PAPER_URL}`);
    baseUrl = PAPER_URL;
  }

  if (tradingMode === 'live') {
    console.warn('[env] ⚠️  TRADING_MODE=live — orders will use real funds.');
  }

  return Object.freeze({
    alpaca: Object.freeze({
      keyId: required('ALPACA_KEY_ID'),
      secretKey: required('ALPACA_SECRET_KEY'),
      baseUrl,
      dataUrl: optional('ALPACA_DATA_URL', 'https://data.alpaca.markets'),
      paper: tradingMode === 'paper',
    }),
    tradingMode,
  });
}

/**
 * Load and validate the full bot environment.
 * @returns {object} frozen config object
 */
export function loadEnv() {
  const { alpaca, tradingMode } = loadAlpacaEnv();

  const env = {
    alpaca,
    tradingMode,
    // Shape of the grid. Bounds and order size are DERIVED at runtime from
    // live account state unless explicitly pinned below.
    grid: {
      symbol: optional('GRID_SYMBOL', 'BTC/USD'),
      levels: num('GRID_LEVELS', 20),
      spacing: oneOf('GRID_SPACING', ['arithmetic', 'geometric'], 'geometric'),

      // Optional absolute overrides. Setting these opts out of auto-scaling —
      // they will NOT grow with the account.
      lowerBound: optionalNum('GRID_LOWER_BOUND'),
      upperBound: optionalNum('GRID_UPPER_BOUND'),
      orderSize: optionalNum('GRID_ORDER_SIZE'),
    },

    // Ratios the grid rescales itself from.
    ratios: {
      /** Half-width of the band around the anchor. 0.15 => anchor ±15%. */
      bandPct: pct('GRID_BAND_PCT', 0.15),
      /** Fraction of equity the grid may deploy at worst case. */
      allocationPct: pct('GRID_ALLOCATION_PCT', 0.8),
      /** manual | session | on_flat | rolling — see grid/sizing.js resolveAnchor(). */
      anchorMode: oneOf('GRID_ANCHOR_MODE', ['manual', 'session', 'on_flat', 'rolling'], 'on_flat'),
      /** Required only when anchorMode is 'manual'. */
      manualAnchor: optionalNum('GRID_ANCHOR_PRICE'),
      /** rolling only: re-anchor once drift exceeds this fraction of half-band. */
      reanchorDrift: pct('GRID_REANCHOR_DRIFT', 0.5),

      /** session | on_flat | on_fill — when new levels adopt a new size. */
      resizeMode: oneOf('GRID_RESIZE_MODE', ['session', 'on_flat', 'on_fill'], 'on_flat'),
      /** Minimum relative size change worth acting on. Suppresses order churn. */
      resizeThreshold: pct('GRID_RESIZE_THRESHOLD', 0.1),
      /**
       * Quote-currency floor per order. Alpaca enforces this on crypto and
       * does NOT expose it via the assets endpoint, so it cannot be read live.
       *
       * $10 is not a guess — `npm run bot:probe` measured it directly from
       * Alpaca's own rejection text across BTC, ETH, LTC and DOGE, all
       * uniform. A per-symbol override exists in case that ever diverges:
       * MIN_ORDER_NOTIONAL_BTCUSD takes precedence over MIN_ORDER_NOTIONAL.
       */
      minOrderNotional: minNotionalFor(optional('GRID_SYMBOL', 'BTC/USD')),
      /**
       * Exchange fee per side, taken from the delivered asset on a buy and
       * from proceeds on a sell. 0.15% measured on Alpaca crypto. Realized
       * P&L is reported NET of this; getting it wrong misreports performance,
       * it does not affect order placement.
       */
      feeRate: pct('FEE_RATE', 0.0015),
    },

    risk: {
      /** Halt if the day's loss exceeds this fraction of equity. */
      maxDailyLossPct: pct('MAX_DAILY_LOSS_PCT', 0.05),
      /** Optional hard dollar floor, independent of equity. */
      maxDailyLossUsd: optionalNum('MAX_DAILY_LOSS_USD'),
      /**
       * Halt if equity falls this far below its high-water mark.
       *
       * MAX_DAILY_LOSS_PCT resets every session, so it is blind to a slow
       * grind: losing 3% a day for ten days never trips a 5% daily stop but
       * costs a quarter of the account. Measured on the bundled datasets —
       * BTC 2026 drew down 7.5% peak-to-trough with no single day worse than
       * -3.1%, so the daily stop never fired once.
       *
       * Defaults ON at 20%, calibrated to sit ABOVE every drawdown seen in
       * normal operation on the bundled datasets (BTC peaked at 8.4%, ETH at
       * 16.3%) so it does not interrupt a working grid, while still bounding
       * a collapse. A tighter 15% halts the ETH 2024 run near the bottom and
       * turns -7.45% into -13.73% — the recovery never happens.
       *
       * This is tail insurance, not a return improver: on every window we
       * have, firing it costs money. It earns its keep in the case the data
       * does NOT contain — a decline that keeps going.
       *
       * Set MAX_DRAWDOWN_PCT=off to disable. Like the daily stop it HALTS —
       * cancels resting orders, keeps the position — it never liquidates.
       */
      maxDrawdownPct: pctOrOff('MAX_DRAWDOWN_PCT', 0.20),
      /**
       * Price stop, as a fraction below the band's lower bound. Rescales with
       * the band, exactly like the bounds themselves. Opt-in: unset means the
       * bot holds stranded inventory indefinitely rather than realizing a loss.
       */
      stopPct: optionalNum('GRID_STOP_PCT'),
    },
    runtime: {
      /** Defaults to true. Nothing is ever submitted until you opt out. */
      dryRun: bool('DRY_RUN', true),
      pollIntervalMs: num('POLL_INTERVAL_MS', 5000),
      logLevel: optional('LOG_LEVEL', 'info'),
      /**
       * Hours of idling-while-holding before the bot reports itself degraded.
       *
       * Idle is a legitimate state — price left the band and the position
       * still needs its exit levels — but it is indistinguishable from
       * working. Backtests spent up to 58 unbroken days here while /health
       * reported ok. This is the threshold at which that becomes visible.
       */
      idleAlertHours: num('IDLE_ALERT_HOURS', 24),
      /**
       * Railway, Render, Fly and Heroku all inject PORT and route to it.
       * Honour that first, or the platform health check hits a closed port
       * and the deploy is marked failed while the bot runs fine.
       */
      apiPort: optionalNum('PORT') ?? num('API_PORT', 4000),
      /** Without this the API binds 127.0.0.1 only. Required to expose it. */
      apiToken: optional('API_TOKEN', undefined),
      apiHost: optional('API_HOST', undefined),
      corsOrigin: optional('DASHBOARD_ORIGIN', 'http://localhost:3000'),
      nodeEnv: optional('NODE_ENV', 'development'),
    },
  };

  return Object.freeze(env);
}

export { EnvError };
