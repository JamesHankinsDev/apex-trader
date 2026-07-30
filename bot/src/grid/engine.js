/* Apex Trader — grid engine.

   Status: level calculation is implemented and testable. Order placement and
   fill tracking are scaffolded with their intended shape and left as TODOs —
   they need a live Alpaca client and are the next build step.

   Model: a grid is N price levels spanning [lowerBound, upperBound]. The
   engine keeps a resting BUY at every level below current price and a resting
   SELL at every level above it. When a BUY fills, a SELL is placed one level
   up (and vice versa) — that round trip is the profit unit. */

import { SPACING } from './config.js';

/** @typedef {{ index: number, price: number, side: 'buy'|'sell'|null }} GridLevel */

/**
 * Compute the grid's price levels.
 *
 * arithmetic — equal absolute gaps:  p_i = lower + i * (upper - lower)/(n-1)
 * geometric  — equal relative gaps:  p_i = lower * (upper/lower)^(i/(n-1))
 *
 * Geometric is usually the right default for crypto: a $500 move matters far
 * more at $20k than at $100k, and equal percentage steps keep the profit per
 * round trip constant across the band.
 *
 * @param {object} cfg  normalized grid config
 * @returns {GridLevel[]} ascending by price, length === cfg.levels
 */
export function calculateLevels(cfg) {
  const { lowerBound, upperBound, levels, spacing } = cfg;
  const steps = levels - 1;
  const out = new Array(levels);

  if (spacing === SPACING.ARITHMETIC) {
    const gap = (upperBound - lowerBound) / steps;
    for (let i = 0; i < levels; i++) {
      out[i] = { index: i, price: lowerBound + i * gap, side: null };
    }
  } else {
    const ratio = Math.pow(upperBound / lowerBound, 1 / steps);
    for (let i = 0; i < levels; i++) {
      out[i] = { index: i, price: lowerBound * Math.pow(ratio, i), side: null };
    }
  }

  // Pin the endpoints exactly — floating-point drift over many multiplications
  // can otherwise place the top level a few cents outside the configured band.
  out[0].price = lowerBound;
  out[levels - 1].price = upperBound;

  return out;
}

/**
 * Assign a side to each level given the current market price.
 * Levels below price rest as BUYs, levels above rest as SELLs. The level
 * nearest price gets no order — that's the spread the grid earns across.
 *
 * @param {GridLevel[]} levels  from calculateLevels
 * @param {number} price        current market price
 * @returns {GridLevel[]} new array; input is not mutated
 */
export function assignSides(levels, price) {
  if (!Number.isFinite(price) || price <= 0) {
    throw new TypeError(`assignSides requires a positive price, got ${price}.`);
  }

  // The level closest to current price is left flat.
  let nearest = 0;
  let nearestDist = Infinity;
  for (const lvl of levels) {
    const dist = Math.abs(lvl.price - price);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = lvl.index;
    }
  }

  return levels.map((lvl) => ({
    ...lvl,
    side: lvl.index === nearest ? null : (lvl.price < price ? 'buy' : 'sell'),
  }));
}

/** True when price sits outside the configured band — the grid should idle. */
export function isOutOfBand(cfg, price) {
  return price < cfg.lowerBound || price > cfg.upperBound;
}

/**
 * Gap to the adjacent level, used for hysteresis and for pricing the
 * counter-order after a fill.
 *
 * @returns {number} absolute price distance to the next level up
 */
export function gapAt(levels, index) {
  const here = levels[index];
  const next = levels[index + 1] ?? levels[index - 1];
  return Math.abs(next.price - here.price);
}

export class GridEngine {
  /**
   * @param {object} opts
   * @param {object} opts.config   normalized grid config
   * @param {object} opts.client   Alpaca client (injected — keeps this testable)
   * @param {object} [opts.logger] console-compatible logger
   */
  constructor({ config, client, logger = console }) {
    this.config = config;
    this.client = client;
    this.logger = logger;

    this.levels = calculateLevels(config);
    /** @type {Map<number, object>} level index -> open order */
    this.openOrders = new Map();
    /** @type {object[]} completed fills, newest last */
    this.fills = [];
    this.running = false;
  }

  /** Price levels with sides assigned for the given market price. */
  plan(price) {
    if (isOutOfBand(this.config, price)) return [];
    return assignSides(this.levels, price);
  }

  /**
   * Reconcile desired grid state against live orders: cancel what shouldn't
   * be there, submit what's missing. Idempotent — safe to call every tick.
   *
   * TODO(order-placement): implement against the Alpaca client.
   *   1. fetch open orders for config.symbol
   *   2. diff against this.plan(price)
   *   3. cancel orphans, submit missing limit orders at level prices
   *   4. record submissions in this.openOrders
   */
  async reconcile(_price) {
    throw new Error('GridEngine.reconcile is not implemented yet.');
  }

  /**
   * Handle a fill: record it, then place the counter-order one level away.
   *
   * MUST use counterOrderFor() from ./rebalance.js to build the closing
   * order. It carries the original fill's quantity, which is the invariant
   * that keeps round trips matched when the grid re-sizes mid-run. Sizing a
   * closing order from freshly derived numbers gets it rejected for
   * insufficient position, because Alpaca does not allow shorting crypto.
   *
   * TODO(fill-tracking): implement.
   *   1. push a normalized fill onto this.fills
   *   2. clear this.openOrders for that level
   *   3. submit counterOrderFor(fill, this.levels) — null at the band edge
   *   4. emit realized PnL for the completed round trip
   */
  async onFill(_order) {
    throw new Error('GridEngine.onFill is not implemented yet.');
  }

  /** Net base-asset quantity held from grid buys, used to gate rebalancing. */
  get openInventory() {
    let net = 0;
    for (const f of this.fills) net += f.side === 'buy' ? f.qty : -f.qty;
    return Math.max(0, net);
  }

  /** Cancel every resting order and stop. */
  async shutdown() {
    this.running = false;
    this.logger.info?.('[grid] shutdown requested');
    // TODO: cancel all open orders for config.symbol before returning.
  }
}

export default GridEngine;
