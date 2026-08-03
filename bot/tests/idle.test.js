/* Idling while holding must be as visible as a halt, without being one.

   Out of band while FLAT is a grid waiting to re-anchor and costs nothing.
   Out of band while HOLDING is capital locked in a position with no exit
   resting against it — backtests sat there for 58 unbroken days while
   /health reported ok and the log said nothing but "IDLE".

   It is deliberately NOT a halt: the grid recovers by itself the moment price
   re-enters the band, so halting would turn a temporary pause into a
   permanent one needing a human. */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Runner } from '../src/runner.js';
import { createApiServer } from '../src/api/server.js';

const quiet = { warn() {}, info() {}, error() {} };

function memState() {
  const store = new Map();
  return {
    readAnchor: (s) => store.get(`anchor:${s}`),
    writeAnchor: (s, p) => store.set(`anchor:${s}`, p),
    readHalt: () => null,
    writeHalt: () => {},
    readPeakEquity: () => undefined,
    writePeakEquity: () => {},
  };
}

function env({ idleAlertHours = 24 } = {}) {
  return {
    grid: { symbol: 'BTC/USD', levels: 5, spacing: 'arithmetic' },
    ratios: {
      bandPct: 0.15, allocationPct: 0.8, anchorMode: 'session',
      reanchorDrift: 0.5, resizeMode: 'session', resizeThreshold: 0.1, feeRate: 0,
    },
    risk: { maxDailyLossPct: 1 },
    runtime: { dryRun: false, pollIntervalMs: 1, idleAlertHours },
  };
}

function fakeClient({ price = 65000, equity = 1000 } = {}) {
  return {
    getAccount: async () => ({
      equity: String(equity), last_equity: String(equity),
      buying_power: String(equity), cash: String(equity), long_market_value: '0',
    }),
    getLatestCryptoQuote: async () => ({
      quotes: { 'BTC/USD': { bp: price - 10, ap: price + 10 } },
    }),
    getAsset: async () => ({ min_order_size: '0.000015565', tradable: true }),
    getPositions: async () => [],
    getOrders: async () => [],
    submitOrder: async (o) => ({ id: 'srv-1', ...o }),
    cancelOrder: async () => ({}),
  };
}

/** Drive one tick at an in-band price to build the engine, then move price. */
async function runnerHolding({ holding = true, idleAlertHours = 24 } = {}) {
  const client = fakeClient({ price: 65000 });
  const r = new Runner({ env: env({ idleAlertHours }), client, logger: quiet, state: memState() });
  await r.tick(); // anchors at 65000, band 55250–74750

  if (holding) r.engine.inventory.set(1, { qty: 0.001, price: 60000, cost: 60 });

  // Far below the lower bound — out of band.
  r.client.getLatestCryptoQuote = async () => ({
    quotes: { 'BTC/USD': { bp: 40000, ap: 40020 } },
  });
  return r;
}

test('out of band while flat is idle, but not idle-HOLDING', async () => {
  const r = await runnerHolding({ holding: false });
  const s = await r.tick();

  assert.equal(s.idle, true);
  assert.equal(s.idleHolding, false);
  assert.equal(r.idleTicks, 0, 'a flat grid waiting to re-anchor costs nothing');
  assert.equal(r.idleSince, null);
});

test('out of band while holding accumulates idle ticks', async () => {
  const r = await runnerHolding();

  await r.tick();
  await r.tick();
  const s = await r.tick();

  assert.equal(s.idleHolding, true);
  assert.equal(r.idleTicks, 3);
  assert.ok(r.idleSince !== null, 'the clock starts on the first idle-holding tick');
});

test('idling never halts — the grid must be free to recover', async () => {
  const r = await runnerHolding();

  for (let i = 0; i < 20; i++) await r.tick();

  assert.equal(r.halted, null);
  assert.equal(r.idleTicks, 20);
});

test('price returning to the band clears the idle run', async () => {
  const r = await runnerHolding();
  await r.tick();
  await r.tick();
  assert.equal(r.idleTicks, 2);

  r.client.getLatestCryptoQuote = async () => ({
    quotes: { 'BTC/USD': { bp: 64990, ap: 65010 } },
  });
  await r.tick();

  assert.equal(r.idleTicks, 0, 'recovery resets the counter');
  assert.equal(r.idleSince, null);
});

test('idleAlerting trips only after the configured duration', async () => {
  const r = await runnerHolding({ idleAlertHours: 24 });
  await r.tick();

  assert.equal(r.idleAlerting, false, 'moments in — not yet noteworthy');

  // Backdate the clock rather than waiting a day.
  r.idleSince = Date.now() - 25 * 3600 * 1000;
  assert.equal(r.idleAlerting, true);
});

test('IDLE_ALERT_HOURS=0 disables the alert without disabling tracking', async () => {
  const r = await runnerHolding({ idleAlertHours: 0 });
  await r.tick();
  r.idleSince = Date.now() - 365 * 24 * 3600 * 1000;

  assert.equal(r.idleAlerting, false);
  assert.ok(r.idleTicks > 0, 'still counted, just not escalated');
});

test('the log line names the duration, not just the state', async () => {
  const r = await runnerHolding();
  const s = await r.tick();
  s.idleMs = 3 * 24 * 3600 * 1000;
  s.idleAlerting = true;

  const line = r.format(s);
  assert.match(line, /IDLE HOLDING/);
  assert.match(line, /3\.0d/, 'a three-day pause should read as three days');
});

test('a flat idle grid is reported quietly, not shouted about', async () => {
  const r = await runnerHolding({ holding: false });
  const line = r.format(await r.tick());

  assert.match(line, /idle \(out of band, flat\)/);
  assert.doesNotMatch(line, /IDLE HOLDING/);
});

// ---- what the dashboard and platform probes see ---------------------------

test('the snapshot carries idle duration for the dashboard', async () => {
  const r = await runnerHolding();
  await r.tick();

  const snap = r.snapshot();
  assert.equal(snap.status.idleHolding, true);
  assert.equal(snap.status.idleTicks, 1);
  assert.ok(snap.status.idleSince !== null);
});

test('/health reports idling without failing the platform probe', async () => {
  const r = await runnerHolding();
  await r.tick();
  r.idleSince = Date.now() - 100 * 24 * 3600 * 1000;

  const api = createApiServer({ runner: r, port: 0, logger: quiet });
  await api.start();
  try {
    const { port } = api.server.address();
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    const body = await res.json();

    // Failing the probe here would have the platform restart a bot that is
    // working as designed, and a restart loop is worse than a quiet pause.
    assert.equal(res.status, 200);
    assert.equal(body.ok, true, 'a recoverable pause must not fail the probe');
    assert.equal(body.degraded, true, 'but it must be visible to alert on');
    assert.equal(body.idleHolding, true);
    assert.ok(body.idleMs > 0);
  } finally {
    await api.stop();
  }
});

test('/health stays undegraded when the grid is merely flat and out of band', async () => {
  const r = await runnerHolding({ holding: false });
  await r.tick();

  const api = createApiServer({ runner: r, port: 0, logger: quiet });
  await api.start();
  try {
    const { port } = api.server.address();
    const body = await (await fetch(`http://127.0.0.1:${port}/health`)).json();

    assert.equal(body.ok, true);
    assert.equal(body.degraded, false);
    assert.equal(body.idleHolding, false);
  } finally {
    await api.stop();
  }
});
