/* Apex Trader — grid engine.

   Model: a grid is N price levels spanning [lowerBound, upperBound].

   The resting book is NOT simply "buys below, sells above" — that would place
   sells for inventory you don't own. What actually rests is:

     BUY   at each level below price that isn't already holding inventory
     SELL  one level above each level that IS holding inventory

   So a cold start from flat rests only buys. Sells appear as buys fill. That
   distinction is why `assignSides()` (a display of the warmed-up shape) and
   `desiredOrders()` (what to actually submit) are separate functions. */

import { SPACING } from './config.js';
import { counterOrderFor } from './rebalance.js';

/** @typedef {{ index: number, price: number, side: 'buy'|'sell'|null }} GridLevel */

/** Alpaca quotes USD pairs to the cent; crypto qty needs far more precision. */
const PRICE_DP = 2;
const QTY_DP = 9;
const CLIENT_PREFIX = 'apex';

const roundPrice = (p) => Number(p.toFixed(PRICE_DP));
const roundQty = (q) => Number(q.toFixed(QTY_DP));
/** Round DOWN — never ask the exchange for more of an asset than we hold. */
const floorQty = (q) => Math.floor(q * 10 ** QTY_DP) / 10 ** QTY_DP;

/** BTC/USD -> BTCUSD, so it's safe inside a client_order_id. */
const slug = (symbol) => symbol.replace(/[^A-Za-z0-9]/g, '');

/**
 * Orders are tagged with their level and side so a restart can rebuild state
 * from the exchange rather than trusting local memory.
 */
export function buildClientOrderId(symbol, levelIndex, side, nonce) {
  return `${CLIENT_PREFIX}-${slug(symbol)}-L${levelIndex}-${side}-${nonce}`;
}

/** @returns {{ levelIndex: number, side: string } | null} */
export function parseClientOrderId(id) {
  if (typeof id !== 'string' || !id.startsWith(`${CLIENT_PREFIX}-`)) return null;
  const m = id.match(/-L(\d+)-(buy|sell)-/);
  if (!m) return null;
  return { levelIndex: Number(m[1]), side: m[2] };
}

/**
 * Compute the grid's price levels.
 *
 * arithmetic — equal absolute gaps:  p_i = lower + i * (upper - lower)/(n-1)
 * geometric  — equal relative gaps:  p_i = lower * (upper/lower)^(i/(n-1))
 *
 * Geometric is usually right for crypto: equal percentage steps keep the
 * profit per round trip constant across the band.
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

  // Pin the endpoints exactly — drift over many multiplications can otherwise
  // put the top level a few cents outside the configured band.
  out[0].price = lowerBound;
  out[levels - 1].price = upperBound;

  return out;
}

/**
 * Display shape: what a fully warmed-up grid looks like at this price.
 * Not what to submit — see desiredOrders().
 *
 * @returns {GridLevel[]} new array; input is not mutated
 */
