import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ANCHOR_MODE,
  resolveAnchor,
  deriveBounds,
  deriveOrderSize,
  deriveGridConfig,
  SizingError,
} from '../src/grid/sizing.js';

const ratios = {
  symbol: 'BTC/USD',
  levels: 20,
  spacing: 'geometric',
  bandPct: 0.15,
  allocationPct: 0.8,
  anchorMode: ANCHOR_MODE.SESSION,
  reanchorDrift: 0.5,
};

// ---- bounds ---------------------------------------------------------------

test('bounds are the anchor +/- bandPct', () => {
  const { lowerBound, upperBound } = deriveBounds(100, 0.15);
  // 100 * 1.15 is 114.99999999999999 in binary floating point.
  assert.ok(Math.abs(lowerBound - 85) < 1e-9, `lower ${lowerBound}`);
  assert.ok(Math.abs(upperBound - 115) < 1e-9, `upper ${upperBound}`);
});

test('deriveBounds rejects a bandPct outside (0, 1)', () => {
  assert.throws(() => deriveBounds(100, 0), SizingError);
  assert.throws(() => deriveBounds(100, 1), SizingError);
  assert.throws(() => deriveBounds(0, 0.1), SizingError);
});

// ---- order sizing ---------------------------------------------------------

test('order size scales linearly with equity', () => {
  const a = deriveOrderSize({ equity: 100, allocationPct: 0.8, levels: 20, upperBound: 115 });
  const b = deriveOrderSize({ equity: 1000, allocationPct: 0.8, levels: 20, upperBound: 115 });

  assert.ok(Math.abs(b.orderSize / a.orderSize - 10) < 1e-9, '10x equity => 10x size');
  assert.equal(a.deployable, 80);
  assert.equal(b.deployable, 800);
});

test('worst-case notional never exceeds the allocation', () => {
  for (const equity of [100, 2500, 100000]) {
    for (const levels of [2, 7, 50]) {
      const r = deriveOrderSize({ equity, allocationPct: 0.8, levels, upperBound: 115 });
      assert.ok(
        r.worstCaseNotional <= r.deployable + 1e-6,
        `notional ${r.worstCaseNotional} > deployable ${r.deployable}`,
      );
    }
  }
});

test('deriveOrderSize rejects bad input', () => {
  const ok = { equity: 100, allocationPct: 0.8, levels: 20, upperBound: 115 };
  assert.throws(() => deriveOrderSize({ ...ok, equity: 0 }), SizingError);
  assert.throws(() => deriveOrderSize({ ...ok, allocationPct: 0 }), SizingError);
  assert.throws(() => deriveOrderSize({ ...ok, allocationPct: 1.5 }), SizingError);
  assert.throws(() => deriveOrderSize({ ...ok, levels: 1 }), SizingError);
});

// ---- anchor policy --------------------------------------------------------

test('manual anchor is fixed and requires a price', () => {
  const r = resolveAnchor({ mode: ANCHOR_MODE.MANUAL, price: 999, manualAnchor: 65000 });
  assert.equal(r.anchor, 65000);
  assert.equal(r.moved, false);
  assert.throws(() => resolveAnchor({ mode: ANCHOR_MODE.MANUAL, price: 999 }), SizingError);
});

test('session anchor is set once then held', () => {
  const first = resolveAnchor({ mode: ANCHOR_MODE.SESSION, price: 64000 });
  assert.equal(first.anchor, 64000);
  assert.equal(first.moved, true);

  // Price moved a long way; the band must NOT follow.
  const later = resolveAnchor({ mode: ANCHOR_MODE.SESSION, price: 40000, storedAnchor: 64000 });
  assert.equal(later.anchor, 64000);
  assert.equal(later.moved, false);
});

