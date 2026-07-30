import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GridEngine,
  buildClientOrderId,
  parseClientOrderId,
} from '../src/grid/engine.js';
import { normalizeGridConfig } from '../src/grid/config.js';

const config = normalizeGridConfig({
  symbol: 'BTC/USD',
  lowerBound: 55000,
  upperBound: 75000,
  levels: 11,
  spacing: 'arithmetic', // 2000 apart, easy to reason about
  orderSize: 0.001,
});

/** Records calls instead of hitting the network. */
function fakeClient({ open = [], all = [] } = {}) {
  const calls = { submitted: [], cancelled: [] };
  return {
    calls,
    getOrders: async ({ status }) => (status === 'open' ? open : all),
    submitOrder: async (o) => {
      calls.submitted.push(o);
      return { id: `srv-${calls.submitted.length}`, ...o };
    },
    cancelOrder: async (id) => {
      calls.cancelled.push(id);
      return {};
    },
  };
}

const engineAt = (client, dryRun = false) =>
  new GridEngine({ config, client, dryRun, logger: { warn() {}, info() {} } });

/** Build a live order the way Alpaca would return it. */
function liveOrder({ levelIndex, side, price, qty, id = 'o1' }) {
  return {
    id,
    symbol: 'BTC/USD',
    client_order_id: buildClientOrderId('BTC/USD', levelIndex, side, 1),
    limit_price: String(price),
    qty: String(qty),
    status: 'open',
  };
}

// ---- client order id ------------------------------------------------------

test('client order ids round-trip level and side', () => {
  const id = buildClientOrderId('BTC/USD', 7, 'sell', 42);
  assert.match(id, /^apex-BTCUSD-L7-sell-42$/);
  assert.deepEqual(parseClientOrderId(id), { levelIndex: 7, side: 'sell' });
});

test('foreign order ids are not claimed', () => {
  assert.equal(parseClientOrderId('some-manual-order'), null);
  assert.equal(parseClientOrderId(undefined), null);
});

// ---- desired book ---------------------------------------------------------

test('a cold start from flat rests ONLY buys', () => {
  const e = engineAt(fakeClient());
  const desired = e.desiredOrders(65000);

  assert.ok(desired.length > 0);
  assert.ok(desired.every((o) => o.side === 'buy'), 'no sells without inventory to sell');
  assert.ok(desired.every((o) => o.price < 65000), 'buys sit below price');
});

test('holding inventory produces an exit one level up', () => {
  const e = engineAt(fakeClient());
  e.inventory.set(3, { qty: 0.001, price: 61000 }); // level 3 = 61000

  const desired = e.desiredOrders(65000);
  const sells = desired.filter((o) => o.side === 'sell');

  assert.equal(sells.length, 1);
  assert.equal(sells[0].levelIndex, 4);
  assert.equal(sells[0].price, 63000);
  assert.equal(sells[0].qty, 0.001);
});

test('no buy is planned at a level an exit already claims', () => {
  const e = engineAt(fakeClient());
  e.inventory.set(3, { qty: 0.001, price: 61000 }); // exit claims level 4

  const desired = e.desiredOrders(70000);
  const atFour = desired.filter((o) => o.levelIndex === 4);

  assert.equal(atFour.length, 1, 'exactly one order at that level');
  assert.equal(atFour[0].side, 'sell');
  assert.equal(desired.filter((o) => o.levelIndex === 3).length, 0, 'level 3 is held, not re-bought');
});

// ---- reconcile ------------------------------------------------------------

test('reconcile submits the missing book on a cold start', async () => {
  const client = fakeClient();
  const e = engineAt(client);

  const result = await e.reconcile(65000);

  assert.equal(result.cancelled.length, 0);
  assert.equal(client.calls.submitted.length, result.submitted.length);
  assert.ok(client.calls.submitted.every((o) => o.side === 'buy'));
});

test('reconcile is idempotent — a matching book submits nothing', async () => {
  const e0 = engineAt(fakeClient());
  const desired = e0.desiredOrders(65000);

  const open = desired.map((d, i) =>
    liveOrder({ ...d, id: `o${i}` }),
  );
  const client = fakeClient({ open });
  const e = engineAt(client);

  const result = await e.reconcile(65000);

  assert.equal(result.submitted.length, 0, 'nothing to add');
  assert.equal(result.cancelled.length, 0, 'nothing to remove');
  assert.equal(client.calls.submitted.length, 0);
});

test('reconcile cancels an order at a stale price', async () => {
  const open = [liveOrder({ levelIndex: 2, side: 'buy', price: 12345, qty: 0.001, id: 'stale' })];
  const client = fakeClient({ open });
  const e = engineAt(client);

  await e.reconcile(65000);

  assert.ok(client.calls.cancelled.includes('stale'));
});

