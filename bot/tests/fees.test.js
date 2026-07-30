import test from 'node:test';
import assert from 'node:assert/strict';

import { GridEngine } from '../src/grid/engine.js';
import { normalizeGridConfig } from '../src/grid/config.js';

/* Regression: Alpaca takes its crypto fee OUT OF THE DELIVERED ASSET.
   A filled buy of 0.00016812 BTC left 0.000167867 in the account — 0.15%
   short — while filled_qty still reported 0.00016812 and accrued_fees was $0.
   Sizing the counter-sell from the fill quantity asked for BTC the fee had
   consumed, and every sell was rejected with "insufficient balance for BTC".
   The bot stalled and halted on its very first real fill. */

const config = normalizeGridConfig({
  symbol: 'BTC/USD',
  lowerBound: 61504.63,
  upperBound: 68250,
  levels: 7,
  spacing: 'geometric',
  orderSize: 0.00016812,
});

const engineWith = (inventory, availableQty) => {
  const e = new GridEngine({ config, client: {}, dryRun: true, logger: { warn() {} } });
  for (const [lvl, held] of inventory) e.inventory.set(lvl, held);
  e.availableQty = availableQty;
  return e;
};

const BOUGHT = 0.00016812;
const RECEIVED = 0.000167867; // what actually landed, after the 0.15% fee

test('the exact production failure: exit is capped at the real balance', () => {
  const e = engineWith([[3, { qty: BOUGHT, price: 64660.74 }]], RECEIVED);

  const sell = e.desiredOrders(64700).find((o) => o.side === 'sell');

  assert.ok(sell, 'an exit is still planned');
  assert.ok(sell.qty <= RECEIVED, `asked ${sell.qty}, only ${RECEIVED} available`);
});

test('exit quantity is floored, never rounded up', () => {
  // Rounding 0.0001678670001 to 9dp would round UP past the balance.
  const available = 0.000167867;
  const e = engineWith([[3, { qty: 0.000167867999, price: 64660.74 }]], available);

  const sell = e.desiredOrders(64700).find((o) => o.side === 'sell');
  assert.ok(sell.qty <= available, `${sell.qty} exceeds ${available}`);
});

test('with no fee shortfall the full quantity is still sold', () => {
  const e = engineWith([[3, { qty: BOUGHT, price: 64660.74 }]], BOUGHT);

  const sell = e.desiredOrders(64700).find((o) => o.side === 'sell');
  assert.equal(sell.qty, BOUGHT, 'must not shave quantity that is genuinely there');
});

test('multiple held levels are scaled proportionally, never over-committed', () => {
  const inventory = [
    [0, { qty: BOUGHT, price: 61504.63 }],
    [1, { qty: BOUGHT, price: 62539.17 }],
    [2, { qty: BOUGHT, price: 63591.10 }],
  ];
  const available = BOUGHT * 3 * 0.9985; // three fills, three fees
  const e = engineWith(inventory, available);

  const sells = e.desiredOrders(64700).filter((o) => o.side === 'sell');
  const total = sells.reduce((s, o) => s + o.qty, 0);

  assert.equal(sells.length, 3, 'every level still gets an exit');
  assert.ok(total <= available, `total ${total} exceeds available ${available}`);
});

test('an unknown balance does not clamp anything', () => {
  const e = engineWith([[3, { qty: BOUGHT, price: 64660.74 }]], Infinity);

  const sell = e.desiredOrders(64700).find((o) => o.side === 'sell');
  assert.equal(sell.qty, BOUGHT, 'Infinity means "do not clamp"');
});

test('a balance of zero plans no exit rather than a rejected one', () => {
  const e = engineWith([[3, { qty: BOUGHT, price: 64660.74 }]], 0);

  const sells = e.desiredOrders(64700).filter((o) => o.side === 'sell');
  assert.equal(sells.length, 0, 'dust must not become a doomed order');
});

test('capping exits does not disturb the buy side', () => {
  const e = engineWith([[3, { qty: BOUGHT, price: 64660.74 }]], RECEIVED);

  const buys = e.desiredOrders(64700).filter((o) => o.side === 'buy');
  assert.ok(buys.length > 0);
  assert.ok(buys.every((b) => b.qty === 0.00016812), 'buys are sized in USD, unaffected by BTC balance');
});

// Regression: qty_available EXCLUDES quantity reserved by our own resting
// sell, so feeding it in raw made the grid oscillate — place the exit, next
// tick sees 0 available and cancels it, tick after re-places it. Observed live
// as +0/-1, +1/-0, +0/-1 on alternating ticks.
test('an exit already resting does not cancel itself next tick', async () => {
  const { Runner } = await import('../src/runner.js');
  const { buildClientOrderId } = await import('../src/grid/engine.js');

  const restingSell = {
    id: 's1', symbol: 'BTC/USD', side: 'sell', status: 'open',
    client_order_id: buildClientOrderId('BTC/USD', 4, 'sell', 1),
    qty: '0.000167867', limit_price: '66010.66',
  };

  const runner = new Runner({
    env: {
      grid: { symbol: 'BTC/USD', levels: 7, spacing: 'geometric' },
      ratios: { bandPct: 0.05, allocationPct: 0.8, anchorMode: 'on_flat', reanchorDrift: 0.5, resizeMode: 'on_flat', resizeThreshold: 0.1, minOrderNotional: 10 },
      risk: { maxDailyLossPct: 0.05 },
      runtime: { dryRun: true, pollIntervalMs: 1 },
    },
    client: {
      getAccount: async () => ({ equity: '100', last_equity: '100', buying_power: '89' }),
      getLatestCryptoQuote: async () => ({ quotes: { 'BTC/USD': { bp: 64650, ap: 64660 } } }),
      getAsset: async () => ({ min_order_size: '0.000015565' }),
      getOrders: async () => [restingSell],
      // Alpaca reports 0 available because the resting sell reserves it all.
      getPositions: async () => [{ symbol: 'BTCUSD', qty: '0.000167867', qty_available: '0' }],
      submitOrder: async (o) => o,
      cancelOrder: async () => ({}),
    },
    logger: { warn() {}, info() {} },
  });

  const live = await runner.readLiveState();

  assert.ok(live.availableQty > 0, 'our own resting sell must be added back');
  assert.ok(
    Math.abs(live.availableQty - 0.000167867) < 1e-12,
    `expected the full balance, got ${live.availableQty}`,
  );
});

test('fee drag compounds across round trips', () => {
  // Each trip loses 0.15% of the base asset; the live balance keeps exits
  // honest without any local fee bookkeeping.
  let held = BOUGHT;
  for (let trip = 0; trip < 5; trip++) {
    const e = engineWith([[3, { qty: BOUGHT, price: 64660.74 }]], held);
    const sell = e.desiredOrders(64700).find((o) => o.side === 'sell');
    assert.ok(sell.qty <= held, `trip ${trip}: asked ${sell.qty}, held ${held}`);
    held *= 0.9985;
  }
});
