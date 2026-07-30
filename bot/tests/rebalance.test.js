import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RESIZE_MODE,
  counterOrderFor,
  shouldResize,
  canReanchor,
  RebalanceError,
} from '../src/grid/rebalance.js';
import { calculateLevels } from '../src/grid/engine.js';
import { normalizeGridConfig } from '../src/grid/config.js';

const levels = calculateLevels(
  normalizeGridConfig({
    symbol: 'BTC/USD',
    lowerBound: 55000,
    upperBound: 75000,
    levels: 10,
    spacing: 'geometric',
    orderSize: 0.0001,
  }),
);

// ---- the invariant --------------------------------------------------------

test('counter-order carries the ORIGINAL fill quantity, not a new size', () => {
  const fill = { levelIndex: 3, side: 'buy', qty: 0.00005373, price: levels[3].price };
  const counter = counterOrderFor(fill, levels);

  assert.equal(counter.qty, 0.00005373, 'quantity must round-trip exactly');
  assert.equal(counter.side, 'sell');
  assert.equal(counter.levelIndex, 4);
  assert.equal(counter.price, levels[4].price);
});

test('a sell fill is closed by a buy one level down, same quantity', () => {
  const fill = { levelIndex: 6, side: 'sell', qty: 0.000071, price: levels[6].price };
  const counter = counterOrderFor(fill, levels);

  assert.equal(counter.qty, 0.000071);
  assert.equal(counter.side, 'buy');
  assert.equal(counter.levelIndex, 5);
});

test('quantity survives an arbitrary chain of round trips', () => {
  // Whatever the equity does, the closing quantity must never drift.
  let qty = 0.00005373;
  let idx = 2;
  let side = 'buy';
  for (let i = 0; i < 20; i++) {
    const counter = counterOrderFor({ levelIndex: idx, side, qty, price: levels[idx].price }, levels);
    if (!counter) break;
    assert.equal(counter.qty, qty, `drifted at hop ${i}`);
    idx = counter.levelIndex;
    side = counter.side;
  }
});

test('fills at the band edge have no level to close into', () => {
  assert.equal(counterOrderFor({ levelIndex: 9, side: 'buy', qty: 1 }, levels), null);
  assert.equal(counterOrderFor({ levelIndex: 0, side: 'sell', qty: 1 }, levels), null);
});

test('counterOrderFor rejects malformed fills', () => {
  assert.throws(() => counterOrderFor({ levelIndex: 99, side: 'buy', qty: 1 }, levels), RebalanceError);
  assert.throws(() => counterOrderFor({ levelIndex: 1, side: 'hold', qty: 1 }, levels), RebalanceError);
  assert.throws(() => counterOrderFor({ levelIndex: 1, side: 'buy', qty: 0 }, levels), RebalanceError);
});

// ---- resize policy --------------------------------------------------------

const base = { currentSize: 0.0001, derivedSize: 0.00012, threshold: 0.1 };

test('session mode never resizes mid-run', () => {
  const r = shouldResize({ ...base, mode: RESIZE_MODE.SESSION });
  assert.equal(r.resize, false);
  assert.match(r.reason, /session/);
});

test('threshold suppresses churn from tiny equity moves', () => {
  const r = shouldResize({
    mode: RESIZE_MODE.ON_FILL,
    currentSize: 0.0001,
    derivedSize: 0.000103, // +3%
    threshold: 0.1,
  });
  assert.equal(r.resize, false);
  assert.match(r.reason, /below threshold/);
});

test('on_fill resizes past the threshold even while holding inventory', () => {
  const r = shouldResize({ ...base, mode: RESIZE_MODE.ON_FILL, openInventory: 0.0005 });
  assert.equal(r.resize, true, 'safe because counter-orders keep their own quantity');
  assert.ok(Math.abs(r.change - 0.2) < 1e-9);
});

test('on_flat waits until inventory is cleared', () => {
  const holding = shouldResize({ ...base, mode: RESIZE_MODE.ON_FLAT, openInventory: 0.0005 });
  assert.equal(holding.resize, false);
  assert.match(holding.reason, /waiting to go flat/);

  const flat = shouldResize({ ...base, mode: RESIZE_MODE.ON_FLAT, openInventory: 0 });
  assert.equal(flat.resize, true);
});

test('resizing works downward too', () => {
  const r = shouldResize({
    mode: RESIZE_MODE.ON_FILL,
    currentSize: 0.0001,
    derivedSize: 0.00008, // -20%, equity fell
    threshold: 0.1,
  });
  assert.equal(r.resize, true);
  assert.ok(r.change < 0);
});

test('shouldResize rejects bad input', () => {
  assert.throws(() => shouldResize({ ...base, mode: RESIZE_MODE.ON_FILL, currentSize: 0 }), RebalanceError);
  assert.throws(() => shouldResize({ ...base, mode: RESIZE_MODE.ON_FILL, threshold: 1 }), RebalanceError);
  assert.throws(() => shouldResize({ ...base, mode: 'whenever' }), RebalanceError);
});

// ---- re-anchor gating -----------------------------------------------------

test('re-anchoring is blocked while inventory is open', () => {
  const r = canReanchor({ wantsReanchor: true, openInventory: 0.0005 });
  assert.equal(r.reanchor, false);
  assert.match(r.reason, /strand/);
});

test('re-anchoring is allowed once flat', () => {
  const r = canReanchor({ wantsReanchor: true, openInventory: 0, openOrders: 4 });
  assert.equal(r.reanchor, true);
  assert.match(r.reason, /cancel resting orders/);
});

test('a policy that does not want to move is never overridden', () => {
  assert.equal(canReanchor({ wantsReanchor: false, openInventory: 0 }).reanchor, false);
});
