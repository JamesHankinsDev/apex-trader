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
 * Resolve the day's stop-loss in dollars from live equity.
 *
 * The ratio scales with the account; the optional absolute value acts as a
 * hard floor so a growing balance can't quietly widen the loss you tolerate.
 * Whichever is tighter wins.
 *
 * @param {object} risk    { maxDailyLossPct, maxDailyLossUsd? }
 * @param {number} equity  live account equity
 * @returns {{ maxDailyLossUsd: number, source: string }} loss as a NEGATIVE number
 */
export function resolveRiskLimits(risk, equity) {
  assert(Number.isFinite(equity) && equity > 0, `equity must be positive, got ${equity}.`);
  assert(
    Number.isFinite(risk?.maxDailyLossPct) && risk.maxDailyLossPct > 0 && risk.maxDailyLossPct <= 1,
    `risk.maxDailyLossPct must be a ratio in (0, 1], got ${risk?.maxDailyLossPct}.`,
  );

  const fromPct = -(equity * risk.maxDailyLossPct);

  if (risk.maxDailyLossUsd === undefined) {
    return { maxDailyLossUsd: fromPct, source: 'MAX_DAILY_LOSS_PCT' };
  }

  assert(risk.maxDailyLossUsd < 0,
    `MAX_DAILY_LOSS_USD must be negative, got ${risk.maxDailyLossUsd}.`);

  // Both are negative; the tighter stop is the one closer to zero.
  return risk.maxDailyLossUsd > fromPct
    ? { maxDailyLossUsd: risk.maxDailyLossUsd, source: 'MAX_DAILY_LOSS_USD (tighter)' }
    : { maxDailyLossUsd: fromPct, source: 'MAX_DAILY_LOSS_PCT (tighter)' };
}

/**
 * Price at which stranded inventory is cut, derived from the band the same
 * way the bounds are — so it rescales whenever the band does.
 *
 *   stopPrice = lowerBound x (1 - stopPct)
 *
 * This is the counterpart to the daily loss stop, and they catch different
 * failures. The daily stop is a dollar limit on how fast you can lose; this
 * is a price limit on how far one position can run against you. With
 * `on_flat` anchoring, a position that never recovers idles the bot forever —
 * this converts that indefinite idle into a bounded, realized loss, after
 * which the grid is flat and free to re-anchor.
 *
 * Opt-in: returns null when stopPct is undefined, and the bot simply holds.
 *
 * @param {object} gridConfig  normalized grid config
 * @param {number} [stopPct]   fraction below lowerBound, e.g. 0.10
 * @returns {{ stopPrice: number, distancePct: number } | null}
 */
export function resolveStopPrice(gridConfig, stopPct) {
  if (stopPct === undefined || stopPct === null) return null;

  assert(Number.isFinite(stopPct) && stopPct > 0 && stopPct < 1,
    `GRID_STOP_PCT must be a ratio in (0, 1), got ${stopPct}.`);

  const stopPrice = gridConfig.lowerBound * (1 - stopPct);

  return {
    stopPrice,
    /** How far the stop sits below the anchor, for reporting. */
    distancePct: 1 - stopPrice / gridConfig.upperBound,
  };
}

/**
 * Refuse a grid the account cannot actually fund.
 *
 * Checked against LIVE buying power rather than a static env number, so it
 * stays correct as the balance moves.
 *
 * `heldCost` is what already-filled levels spent. That cash is not gone — it
 * became inventory, and those levels need no further funding. Ignoring it
 * makes a healthy grid look unfundable the moment it starts working: the
 * backtest halted after three fills because $33 of cash had turned into BTC
 * and the check still demanded cash for all seven levels.
 *
 * @param {object} gridConfig
 * @param {number} buyingPower  live, with our own resting buys added back
 * @param {number} [heldCost]   cost basis of inventory the grid already holds
 */
export function assertWithinBuyingPower(gridConfig, buyingPower, heldCost = 0) {
  assert(Number.isFinite(buyingPower) && buyingPower >= 0,
    `buyingPower must be a non-negative number, got ${buyingPower}.`);
  assert(Number.isFinite(heldCost) && heldCost >= 0,
    `heldCost must be a non-negative number, got ${heldCost}.`);

  const capital = buyingPower + heldCost;

  assert(gridConfig.maxNotional <= capital,
    `Grid worst-case notional $${gridConfig.maxNotional.toFixed(2)} exceeds available capital ` +
    `$${capital.toFixed(2)} (cash $${buyingPower.toFixed(2)} + held $${heldCost.toFixed(2)}). ` +
    `Lower GRID_ALLOCATION_PCT or GRID_LEVELS.`);
}
