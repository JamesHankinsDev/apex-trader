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
    grid: {
      symbol: optional('GRID_SYMBOL', 'BTC/USD'),
      lowerBound: num('GRID_LOWER_BOUND'),
      upperBound: num('GRID_UPPER_BOUND'),
      levels: num('GRID_LEVELS', 20),
      spacing: oneOf('GRID_SPACING', ['arithmetic', 'geometric'], 'geometric'),
      orderSize: num('GRID_ORDER_SIZE'),
    },
    risk: {
      maxPositionUsd: num('MAX_POSITION_USD', 5000),
      maxDailyLossUsd: num('MAX_DAILY_LOSS_USD', -250),
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
