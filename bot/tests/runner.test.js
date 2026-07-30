import test from 'node:test';
import assert from 'node:assert/strict';

import { Runner, HALT } from '../src/runner.js';
import { normalizeGridConfig, resolveStopPrice, GridConfigError } from '../src/grid/config.js';
import { buildClientOrderId } from '../src/grid/engine.js';

const config = normalizeGridConfig({
  symbol: 'BTC/USD',
  lowerBound: 55000,
  upperBound: 75000,
  levels: 11,
  spacing: 'arithmetic',
  orderSize: 0.001,
});

const quiet = { warn() {}, info() {}, error() {} };

function env({ dryRun = false, stopPct, maxDailyLossPct = 0.05 } = {}) {
  return {
    grid: { symbol: 'BTC/USD', levels: 11, spacing: 'arithmetic' },
    ratios: {
      bandPct: 0.15,
      allocationPct: 0.8,
      anchorMode: 'on_flat',
      reanchorDrift: 0.5,
      resizeMode: 'on_flat',
      resizeThreshold: 0.1,
    },
    risk: { maxDailyLossPct, stopPct },
    runtime: { dryRun, pollIntervalMs: 1 },
  };
}

function fakeClient({ equity = 100, lastEquity = 100, price = 65000, open = [], closed = [] } = {}) {
  const calls = { submitted: [], cancelled: [] };
  return {
    calls,
    getAccount: async () => ({
      equity: String(equity),
      last_equity: String(lastEquity),
      buying_power: String(equity),
    }),
    getLatestCryptoQuote: async () => ({
      quotes: { 'BTC/USD': { bp: price - 10, ap: price + 10 } },
    }),
    getAsset: async () => ({ min_order_size: '0.000015565', tradable: true }),
    getOrders: async ({ status }) => (status === 'open' ? open : closed),
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

// ---- price stop derivation ------------------------------------------------

test('stop price is derived from the band, so it rescales with it', () => {
  const stop = resolveStopPrice(config, 0.1);
  assert.ok(Math.abs(stop.stopPrice - 49500) < 1e-6, '55000 * 0.9');

  // A band twice as high puts the stop twice as high — no hand-editing.
  const higher = normalizeGridConfig({ ...config, lowerBound: 110000, upperBound: 150000 });
  assert.ok(Math.abs(resolveStopPrice(higher, 0.1).stopPrice - 99000) < 1e-6);
});

test('the stop is opt-in', () => {
  assert.equal(resolveStopPrice(config, undefined), null);
  assert.equal(resolveStopPrice(config, null), null);
});

test('stop percentages outside (0,1) are rejected', () => {
  assert.throws(() => resolveStopPrice(config, 0), GridConfigError);
  assert.throws(() => resolveStopPrice(config, 1), GridConfigError);
  assert.throws(() => resolveStopPrice(config, -0.1), GridConfigError);
});

// ---- daily loss halt ------------------------------------------------------

test('daily loss halts BEFORE any order is placed', async () => {
  // 5% of 100 = -5.00 limit; down 6.
  const client = fakeClient({ equity: 94, lastEquity: 100 });
  const r = new Runner({ env: env(), client, logger: quiet });

  const s = await r.tick();

  assert.equal(s.halted, HALT.DAILY_LOSS);
  assert.equal(client.calls.submitted.length, 0, 'no new exposure after a breach');
  assert.equal(r.running, false);
});

test('a loss inside the limit keeps trading', async () => {
  const client = fakeClient({ equity: 97, lastEquity: 100 }); // -3 vs -5 limit
  const r = new Runner({ env: env(), client, logger: quiet });

  const s = await r.tick();

  assert.equal(s.halted, undefined);
  assert.ok(client.calls.submitted.length > 0);
});

test('the daily limit scales, so the same drop is fatal only at small size', async () => {
  // -$6 breaches a $100 account (-5%) but not a $1000 one (-0.6%).
  const small = new Runner({ env: env(), client: fakeClient({ equity: 94, lastEquity: 100 }), logger: quiet });
  assert.equal((await small.tick()).halted, HALT.DAILY_LOSS);

  const big = new Runner({ env: env(), client: fakeClient({ equity: 994, lastEquity: 1000 }), logger: quiet });
  assert.equal((await big.tick()).halted, undefined);
});

// ---- price stop -----------------------------------------------------------

test('price stop liquidates held inventory and halts', async () => {
  const client = fakeClient({ price: 65000 });
  const r = new Runner({ env: env({ stopPct: 0.1 }), client, logger: quiet });

  await r.tick(); // build + place
  r.engine.inventory.set(2, { qty: 0.002, price: 59000 });

  // Band is anchored near 65000, so lower ~55250 and stop ~49725.
  const stop = resolveStopPrice(r.engine.config, 0.1);
  client.getLatestCryptoQuote = async () => ({
    quotes: { 'BTC/USD': { bp: stop.stopPrice - 100, ap: stop.stopPrice - 90 } },
  });

  const s = await r.tick();

  assert.equal(s.halted, HALT.STOP_PRICE);
  const market = client.calls.submitted.find((o) => o.type === 'market');
  assert.ok(market, 'a market sell was sent');
  assert.equal(market.side, 'sell');
  assert.equal(r.engine.openInventory, 0, 'position is flat afterwards');
});

test('no stop configured means inventory is held, not cut', async () => {
  const client = fakeClient({ price: 65000 });
  const r = new Runner({ env: env({ stopPct: undefined }), client, logger: quiet });

  await r.tick();
  r.engine.inventory.set(2, { qty: 0.002, price: 59000 });

  client.getLatestCryptoQuote = async () => ({ quotes: { 'BTC/USD': { bp: 20000, ap: 20010 } } });
  const s = await r.tick();

  assert.equal(s.halted, undefined, 'holds rather than realizing a loss');
  assert.equal(r.engine.openInventory, 0.002);
  assert.equal(s.idle, true, 'but it is out of band, so it idles');
});

test('the stop does not fire when flat', async () => {
  const client = fakeClient({ price: 65000 });
  const r = new Runner({ env: env({ stopPct: 0.1 }), client, logger: quiet });

  await r.tick();
  client.getLatestCryptoQuote = async () => ({ quotes: { 'BTC/USD': { bp: 20000, ap: 20010 } } });

  const s = await r.tick();
  assert.equal(s.halted, undefined, 'nothing held, nothing to stop out of');
});

// ---- fills are recorded once, and placed only by reconcile ----------------

test('a fill is recorded once and never double-counted', async () => {
  const filled = {
    id: 'f1',
    symbol: 'BTC/USD',
    status: 'filled',
    client_order_id: buildClientOrderId('BTC/USD', 3, 'buy', 1),
    filled_qty: '0.001',
    filled_avg_price: '61000',
  };
  const client = fakeClient({ price: 65000 });
  const r = new Runner({ env: env(), client, logger: quiet });

  await r.tick(); // first tick seeds seenFills
  client.getOrders = async ({ status }) => (status === 'closed' ? [filled] : []);

  await r.tick();
  const after = r.engine.fills.length;
  await r.tick();

  assert.equal(r.engine.fills.length, after, 'the same fill is not ingested twice');
});

test('reconcile is the only writer — recordFill submits nothing', async () => {
  const client = fakeClient({ price: 65000 });
  const r = new Runner({ env: env(), client, logger: quiet });
  await r.tick();

  const before = client.calls.submitted.length;
  r.engine.recordFill({
    client_order_id: buildClientOrderId('BTC/USD', 3, 'buy', 9),
    filled_qty: '0.001',
    filled_avg_price: '61000',
  });

  assert.equal(client.calls.submitted.length, before, 'no order came from recording a fill');
  assert.equal(r.engine.openInventory, 0.001, 'but state was updated');
});

// ---- loop -----------------------------------------------------------------

test('the loop survives a transient API failure', async () => {
  const client = fakeClient({ price: 65000 });
  let n = 0;
  const original = client.getAccount;
  client.getAccount = async () => {
    if (++n === 2) throw new Error('502 bad gateway');
    return original();
  };

  const r = new Runner({ env: env(), client, logger: quiet });
  const out = await r.start({ maxTicks: 4 });

  assert.equal(out.ticks, 4, 'it kept going');
  assert.equal(out.halted, null);
});

test('the loop stops itself on a halt', async () => {
  const client = fakeClient({ equity: 90, lastEquity: 100 });
  const r = new Runner({ env: env(), client, logger: quiet });

  const out = await r.start({ maxTicks: 10 });

  assert.equal(out.halted, HALT.DAILY_LOSS);
  assert.ok(out.ticks < 10, 'it did not run to the cap');
});

test('dry run places nothing, including the stop liquidation', async () => {
  const client = fakeClient({ price: 65000 });
  const r = new Runner({ env: env({ dryRun: true, stopPct: 0.1 }), client, logger: quiet });

  await r.tick();
  r.engine.inventory.set(2, { qty: 0.002, price: 59000 });
  const stop = resolveStopPrice(r.engine.config, 0.1);
  client.getLatestCryptoQuote = async () => ({
    quotes: { 'BTC/USD': { bp: stop.stopPrice - 100, ap: stop.stopPrice - 90 } },
  });

  await r.tick();

  assert.equal(client.calls.submitted.length, 0);
  assert.equal(client.calls.cancelled.length, 0);
});
