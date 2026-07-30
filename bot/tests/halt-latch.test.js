import test from 'node:test';
import assert from 'node:assert/strict';

import { Runner, HALT } from '../src/runner.js';
import { createApiServer } from '../src/api/server.js';

/* Regression: a halt that lives only in memory is undone by the supervisor.
   loop.js exited non-zero; Railway/Render/Fly restart on that by default. After
   a price stop the bot is FLAT, which frees on_flat to re-anchor on the crashed
   price and buy straight back into what the stop just exited. */

const quiet = { warn() {}, info() {}, error() {} };

/** A state store shared across "processes", like a mounted volume. */
function volume() {
  let halt = null;
  const anchors = new Map();
  return {
    readAnchor: (s) => anchors.get(s),
    writeAnchor: (s, p) => anchors.set(s, p),
    readHalt: () => halt,
    writeHalt: (reason, ctx) => { halt = { reason, at: '2026-07-30T00:00:00Z', ...ctx }; return halt; },
    clearHalt: () => { halt = null; },
  };
}

const env = (over = {}) => ({
  grid: { symbol: 'BTC/USD', levels: 6, spacing: 'geometric' },
  ratios: {
    bandPct: 0.1, allocationPct: 0.8, anchorMode: 'on_flat', reanchorDrift: 0.5,
    resizeMode: 'on_flat', resizeThreshold: 0.1, minOrderNotional: 10, feeRate: 0,
  },
  risk: { maxDailyLossPct: 0.05 },
  runtime: { dryRun: false, pollIntervalMs: 1 },
  ...over,
});

function client({ equity = 100, lastEquity = 100, price = 65000 } = {}) {
  const calls = { submitted: [] };
  return {
    calls,
    getAccount: async () => ({ equity: String(equity), last_equity: String(lastEquity), buying_power: String(equity) }),
    getLatestCryptoQuote: async () => ({ quotes: { 'BTC/USD': { bp: price - 5, ap: price + 5 } } }),
    getAsset: async () => ({ min_order_size: '0.000015565' }),
    getOrders: async () => [],
    getPositions: async () => [],
    submitOrder: async (o) => { calls.submitted.push(o); return { id: 'x', ...o }; },
    cancelOrder: async () => ({}),
  };
}

test('a halt is written to the shared store, not just memory', async () => {
  const state = volume();
  const r = new Runner({ env: env(), client: client({ equity: 90 }), logger: quiet, state });

  await r.tick();

  assert.equal(r.halted, HALT.DAILY_LOSS);
  assert.equal(state.readHalt().reason, HALT.DAILY_LOSS, 'latched for the next process');
});

test('THE BUG: a restarted process refuses to trade, even when conditions look fine', async () => {
  const state = volume();

  // Process 1 halts on a bad day.
  const first = new Runner({ env: env(), client: client({ equity: 90 }), logger: quiet, state });
  await first.tick();
  assert.equal(first.halted, HALT.DAILY_LOSS);

  // Process 2 restarts. Equity is healthy again — pre-latch it would have
  // happily rebuilt the grid and re-entered.
  const healthy = client({ equity: 100, lastEquity: 100 });
  const second = new Runner({ env: env(), client: healthy, logger: quiet, state });

  const s = await second.tick();

  assert.equal(s.halted, HALT.DAILY_LOSS, 'the latch outlives the process');
  assert.equal(s.latched, true);
  assert.equal(healthy.calls.submitted.length, 0, 'and NOT ONE order was placed');
});

test('the price-stop case specifically: flat + healthy must still refuse', async () => {
  const state = volume();
  state.writeHalt(HALT.STOP_PRICE, { price: 49000 });

  // Flat, and price has recovered — every condition invites re-entry.
  const c = client({ equity: 100, price: 65000 });
  const r = new Runner({ env: env(), client: c, logger: quiet, state });

  const s = await r.tick();

  assert.equal(s.halted, HALT.STOP_PRICE);
  assert.equal(c.calls.submitted.length, 0, 'the stop is not undone by a restart');
});

test('clearing the latch is what lets it trade again', async () => {
  const state = volume();
  state.writeHalt(HALT.DAILY_LOSS, {});

  const blocked = client();
  await new Runner({ env: env(), client: blocked, logger: quiet, state }).tick();
  assert.equal(blocked.calls.submitted.length, 0);

  state.clearHalt();

  const allowed = client();
  const r = new Runner({ env: env(), client: allowed, logger: quiet, state });
  const s = await r.tick();

  assert.equal(s.halted, undefined);
  assert.ok(allowed.calls.submitted.length > 0, 'trading resumes only after a human clears it');
});

test('a state store without halt support degrades to old behaviour, not a crash', async () => {
  const partial = { readAnchor: () => undefined, writeAnchor: () => {} };
  const r = new Runner({ env: env(), client: client({ equity: 90 }), logger: quiet, state: partial });

  await assert.doesNotReject(() => r.tick());
  assert.equal(r.halted, HALT.DAILY_LOSS);
});

// ---- health endpoint ------------------------------------------------------

async function boot(runner) {
  const api = createApiServer({ runner, port: 0, logger: quiet });
  await api.start();
  const { port } = api.server.address();
  return { api, url: `http://127.0.0.1:${port}`, close: () => api.stop() };
}

const fakeRunner = (halted) => ({
  running: !halted, halted, dryRun: false, ticks: 5, startedAt: Date.now(),
  snapshot: () => ({}),
});

test('health reports 200/ok while trading', async () => {
  const t = await boot(fakeRunner(null));
  try {
    const res = await fetch(`${t.url}/health`);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).ok, true);
  } finally { await t.close(); }
});

test('health reports 503/not-ok when halted, so a monitor actually fires', async () => {
  const t = await boot(fakeRunner(HALT.STOP_PRICE));
  try {
    const res = await fetch(`${t.url}/health`);
    assert.equal(res.status, 503, 'a halted bot must not read as healthy');
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.equal(body.halted, HALT.STOP_PRICE, 'and it names the reason');
  } finally { await t.close(); }
});
