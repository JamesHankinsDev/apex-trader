/* Apex Trader — derive a concrete grid from live account state + ratios.

   Absolute bounds and order sizes go stale the moment equity or price moves.
   These helpers express the grid as ratios instead, so it rescales itself:

     bounds     = anchor price ± GRID_BAND_PCT
     order size = (equity x GRID_ALLOCATION_PCT) / (levels x upperBound)

   ANCHOR POLICY IS A STRATEGY DECISION, NOT A DETAIL. See resolveAnchor().

   Every function here is pure — callers fetch the live numbers and pass them
   in, which keeps this testable without touching the network. */

export const ANCHOR_MODE = Object.freeze({
  /** Anchor is pinned to an explicit price. Never moves. */
  MANUAL: 'manual',
  /** Anchor is set once from market price at startup, then held. */
  SESSION: 'session',
  /** Re-centres on price once drift is large AND no inventory is held. */
  ON_FLAT: 'on_flat',
  /** Anchor follows price once it drifts far enough. The band chases. */
  ROLLING: 'rolling',
});

export class SizingError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SizingError';
  }
}

function assert(condition, message) {
  if (!condition) throw new SizingError(message);
}

/**
 * Decide the price the grid is centred on.
 *
 * The three modes differ in one consequential way — whether the band can
 * follow price:
 *
 *   manual  / session  The band is fixed. If price leaves it, the bot idles
 *                      (isOutOfBand). That idling is a feature: it stops the
 *                      grid from buying all the way down a trend.
 *
 *   on_flat            Re-centres on price after a large drift, but ONLY when
 *                      no inventory is held. In a ranging market it closes
 *                      out, re-centres and repeats, so it runs near
 *                      continuously. If price gaps away and leaves it holding,
 *                      it keeps the band — the held position still needs its
 *                      exit levels — and idles until that closes. Keeps the
 *                      brake; the cost is capital sitting idle.
 *
 *   rolling            The band re-centres on price once drift exceeds
 *                      `reanchorDrift` x half-band. Price can never leave the
 *                      band, so the bot never idles — and in a sustained
 *                      downtrend it will keep averaging down indefinitely.
 *                      That is the classic way grid bots blow up. Use it only
 *                      with a hard MAX_DAILY_LOSS and an exit plan.
 *
 * @param {object}  opts
 * @param {string}  opts.mode           ANCHOR_MODE value
 * @param {number}  opts.price          current market price
 * @param {number} [opts.storedAnchor]  anchor persisted from a previous run
 * @param {number} [opts.manualAnchor]  required when mode is 'manual'
 * @param {number} [opts.bandPct]       half-width, needed for drift modes
 * @param {number} [opts.reanchorDrift] fraction of half-band before re-anchor
 * @param {number} [opts.openInventory] base qty held; gates on_flat
 * @returns {{ anchor: number, moved: boolean, reason: string }}
 */