export function assignSides(levels, price) {
  if (!Number.isFinite(price) || price <= 0) {
    throw new TypeError(`assignSides requires a positive price, got ${price}.`);
  }

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

/** Absolute price distance to the next level up. */
export function gapAt(levels, index) {
  const here = levels[index];
  const next = levels[index + 1] ?? levels[index - 1];
  return Math.abs(next.price - here.price);
}

export class GridEngine {
  /**
   * @param {object} opts
   * @param {object} opts.config    normalized grid config
   * @param {object} opts.client    Alpaca client (injected — keeps this testable)
   * @param {boolean} [opts.dryRun] when true, reconcile plans but never submits
   * @param {object} [opts.logger]
   */
  constructor({ config, client, dryRun = true, logger = console }) {
    this.config = config;
    this.client = client;
    this.dryRun = dryRun;
    this.logger = logger;

    this.levels = calculateLevels(config);
    this.orderSize = config.orderSize;

    /** Buys awaiting a counter-sell. @type {Map<number, {qty:number, price:number}>} */
    this.inventory = new Map();
    /** Completed fills, newest last. */
    this.fills = [];
    this.realizedPnl = 0;
    this.nonce = 0;
    /**
     * Alpaca remembers a client_order_id forever, including for cancelled
     * orders. A counter that restarts at 0 every process therefore collides
     * with the previous run's ids and the whole first tick is rejected with
     * "client_order_id must be unique". Scoping the counter to a per-process
     * run id keeps ids unique across restarts.
     */
    this.runId = Date.now().toString(36);

    /**
     * Base asset actually sellable, from the live position.
     *
     * NOT the same as what we bought. Alpaca takes its crypto fee OUT OF THE
     * DELIVERED ASSET: a filled buy of 0.00016812 BTC left 0.000167867 in the
     * account — 0.15% short — while `filled_qty` still reported the full
     * 0.00016812 and `accrued_fees` stayed $0. Sizing a counter-sell from the
     * fill quantity therefore asks for BTC that the fee consumed, and every
     * sell is rejected with "insufficient balance for BTC".
     *
     * Infinity means "unknown, don't clamp" so unit tests and the first tick
     * behave as before.
     */
    this.availableQty = Infinity;
  }

  /** Display plan — levels with sides assigned. */
  plan(price) {
    if (isOutOfBand(this.config, price)) return [];
    return assignSides(this.levels, price);
  }

  /** Net base-asset quantity held from grid buys. */
  get openInventory() {
    let net = 0;
    for (const { qty } of this.inventory.values()) net += qty;
    return roundQty(net);
  }

  /** New levels opened from here use this size. Closing orders are unaffected. */
  applyResize(newSize) {
    const previous = this.orderSize;
    this.orderSize = newSize;
    return { previous, current: newSize };
  }

  /**
   * The orders that SHOULD be resting at this price.
   *
   * Sell targets are computed first and claim their level, so a buy is never
   * planned at a price that an exit order already occupies.
   *
   * @returns {Array<{levelIndex:number, side:string, price:number, qty:number}>}
   */
  desiredOrders(price) {
    if (isOutOfBand(this.config, price)) return [];

    const orders = [];
    const claimed = new Set();

    // 1 — exits for everything currently held.
    const sells = [];
    for (const [levelIndex, held] of this.inventory) {
      const counter = counterOrderFor(
        { levelIndex, side: 'buy', qty: held.qty, price: held.price },
        this.levels,
      );
      if (!counter) continue; // held at the top of the band; nothing to close into
      sells.push({
        levelIndex: counter.levelIndex,
        side: counter.side,
        price: roundPrice(counter.price),
        qty: counter.qty,
      });
      claimed.add(counter.levelIndex);
    }

    // Trading fees are taken out of the delivered asset, so the sum of what we
    // *bought* always exceeds what we can actually *sell*. Scale exits down to
    // the live balance rather than having the exchange reject them.
    const wanted = sells.reduce((sum, s) => sum + s.qty, 0);
    const scale = wanted > this.availableQty ? this.availableQty / wanted : 1;

    for (const s of sells) {
      // Floor, never round: asking for one satoshi too many is a hard reject.
      const qty = scale < 1 ? floorQty(s.qty * scale) : roundQty(s.qty);
      if (qty <= 0) continue; // dust — nothing sellable at this level
      orders.push({ ...s, qty });
    }

    // 2 — buys below price, skipping levels already holding or spoken for.
    for (const lvl of this.levels) {
      if (lvl.price >= price) continue;
      if (this.inventory.has(lvl.index)) continue;
      if (claimed.has(lvl.index)) continue;
      orders.push({
        levelIndex: lvl.index,
        side: 'buy',
        price: roundPrice(lvl.price),
        qty: roundQty(this.orderSize),
      });
    }

    return orders.sort((a, b) => a.levelIndex - b.levelIndex);
  }

  /** Identity of an order for diffing: same level, side, price and size. */
  static keyOf(o) {
    return `L${o.levelIndex}:${o.side}:${roundPrice(o.price)}:${roundQty(o.qty)}`;
  }

  /**
   * Reconcile desired state against the live book: cancel what shouldn't be
   * there, submit what's missing. Idempotent — safe to call every tick.
   *
   * Only touches orders carrying our client_order_id prefix, so anything you
   * place by hand in the Alpaca UI is left alone.
   *
   * @param {number} price
   * @returns {Promise<{submitted:Array, cancelled:Array, rejected:Array, desired:number, kept:number, dryRun:boolean, skipped?:string}>}
   */
  async reconcile(price) {
    if (!Number.isFinite(price) || price <= 0) {
      throw new TypeError(`reconcile requires a positive price, got ${price}.`);
    }

    if (isOutOfBand(this.config, price)) {
      // Cancel everything but place nothing — the grid idles out of band.
      const live = await this.#ourOpenOrders();
      const cancelled = await this.#cancelAll(live);
      return { submitted: [], cancelled, rejected: [], desired: 0, kept: 0, dryRun: this.dryRun, skipped: 'out of band' };
    }

    const desired = this.desiredOrders(price);
    const live = await this.#ourOpenOrders();

    const desiredByKey = new Map(desired.map((d) => [GridEngine.keyOf(d), d]));
    const liveByKey = new Map();
    const orphans = [];

    for (const order of live) {
      const parsed = parseClientOrderId(order.client_order_id);
      if (!parsed) {
        orphans.push(order);
        continue;
      }
      const key = GridEngine.keyOf({
        levelIndex: parsed.levelIndex,
        side: parsed.side,
        price: Number(order.limit_price),
        qty: Number(order.qty),
      });
      if (liveByKey.has(key)) orphans.push(order); // exact duplicate
      else liveByKey.set(key, order);
    }

    const toCancel = [...orphans];
    for (const [key, order] of liveByKey) {
      if (!desiredByKey.has(key)) toCancel.push(order);
    }
    const toSubmit = desired.filter((d) => !liveByKey.has(GridEngine.keyOf(d)));

    if (this.dryRun) {
      return {
        submitted: toSubmit,
        cancelled: toCancel,
        rejected: [],
        desired: desired.length,
        kept: liveByKey.size - (toCancel.length - orphans.length),
        dryRun: true,
      };
    }

    // Cancel before submitting, so freed buying power is available.
    const cancelled = await this.#cancelAll(toCancel);

    const submitted = [];
    const rejected = [];
    for (const o of toSubmit) {
      try {
        const res = await this.client.submitOrder({
          symbol: this.config.symbol,
          side: o.side,
          qty: o.qty,
          limitPrice: o.price,
          clientOrderId: buildClientOrderId(this.config.symbol, o.levelIndex, o.side, `${this.runId}${++this.nonce}`),
        });
        submitted.push(res);
      } catch (err) {
        // One rejected level must not abort the whole reconcile pass — but the
        // rejection must be REPORTED. Counting only successes made a grid
        // rejecting every order look identical to a converged one (+0/-0).
        rejected.push({ levelIndex: o.levelIndex, side: o.side, qty: o.qty, price: o.price, reason: err.message });
        this.logger.warn?.(`[grid] level ${o.levelIndex} ${o.side} rejected: ${err.message}`);
      }
    }

    return {
      submitted,
      cancelled,
      rejected,
      desired: desired.length,
      kept: liveByKey.size - cancelled.length,
      dryRun: false,
    };
  }

  /**
   * Update state from a fill: inventory in or out, and realized P&L on the
   * closing leg. Submits nothing.
   *
   * Separate from onFill() so a polling loop has a SINGLE writer. The loop
   * records fills for accounting and lets reconcile() place every order —
   * if both submitted, each fill would get two counter-orders.
   *
   * @param {object} order  an Alpaca order object that has filled
   * @returns {object|null} the counter-order descriptor, or null
   */
  recordFill(order) {
    const parsed = parseClientOrderId(order.client_order_id);
    if (!parsed) {
      this.logger.warn?.(`[grid] ignoring fill with untagged id ${order.client_order_id}`);
      return null;
    }

    const { levelIndex, side } = parsed;
    const qty = roundQty(Number(order.filled_qty ?? order.qty));
    const price = Number(order.filled_avg_price ?? order.limit_price);

    const fill = { levelIndex, side, qty, price, at: order.filled_at ?? null };
    this.fills.push(fill);

    if (side === 'buy') {
      this.inventory.set(levelIndex, { qty, price });
    } else {
      // A sell at level i closes the buy that was opened at level i-1.
      const openedAt = levelIndex - 1;
      const held = this.inventory.get(openedAt);
      if (held) {
        const pnl = qty * (price - held.price);
        this.realizedPnl += pnl;
        fill.realizedPnl = pnl;
        fill.closedLevel = openedAt;
        this.inventory.delete(openedAt);
      } else {
        this.logger.warn?.(`[grid] sell filled at level ${levelIndex} with no matching buy at ${openedAt}`);
      }
    }

    return counterOrderFor(fill, this.levels);
  }

  /**
   * Record a fill AND rest its counter-order.
   *
   * The counter carries the ORIGINAL quantity via counterOrderFor(), which is
   * what keeps round trips matched when the grid re-sizes mid-run.
   *
   * Use recordFill() instead inside a reconcile loop — see above.
   */
  async onFill(order) {
    const counter = this.recordFill(order);
    if (!counter) return null;

    if (this.dryRun) return counter;

    try {
      return await this.client.submitOrder({
        symbol: this.config.symbol,
        side: counter.side,
        qty: roundQty(counter.qty),
        limitPrice: roundPrice(counter.price),
        clientOrderId: buildClientOrderId(
          this.config.symbol,
          counter.levelIndex,
          counter.side,
          `${this.runId}${++this.nonce}`,
        ),
      });
    } catch (err) {
      this.logger.warn?.(`[grid] counter-order at level ${counter.levelIndex} rejected: ${err.message}`);
      return null;
    }
  }

  /**
   * Rebuild local state from the exchange, so a restart doesn't lose track of
   * which levels are holding inventory.
   */
  async hydrate() {
    const orders = await this.client.getOrders({ status: 'all', limit: 500 });
    this.inventory.clear();

    for (const o of orders) {
      const parsed = parseClientOrderId(o.client_order_id);
      if (!parsed || o.status !== 'filled') continue;
      const qty = roundQty(Number(o.filled_qty ?? o.qty));
      const price = Number(o.filled_avg_price ?? o.limit_price);
      if (parsed.side === 'buy') this.inventory.set(parsed.levelIndex, { qty, price });
      else this.inventory.delete(parsed.levelIndex - 1);
    }

    return this.openInventory;
  }

  /** Cancel every resting order this engine placed, then stop. */
  async shutdown() {
    const live = await this.#ourOpenOrders();
    const cancelled = await this.#cancelAll(live);
    this.logger.info?.(`[grid] shutdown — ${cancelled.length} order(s) cancelled`);
    return cancelled;
  }

  async #ourOpenOrders() {
    const orders = await this.client.getOrders({ status: 'open', limit: 500 });
    return orders.filter(
      (o) => o.symbol === this.config.symbol && String(o.client_order_id ?? '').startsWith(`${CLIENT_PREFIX}-`),
    );
  }

  async #cancelAll(orders) {
    if (this.dryRun) return orders;
    const done = [];
    for (const o of orders) {
      try {
        await this.client.cancelOrder(o.id);
        done.push(o);
      } catch (err) {
        this.logger.warn?.(`[grid] could not cancel ${o.id}: ${err.message}`);
      }
    }
    return done;
  }
}

export default GridEngine;