test('rolling anchor holds inside the drift threshold', () => {
  // threshold = bandPct(0.15) * reanchorDrift(0.5) = 7.5%
  const r = resolveAnchor({
    mode: ANCHOR_MODE.ROLLING,
    price: 64000 * 1.05,
    storedAnchor: 64000,
    bandPct: 0.15,
    reanchorDrift: 0.5,
  });
  assert.equal(r.anchor, 64000);
  assert.equal(r.moved, false);
});

test('rolling anchor follows price past the drift threshold', () => {
  const price = 64000 * 1.09; // 9% > 7.5%
  const r = resolveAnchor({
    mode: ANCHOR_MODE.ROLLING,
    price,
    storedAnchor: 64000,
    bandPct: 0.15,
    reanchorDrift: 0.5,
  });
  assert.equal(r.anchor, price);
  assert.equal(r.moved, true);
  assert.match(r.reason, /re-anchored/);
});

test('rolling re-anchors downward too — this is the averaging-down risk', () => {
  const price = 64000 * 0.85;
  const r = resolveAnchor({
    mode: ANCHOR_MODE.ROLLING,
    price,
    storedAnchor: 64000,
    bandPct: 0.15,
    reanchorDrift: 0.5,
  });
  assert.equal(r.anchor, price, 'band follows price down, so the bot never idles');
});

test('on_flat re-centres when flat and drift is large', () => {
  const price = 64000 * 1.09; // 9% > 7.5% threshold
  const r = resolveAnchor({
    mode: ANCHOR_MODE.ON_FLAT,
    price,
    storedAnchor: 64000,
    bandPct: 0.15,
    reanchorDrift: 0.5,
    openInventory: 0,
  });
  assert.equal(r.anchor, price);
  assert.equal(r.moved, true);
});

test('on_flat holds the band while inventory is open', () => {
  const r = resolveAnchor({
    mode: ANCHOR_MODE.ON_FLAT,
    price: 64000 * 0.8, // way out of band, a big drop
    storedAnchor: 64000,
    bandPct: 0.15,
    reanchorDrift: 0.5,
    openInventory: 0.0005,
  });
  assert.equal(r.anchor, 64000, 'held inventory keeps its exit levels');
  assert.equal(r.moved, false);
  assert.match(r.reason, /holding/);
});

test('on_flat and rolling differ ONLY when holding inventory', () => {
  const shared = { price: 64000 * 0.8, storedAnchor: 64000, bandPct: 0.15, reanchorDrift: 0.5 };

  // Flat: identical behaviour.
  const flatA = resolveAnchor({ ...shared, mode: ANCHOR_MODE.ON_FLAT, openInventory: 0 });
  const flatB = resolveAnchor({ ...shared, mode: ANCHOR_MODE.ROLLING, openInventory: 0 });
  assert.equal(flatA.anchor, flatB.anchor);

  // Holding: on_flat brakes, rolling chases price down.
  const heldA = resolveAnchor({ ...shared, mode: ANCHOR_MODE.ON_FLAT, openInventory: 0.5 });
  const heldB = resolveAnchor({ ...shared, mode: ANCHOR_MODE.ROLLING, openInventory: 0.5 });
  assert.equal(heldA.anchor, 64000, 'on_flat holds');
  assert.equal(heldB.anchor, shared.price, 'rolling follows price down');
});

test('unknown anchor mode is rejected', () => {
  assert.throws(() => resolveAnchor({ mode: 'drift', price: 100 }), SizingError);
});

// ---- full derivation ------------------------------------------------------

test('derives a fundable grid from live state', () => {
  const cfg = deriveGridConfig({
    ratios,
    equity: 100,
    price: 64731,
    minOrderSize: 0.000015565,
    buyingPower: 100,
  });

  assert.equal(cfg.symbol, 'BTC/USD');
  assert.equal(cfg.levels, 20);
  assert.ok(cfg.lowerBound < 64731 && cfg.upperBound > 64731, 'price sits inside the band');
  assert.ok(cfg.orderSize > 0.000015565, 'clears the exchange minimum');
  assert.ok(cfg.derivation.worstCaseNotional <= 100, 'fits inside buying power');
});