export function resolveAnchor({
  mode,
  price,
  storedAnchor,
  manualAnchor,
  bandPct,
  reanchorDrift = 0.5,
  openInventory = 0,
}) {
  assert(Number.isFinite(price) && price > 0, `price must be positive, got ${price}.`);

  if (mode === ANCHOR_MODE.MANUAL) {
    assert(
      Number.isFinite(manualAnchor) && manualAnchor > 0,
      'GRID_ANCHOR_MODE=manual requires a positive GRID_ANCHOR_PRICE.',
    );
    return { anchor: manualAnchor, moved: false, reason: 'manual anchor' };
  }

  if (mode === ANCHOR_MODE.SESSION) {
    if (Number.isFinite(storedAnchor) && storedAnchor > 0) {
      return { anchor: storedAnchor, moved: false, reason: 'held from previous session' };
    }
    return { anchor: price, moved: true, reason: 'anchored to market price at startup' };
  }

  if (mode === ANCHOR_MODE.ON_FLAT || mode === ANCHOR_MODE.ROLLING) {
    assert(
      Number.isFinite(bandPct) && bandPct > 0,
      `${mode} anchor requires a positive bandPct.`,
    );
    assert(
      Number.isFinite(reanchorDrift) && reanchorDrift > 0 && reanchorDrift <= 1,
      `reanchorDrift must be in (0, 1], got ${reanchorDrift}.`,
    );

    if (!Number.isFinite(storedAnchor) || storedAnchor <= 0) {
      return { anchor: price, moved: true, reason: 'first run — anchored to market price' };
    }

    const drift = Math.abs(price - storedAnchor) / storedAnchor;
    const threshold = bandPct * reanchorDrift;

    if (drift <= threshold) {
      return {
        anchor: storedAnchor,
        moved: false,
        reason: `drift ${(drift * 100).toFixed(1)}% within ${(threshold * 100).toFixed(1)}%`,
      };
    }

    // on_flat keeps the brake: the band may only move once the previous one
    // has been fully closed out. Holding inventory means the levels that would
    // exit it still need to exist, so the band stays put and the bot idles.
    if (mode === ANCHOR_MODE.ON_FLAT && openInventory > 0) {
      return {
        anchor: storedAnchor,
        moved: false,
        reason: `drifted ${(drift * 100).toFixed(1)}% but holding ${openInventory} — band held so inventory keeps its exit levels`,
      };
    }

    return {
      anchor: price,
      moved: true,
      reason: `price drifted ${(drift * 100).toFixed(1)}% (> ${(threshold * 100).toFixed(1)}%) — re-anchored`,
    };
  }

  throw new SizingError(
    `Unknown anchor mode "${mode}". Expected one of ${Object.values(ANCHOR_MODE).join(' | ')}.`,
  );
}

/**
 * Band edges from an anchor and a half-width percentage.
 * ±bandPct is arithmetic around the anchor, matching how "±15%" reads.
 */
export function deriveBounds(anchor, bandPct) {
  assert(Number.isFinite(anchor) && anchor > 0, `anchor must be positive, got ${anchor}.`);
  assert(
    Number.isFinite(bandPct) && bandPct > 0 && bandPct < 1,
    `bandPct must be in (0, 1), got ${bandPct}.`,
  );
  return {
    lowerBound: anchor * (1 - bandPct),
    upperBound: anchor * (1 + bandPct),
  };
}

/**
 * Order size per level from equity and an allocation fraction.
 *
 * Sized against upperBound so that worst-case notional — every level filled
 * at its own price — lands at or under the allocation rather than over it.
 * Actual capital at risk at any instant is lower, since only levels below
 * price rest as buys.
 *
 * @returns {{ orderSize: number, deployable: number, worstCaseNotional: number }}
 */
export function deriveOrderSize({ equity, allocationPct, levels, upperBound }) {
  assert(Number.isFinite(equity) && equity > 0, `equity must be positive, got ${equity}.`);
  assert(
    Number.isFinite(allocationPct) && allocationPct > 0 && allocationPct <= 1,
    `allocationPct must be in (0, 1], got ${allocationPct}.`,
  );
  assert(Number.isInteger(levels) && levels >= 2, `levels must be an integer >= 2, got ${levels}.`);
  assert(
    Number.isFinite(upperBound) && upperBound > 0,
    `upperBound must be positive, got ${upperBound}.`,
  );

  const deployable = equity * allocationPct;
  const orderSize = deployable / (levels * upperBound);

  return {
    orderSize,
    deployable,
    worstCaseNotional: orderSize * levels * upperBound,
  };
}

/**
 * Full derivation: live account + market + ratios -> concrete grid params.
 *
 * @param {object} opts
 * @param {object} opts.ratios       { symbol, levels, spacing, bandPct, allocationPct, anchorMode, ... }
 * @param {number} opts.equity       live account equity
 * @param {number} opts.price        live market price
 * @param {number} [opts.storedAnchor]
 * @param {number} [opts.minOrderSize]      live from Alpaca's asset metadata
 * @param {number} [opts.minOrderNotional]  quote-currency floor per order (~$10)
 * @param {number} [opts.buyingPower]       live; checked against worst case
 * @returns {object} shape accepted by normalizeGridConfig(), plus derivation notes
 */
