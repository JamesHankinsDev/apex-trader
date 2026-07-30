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
      /** manual | session | rolling — see grid/sizing.js resolveAnchor(). */
      anchorMode: oneOf('GRID_ANCHOR_MODE', ['manual', 'session', 'rolling'], 'session'),
      /** Required only when anchorMode is 'manual'. */
      manualAnchor: optionalNum('GRID_ANCHOR_PRICE'),
      /** rolling only: re-anchor once drift exceeds this fraction of half-band. */
      reanchorDrift: pct('GRID_REANCHOR_DRIFT', 0.5),

      /** session | on_flat | on_fill — when new levels adopt a new size. */
      resizeMode: oneOf('GRID_RESIZE_MODE', ['session', 'on_flat', 'on_fill'], 'on_flat'),
      /** Minimum relative size change worth acting on. Suppresses order churn. */
      resizeThreshold: pct('GRID_RESIZE_THRESHOLD', 0.1),
    },

    risk: {
      /** Halt if the day's loss exceeds this fraction of equity. */
      maxDailyLossPct: pct('MAX_DAILY_LOSS_PCT', 0.05),
      /** Optional hard dollar floor, independent of equity. */
      maxDailyLossUsd: optionalNum('MAX_DAILY_LOSS_USD'),
    },
    runtime: {
      pollIntervalMs: num('POLL_INTERVAL_MS', 5000),
      logLevel: optional('LOG_LEVEL', 'info'),
      apiPort: num('API_PORT', 4000),
      nodeEnv: optional('NODE_ENV', 'development'),
    },
  };

  return Object.freeze(env);
}

export { EnvError };