test('reconcile ignores orders it did not place', async () => {
  const open = [
    { id: 'manual', symbol: 'BTC/USD', client_order_id: 'my-own-order', limit_price: '60000', qty: '1', status: 'open' },
  ];
  const client = fakeClient({ open });
  const e = engineAt(client);

  await e.reconcile(65000);

  assert.equal(client.calls.cancelled.length, 0, 'hand-placed orders are left alone');
});

test('out of band cancels everything and rests nothing', async () => {
  const open = [liveOrder({ levelIndex: 1, side: 'buy', price: 57000, qty: 0.001, id: 'x' })];
  const client = fakeClient({ open });
  const e = engineAt(client);

  const result = await e.reconcile(90000);

  assert.equal(result.skipped, 'out of band');
  assert.equal(result.submitted.length, 0);
  assert.ok(client.calls.cancelled.includes('x'));
});

test('dry run plans without touching the account', async () => {
  const client = fakeClient();
  const e = engineAt(client, true);

  const result = await e.reconcile(65000);

  assert.equal(result.dryRun, true);
  assert.ok(result.submitted.length > 0, 'it still reports a plan');
  assert.equal(client.calls.submitted.length, 0, 'but submits nothing');
  assert.equal(client.calls.cancelled.length, 0);
});

test('a rejected level does not abort the pass', async () => {
  const client = fakeClient();
  let n = 0;
  client.submitOrder = async (o) => {
    if (++n === 2) throw new Error('insufficient buying power');
    return { id: `srv-${n}`, ...o };
  };
  const e = engineAt(client);

  const result = await e.reconcile(65000);
  assert.ok(result.submitted.length >= 3, 'the rest still went through');
});

// ---- fills ----------------------------------------------------------------

test('a buy fill records inventory and rests an exit above it', async () => {
  const client = fakeClient();
  const e = engineAt(client);

  const counter = await e.onFill({
    client_order_id: buildClientOrderId('BTC/USD', 3, 'buy', 1),
    filled_qty: '0.001',
    filled_avg_price: '61000',
  });

  assert.equal(e.openInventory, 0.001);
  assert.equal(counter.side, 'sell');
  assert.equal(Number(counter.qty), 0.001);
  assert.equal(Number(counter.limitPrice), 63000);
});

test('a sell fill realizes P&L and clears the inventory it closed', async () => {
  const e = engineAt(fakeClient());

  await e.onFill({
    client_order_id: buildClientOrderId('BTC/USD', 3, 'buy', 1),
    filled_qty: '0.001',
    filled_avg_price: '61000',
  });
  await e.onFill({
    client_order_id: buildClientOrderId('BTC/USD', 4, 'sell', 2),
    filled_qty: '0.001',
    filled_avg_price: '63000',
  });

  assert.equal(e.openInventory, 0, 'position closed');
  assert.ok(Math.abs(e.realizedPnl - 2) < 1e-9, '0.001 x $2000 = $2');
});

test('a resize does not change the size of an open round trip', async () => {
  const e = engineAt(fakeClient());

  await e.onFill({
    client_order_id: buildClientOrderId('BTC/USD', 3, 'buy', 1),
    filled_qty: '0.001',
    filled_avg_price: '61000',
  });

  e.applyResize(0.005); // equity grew fivefold mid-position

  const desired = e.desiredOrders(65000);
  const exit = desired.find((o) => o.side === 'sell');
  assert.equal(exit.qty, 0.001, 'the exit still matches what was bought');

  const newBuy = desired.find((o) => o.side === 'buy');
  assert.equal(newBuy.qty, 0.005, 'but new levels use the new size');
});

test('untagged fills are ignored rather than corrupting state', async () => {
  const e = engineAt(fakeClient());
  const r = await e.onFill({ client_order_id: 'manual', filled_qty: '1', filled_avg_price: '60000' });
  assert.equal(r, null);
  assert.equal(e.openInventory, 0);
});

// ---- hydrate --------------------------------------------------------------

test('hydrate rebuilds inventory from exchange history', async () => {
  const all = [
    { client_order_id: buildClientOrderId('BTC/USD', 2, 'buy', 1), status: 'filled', filled_qty: '0.001', filled_avg_price: '59000' },
    { client_order_id: buildClientOrderId('BTC/USD', 3, 'buy', 2), status: 'filled', filled_qty: '0.001', filled_avg_price: '61000' },
    { client_order_id: buildClientOrderId('BTC/USD', 3, 'sell', 3), status: 'filled', filled_qty: '0.001', filled_avg_price: '61000' },
    { client_order_id: buildClientOrderId('BTC/USD', 9, 'buy', 4), status: 'canceled', qty: '0.001' },
  ];
  const e = engineAt(fakeClient({ all }));

  await e.hydrate();

  // Level 2 buy stands; level 3 sell closed the level-2 buy... no: sell at 3
  // closes the buy at 2. So only level 3's buy remains.
  assert.equal(e.inventory.has(3), true);
  assert.equal(e.inventory.has(2), false);
  assert.equal(e.inventory.has(9), false, 'cancelled orders are not inventory');
});