export function deriveGridConfig({
  ratios,
  equity,
  price,
  storedAnchor,
  minOrderSize,
  minOrderNotional,
  buyingPower,
  openInventory = 0,
}) {
  const {
    symbol,
    levels,
    spacing,
    bandPct,
    allocationPct,
    anchorMode,
    manualAnchor,
    reanchorDrift,
  } = ratios;

  const anchorResult = resolveAnchor({
    mode: anchorMode,
    price,
    storedAnchor,
    manualAnchor,
    bandPct,
    reanchorDrift,
    openInventory,
  });

  const { lowerBound, upperBound } = deriveBounds(anchorResult.anchor, bandPct);
  const sizing = deriveOrderSize({ equity, allocationPct, levels, upperBound });

  // Live constraint: Alpaca rejects orders under the asset minimum outright.
  if (Number.isFinite(minOrderSize) && sizing.orderSize < minOrderSize) {
    const maxLevels = Math.floor(sizing.deployable / (minOrderSize * upperBound));
    throw new SizingError(
      `Derived order size ${sizing.orderSize.toFixed(8)} is below the exchange minimum ` +
        `${minOrderSize} for ${symbol}. With ${equity.toFixed(2)} equity at ` +
        `${(allocationPct * 100).toFixed(0)}% allocation you can support at most ` +
        `${maxLevels} level(s). Reduce GRID_LEVELS, raise GRID_ALLOCATION_PCT, or fund the account.`,
    );
  }

  // Live constraint: a SEPARATE notional floor, in quote currency.
  //
  // Alpaca enforces a minimum cost basis per crypto order (~$10) that it does
  // NOT publish in the assets endpoint — min_order_size is a quantity, and
  // clearing it is not sufficient. Discovered the hard way: a grid whose
  // orders were 3.4x the quantity minimum had every level rejected with
  // "cost basis must be >= minimal amount of order 10".
  //
  // The binding case is the CHEAPEST order, which sits at lowerBound.
  if (Number.isFinite(minOrderNotional) && minOrderNotional > 0) {
    const cheapest = sizing.orderSize * lowerBound;
    // Relative epsilon: without it a cheapest order of 9.999999999999998 —
    // arithmetically exactly the floor — trips the guard and reads absurdly as
    // "$10.00 is below the $10.00 minimum".
    if (cheapest < minOrderNotional * (1 - 1e-9)) {
      const maxLevels = Math.floor(
        (sizing.deployable * lowerBound) / (upperBound * minOrderNotional),
      );
      throw new SizingError(
        `Cheapest order would be $${cheapest.toFixed(4)} (at the $${lowerBound.toFixed(2)} level), ` +
          `below the $${minOrderNotional.toFixed(2)} exchange notional minimum. ` +
          `With $${equity.toFixed(2)} equity at ${(allocationPct * 100).toFixed(0)}% allocation ` +
          `across this band you can support at most ${maxLevels} level(s), not ${levels}. ` +
          `Reduce GRID_LEVELS to ${maxLevels}, raise GRID_ALLOCATION_PCT, narrow GRID_BAND_PCT, ` +
          `or fund the account.`,
      );
    }
  }

  // Live constraint: don't plan a grid the account cannot actually fund.
  //
  // `buyingPower` here means TOTAL grid capital — cash plus the cost of
  // inventory already held. Cash spent on a filled level is not gone, it became
  // the asset, and that level needs no further funding. Comparing against cash
  // alone makes a working grid look unfundable the moment it starts filling.
  if (Number.isFinite(buyingPower) && sizing.worstCaseNotional > buyingPower) {
    throw new SizingError(
      `Worst-case notional $${sizing.worstCaseNotional.toFixed(2)} exceeds available capital ` +
        `$${buyingPower.toFixed(2)}. Lower GRID_ALLOCATION_PCT.`,
    );
  }

  return {
    symbol,
    levels,
    spacing,
    lowerBound,
    upperBound,
    orderSize: sizing.orderSize,
    derivation: Object.freeze({
      anchor: anchorResult.anchor,
      anchorMoved: anchorResult.moved,
      anchorReason: anchorResult.reason,
      bandPct,
      allocationPct,
      equity,
      price,
      deployable: sizing.deployable,
      worstCaseNotional: sizing.worstCaseNotional,
      minOrderSize,
      minOrderNotional,
      buyingPower,
      cheapestOrderUsd: sizing.orderSize * lowerBound,
    }),
  };
}
