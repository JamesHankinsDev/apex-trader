/* Apex Trader — when to re-derive the grid while it's running.

   Two separate questions, deliberately kept apart because they have different
   risk profiles:

     RESIZE     Should new orders use a larger size because equity grew?
                Safe. This is just compounding.

     RE-ANCHOR  Should the band move because price moved?
                Dangerous. Moving the band is what removes the bot's brake.

   And one hard invariant that neither of them may violate — see
   counterOrderFor(). Everything here is pure; callers pass live state in. */

export const RESIZE_MODE = Object.freeze({
  /** Size is fixed for the life of the process. */
  SESSION: 'session',
  /** Re-size only when no grid inventory is held. Safest compounding. */
  ON_FLAT: 'on_flat',
  /** Re-size after any fill that moves equity past the threshold. */
  ON_FILL: 'on_fill',
});

export class RebalanceError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RebalanceError';
  }
}

/**
 * THE INVARIANT: a counter-order closes a specific fill, so it must carry
 * that fill's exact quantity — never the current derived size.
 *
 * A grid earns by round-tripping the same quantity across one level gap. If
 * the closing order is sized from freshly-derived numbers, buy and sell
 * quantities drift apart: too large and the sell is rejected for insufficient
 * position (Alpaca does not allow shorting crypto), too small and unsold
 * inventory accumulates silently.
 *
 * Resizing therefore applies ONLY to newly-opened levels, never to the
 * closing side of an existing one.
 *
 * @param {object} fill    { levelIndex, side, qty, price }
 * @param {object[]} levels  from calculateLevels()
 * @returns {{ levelIndex: number, side: 'buy'|'sell', price: number, qty: number }}
 */
export function counterOrderFor(fill, levels) {
  const { levelIndex, side, qty } = fill;

  if (!Number.isInteger(levelIndex) || levelIndex < 0 || levelIndex >= levels.length) {
    throw new RebalanceError(`fill.levelIndex ${levelIndex} is outside the grid.`);
  }
  if (side !== 'buy' && side !== 'sell') {
    throw new RebalanceError(`fill.side must be "buy" or "sell", got ${JSON.stringify(side)}.`);
  }
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new RebalanceError(`fill.qty must be positive, got ${qty}.`);
  }

  // A buy is closed by a sell one level up; a sell by a buy one level down.
  const targetIndex = side === 'buy' ? levelIndex + 1 : levelIndex - 1;

  if (targetIndex < 0 || targetIndex >= levels.length) {
    // Filled at the edge of the band — there is no level to close into.
    return null;
  }

  return {
    levelIndex: targetIndex,
    side: side === 'buy' ? 'sell' : 'buy',
    price: levels[targetIndex].price,
    qty, // <- the invariant: same quantity, always
  };
}

/**
 * Should newly-opened levels start using a freshly derived size?
 *
 * `threshold` exists to stop order churn: without it, every cent of equity
 * movement would cancel and replace the whole resting grid, which burns rate
 * limit and crosses the spread for nothing.
 *
 * @param {object} opts
 * @param {string} opts.mode          RESIZE_MODE value
 * @param {number} opts.currentSize   size new levels use today
 * @param {number} opts.derivedSize   size the current equity implies
 * @param {number} [opts.threshold]   min relative change to act on (0.10 = 10%)
 * @param {number} [opts.openInventory] base-asset qty held from grid buys
 * @returns {{ resize: boolean, reason: string, change: number }}
 */
export function shouldResize({
  mode,
  currentSize,
  derivedSize,
  threshold = 0.1,
  openInventory = 0,
}) {
  if (!Number.isFinite(currentSize) || currentSize <= 0) {
    throw new RebalanceError(`currentSize must be positive, got ${currentSize}.`);
  }
  if (!Number.isFinite(derivedSize) || derivedSize <= 0) {
    throw new RebalanceError(`derivedSize must be positive, got ${derivedSize}.`);
  }
  if (!Number.isFinite(threshold) || threshold < 0 || threshold >= 1) {
    throw new RebalanceError(`threshold must be in [0, 1), got ${threshold}.`);
  }

  const change = (derivedSize - currentSize) / currentSize;
  const magnitude = Math.abs(change);
  const pct = `${(change * 100).toFixed(1)}%`;

  if (mode === RESIZE_MODE.SESSION) {
    return { resize: false, reason: 'mode=session — size fixed for this run', change };
  }

  if (magnitude < threshold) {
    return {
      resize: false,
      reason: `change ${pct} below threshold ${(threshold * 100).toFixed(0)}%`,
      change,
    };
  }

  if (mode === RESIZE_MODE.ON_FLAT) {
    if (openInventory > 0) {
      return {
        resize: false,
        reason: `holding ${openInventory} inventory — waiting to go flat`,
        change,
      };
    }
    return { resize: true, reason: `flat and size moved ${pct}`, change };
  }

  if (mode === RESIZE_MODE.ON_FILL) {
    // Safe even while holding inventory, because counterOrderFor() keeps
    // closing orders at their original quantity regardless of this.
    return { resize: true, reason: `size moved ${pct}`, change };
  }

  throw new RebalanceError(
    `Unknown resize mode "${mode}". Expected one of ${Object.values(RESIZE_MODE).join(' | ')}.`,
  );
}

/**
 * Should the band re-centre? Only ever safe when nothing is held.
 *
 * Re-anchoring while inventory is open strands it: the levels that would have
 * closed those positions no longer exist, so the bot is left holding an asset
 * with no exit orders resting against it.
 *
 * This is why `on_flat` is the honest way to keep a grid running continuously
 * — it re-centres readily, but only after the previous band has been cleared.
 *
 * @param {object} opts
 * @param {boolean} opts.wantsReanchor  the anchor policy's own verdict
 * @param {number}  opts.openInventory
 * @param {number}  [opts.openOrders]
 * @returns {{ reanchor: boolean, reason: string }}
 */
export function canReanchor({ wantsReanchor, openInventory = 0, openOrders = 0 }) {
  if (!wantsReanchor) {
    return { reanchor: false, reason: 'anchor policy sees no reason to move' };
  }
  if (openInventory > 0) {
    return {
      reanchor: false,
      reason: `holding ${openInventory} — re-anchoring would strand it with no exit levels`,
    };
  }
  return {
    reanchor: true,
    reason: openOrders > 0 ? 'flat — cancel resting orders and re-centre' : 'flat — re-centre',
  };
}
