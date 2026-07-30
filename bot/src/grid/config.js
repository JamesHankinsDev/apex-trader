/* Apex Trader — grid strategy configuration: normalization + validation.
   Keep every "is this sane?" check here so the engine can assume valid input. */

/** Spacing modes. arithmetic = equal $ gaps; geometric = equal % gaps. */
export const SPACING = Object.freeze({
  ARITHMETIC: 'arithmetic',
  GEOMETRIC: 'geometric',
});

/** Defaults applied when a field is omitted. */
export const DEFAULTS = Object.freeze({
  levels: 20,
  spacing: SPACING.GEOMETRIC,
  // Fraction of the gap between levels that price must cross before the
  // engine acts. Prevents order churn when price oscillates on a boundary.
  hysteresis: 0.1,
});

export class GridConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GridConfigError';
  }
}

function assert(condition, message) {
  if (!condition) throw new GridConfigError(message);
}

/**
 * Validate and normalize a raw grid config into the shape the engine expects.
 *
 * @param {object} raw
 * @param {string} raw.symbol       Alpaca crypto pair, e.g. "BTC/USD"
 * @param {number} raw.lowerBound   Bottom of the grid band (quote currency)
 * @param {number} raw.upperBound   Top of the grid band (quote currency)
 * @param {number} [raw.levels]     Number of levels, inclusive of both bounds
 * @param {string} [raw.spacing]    SPACING.ARITHMETIC | SPACING.GEOMETRIC
 * @param {number} raw.orderSize    Base-asset qty per level
 * @param {number} [raw.hysteresis] 0..1 fraction of a gap
 * @returns {Readonly<object>} normalized config
 */
export function normalizeGridConfig(raw = {}) {
  const {
    symbol,
    lowerBound,
    upperBound,
    levels = DEFAULTS.levels,
    spacing = DEFAULTS.spacing,
    orderSize,
    hysteresis = DEFAULTS.hysteresis,
  } = raw;

  assert(typeof symbol === 'string' && symbol.includes('/'),
    `symbol must be an Alpaca pair like "BTC/USD", got ${JSON.stringify(symbol)}.`);

  assert(Number.isFinite(lowerBound) && lowerBound > 0,
    `lowerBound must be a positive number, got ${lowerBound}.`);
  assert(Number.isFinite(upperBound) && upperBound > 0,
    `upperBound must be a positive number, got ${upperBound}.`);
  assert(upperBound > lowerBound,
    `upperBound (${upperBound}) must be greater than lowerBound (${lowerBound}).`);

  assert(Number.isInteger(levels) && levels >= 2,
    `levels must be an integer >= 2, got ${levels}.`);
  // Above ~500 levels Alpaca's open-order cap and rate limits become the
  // binding constraint, not the strategy. Fail rather than silently throttle.
  assert(levels <= 500, `levels must be <= 500, got ${levels}.`);

  assert(Object.values(SPACING).includes(spacing),
    `spacing must be one of ${Object.values(SPACING).join(' | ')}, got "${spacing}".`);

  assert(Number.isFinite(orderSize) && orderSize > 0,
    `orderSize must be a positive number, got ${orderSize}.`);

  assert(Number.isFinite(hysteresis) && hysteresis >= 0 && hysteresis < 1,
    `hysteresis must be in [0, 1), got ${hysteresis}.`);

  return Object.freeze({
    symbol,
    lowerBound,
    upperBound,
    levels,
    spacing,
    orderSize,
    hysteresis,
    /** Quote-currency notional if every level were filled. */
    maxNotional: orderSize * levels * upperBound,
  });
}

/**
 * Validate a normalized grid config against account risk limits.
 * Separate from normalization because limits live outside the strategy.
 *
 * @param {object} gridConfig  output of normalizeGridConfig
 * @param {object} risk        { maxPositionUsd, maxDailyLossUsd }
 */
export function assertWithinRiskLimits(gridConfig, risk) {
  assert(Number.isFinite(risk?.maxPositionUsd) && risk.maxPositionUsd > 0,
    `risk.maxPositionUsd must be a positive number, got ${risk?.maxPositionUsd}.`);
  assert(Number.isFinite(risk?.maxDailyLossUsd) && risk.maxDailyLossUsd < 0,
    `risk.maxDailyLossUsd must be a negative number, got ${risk?.maxDailyLossUsd}.`);

  assert(gridConfig.maxNotional <= risk.maxPositionUsd,
    `Grid worst-case notional $${gridConfig.maxNotional.toFixed(2)} exceeds ` +
    `MAX_POSITION_USD $${risk.maxPositionUsd.toFixed(2)}. ` +
    `Reduce GRID_ORDER_SIZE or GRID_LEVELS, or raise the limit.`);
}

/** Build a grid config straight from a loaded env object. */
export function gridConfigFromEnv(env) {
  const cfg = normalizeGridConfig(env.grid);
  assertWithinRiskLimits(cfg, env.risk);
  return cfg;
}