test('the grid grows with the account, untouched', () => {
  const poor = deriveGridConfig({ ratios, equity: 100, price: 64731, buyingPower: 1e9 });
  const rich = deriveGridConfig({ ratios, equity: 10000, price: 64731, buyingPower: 1e9 });

  assert.ok(Math.abs(rich.orderSize / poor.orderSize - 100) < 1e-6, '100x equity => 100x size');
  // Bounds track price, not equity — they are the same here by design.
  assert.equal(rich.lowerBound, poor.lowerBound);
});

test('bounds track price as it moves', () => {
  const low = deriveGridConfig({ ratios, equity: 100, price: 30000, buyingPower: 1e9 });
  const high = deriveGridConfig({ ratios, equity: 100, price: 90000, buyingPower: 1e9 });
  assert.ok(high.lowerBound > low.upperBound, 'bands are disjoint at very different prices');
});

test('rejects a grid whose orders fall under the exchange minimum', () => {
  assert.throws(
    () => deriveGridConfig({
      ratios: { ...ratios, levels: 500 },
      equity: 100,
      price: 64731,
      minOrderSize: 0.000015565,
      buyingPower: 1e9,
    }),
    (err) => err instanceof SizingError && /below the exchange minimum/.test(err.message),
  );
});

// Regression: Alpaca enforces a ~$10 cost-basis floor per crypto order that
// it does NOT publish in the assets endpoint. A grid at 3.4x the *quantity*
// minimum had every level rejected in production with
// "cost basis must be >= minimal amount of order 10".
test('rejects a grid whose orders fall under the notional floor', () => {
  assert.throws(
    () => deriveGridConfig({
      ratios,                    // 20 levels
      equity: 100,
      price: 64850,
      minOrderSize: 0.000015565, // passes the QUANTITY check...
      minOrderNotional: 10,      // ...but fails the NOTIONAL one
      buyingPower: 100,
    }),
    (err) => err instanceof SizingError && /notional minimum/.test(err.message),
  );
});

test('the notional error names a level count that actually works', () => {
  let suggested;
  try {
    deriveGridConfig({ ratios, equity: 100, price: 64850, minOrderNotional: 10, buyingPower: 100 });
  } catch (err) {
    suggested = Number(err.message.match(/at most (\d+) level/)[1]);
  }
  assert.ok(suggested >= 2, `expected a usable suggestion, got ${suggested}`);

  // Taking the advice must actually produce a valid grid.
  const fixed = deriveGridConfig({
    ratios: { ...ratios, levels: suggested },
    equity: 100,
    price: 64850,
    minOrderNotional: 10,
    buyingPower: 100,
  });
  assert.ok(
    fixed.orderSize * fixed.lowerBound >= 10,
    `cheapest order ${(fixed.orderSize * fixed.lowerBound).toFixed(2)} still under $10`,
  );
});

test('the notional floor binds on the CHEAPEST level, not the average', () => {
  // Sized against upperBound, so the lowest level is always the tightest.
  const cfg = deriveGridConfig({
    ratios: { ...ratios, levels: 5 },
    equity: 100,
    price: 64850,
    minOrderNotional: 10,
    buyingPower: 100,
  });
  const cheapest = cfg.orderSize * cfg.lowerBound;
  const dearest = cfg.orderSize * cfg.upperBound;
  assert.ok(cheapest < dearest);
  assert.ok(cheapest >= 10, 'every level clears the floor once the cheapest does');
});

test('the notional check is skipped when no floor is given', () => {
  assert.doesNotThrow(() =>
    deriveGridConfig({ ratios, equity: 100, price: 64850, buyingPower: 1e9 }),
  );
});

test('rejects a grid that exceeds live buying power', () => {
  assert.throws(
    () => deriveGridConfig({ ratios, equity: 100000, price: 64731, buyingPower: 100 }),
    (err) => err instanceof SizingError && /buying power/.test(err.message),
  );
});
