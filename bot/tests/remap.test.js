import test from 'node:test';
import assert from 'node:assert/strict';

import { GridEngine, buildClientOrderId } from '../src/grid/engine.js';
import { normalizeGridConfig } from '../src/grid/config.js';
import { Runner } from '../src/runner.js';

/* Regression: a level index only means something inside the band that produced
   it. Changing GRID_BAND_PCT or GRID_LEVELS makes index 3 refer to a totally
   different price — a live position bought at $64,660 in a ±5% band would have
   been handed an exit at $72,700 instead of $66,010 after switching to ±10%. */

const oldBand = normalizeGridConfig({
  symbol: 'BTC/USD', lowerBound: 61750, upperBound: 68250,
  levels: 7, spacing: 'geometric', orderSize: 0.000168,
});
const newBand = normalizeGridConfig({
  symbol: 'BTC/USD', lowerBound: 61918, upperBound: 75678,
  levels: 6, spacing: 'geometric', orderSize: 0.000168,
});

const quiet = { warn() {}, info() {} };

function engineWithHistory(config) {
  const filled = [{
    client_order_id: buildClientOrderId('BTC/USD', 3, 'buy', 1),
    status: 'filled', filled_qty: '0.000167867', filled_avg_price: '64660.74',
  }];
  return new GridEngine({
    config,
    client: { getOrders: async () => filled },
    dryRun: true,
    logger: quiet,
  });
}

test('a holding keeps a sensible exit after the band changes', async () => {
  const before = engineWithHistory(oldBand);
  await before.hydrate();
  const exitBefore = before.desiredOrders(64800).find((o) => o.side === 'sell');

  const after = engineWithHistory(newBand);
  await after.hydrate();
  const exitAfter = after.desiredOrders(64800).find((o) => o.side === 'sell');

  // Without the remap this landed on the raw index 3 -> exit at ~$72,700.
  assert.ok(exitAfter, 'the position still has an exit');
  assert.ok(
    exitAfter.price < 70000,
    `exit drifted to $${exitAfter.price} — index was used instead of price`,
  );
  assert.ok(exitBefore.price < exitAfter.price, 'a wider band does widen the target somewhat');
});

test('remap picks the level nearest the entry price', () => {
  const e = new GridEngine({ config: newBand, client: {}, dryRun: true, logger: quiet });
  e.inventory.set(0, { qty: 0.0001, price: 64660.74 });

  e.remapInventoryByPrice();

  const [idx] = [...e.inventory.keys()];
  const level = newBand.levels;
  const chosen = e.levels[idx];
  for (const lvl of e.levels) {
    assert.ok(
      Math.abs(chosen.price - 64660.74) <= Math.abs(lvl.price - 64660.74) + 1e-9,
      `level ${idx} at ${chosen.price} is not nearest to 64660.74`,
    );
  }
  assert.ok(level > 0);
});

test('two holdings collapsing onto one level merge at a weighted price', () => {
  const e = new GridEngine({ config: newBand, client: {}, dryRun: true, logger: quiet });
  e.inventory.set(0, { qty: 0.001, price: 64400 });
  e.inventory.set(1, { qty: 0.003, price: 64500 });

  e.remapInventoryByPrice();

  const total = [...e.inventory.values()].reduce((s, h) => s + h.qty, 0);
  assert.ok(Math.abs(total - 0.004) < 1e-12, 'no quantity is lost in the merge');

  if (e.inventory.size === 1) {
    const [held] = [...e.inventory.values()];
    assert.ok(held.price > 64400 && held.price < 64500, 'weighted, not either endpoint');
  }
});

test('remap is a no-op when the band has not changed', async () => {
  const e = engineWithHistory(oldBand);
  await e.hydrate();
  const before = [...e.inventory.entries()];
  e.remapInventoryByPrice();
  assert.deepEqual([...e.inventory.entries()], before);
});

// ---- state isolation ------------------------------------------------------

test('a Runner writes anchors only to its injected store', async () => {
  const store = new Map();
  const state = {
    readAnchor: (s) => store.get(s),
    writeAnchor: (s, p) => store.set(s, p),
  };

  const runner = new Runner({
    env: {
      grid: { symbol: 'BTC/USD', levels: 6, spacing: 'geometric' },
      ratios: { bandPct: 0.1, allocationPct: 0.8, anchorMode: 'on_flat', reanchorDrift: 0.5, resizeMode: 'on_flat', resizeThreshold: 0.1, minOrderNotional: 10 },
      risk: { maxDailyLossPct: 0.05 },
      runtime: { dryRun: true, pollIntervalMs: 1 },
    },
    client: {
      getAccount: async () => ({ equity: '1000', last_equity: '1000', buying_power: '1000' }),
      getLatestCryptoQuote: async () => ({ quotes: { 'BTC/USD': { bp: 64990, ap: 65010 } } }),
      getAsset: async () => ({ min_order_size: '0.000015565' }),
      getOrders: async () => [],
      getPositions: async () => [],
      submitOrder: async (o) => o,
      cancelOrder: async () => ({}),
    },
    logger: quiet,
    state,
  });

  await runner.tick();

  assert.ok(store.has('BTC/USD'), 'the injected store received the anchor');
  assert.ok(store.get('BTC/USD') > 0);
});
