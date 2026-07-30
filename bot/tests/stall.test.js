import test from 'node:test';
import assert from 'node:assert/strict';

import { Runner, HALT, STALL_LIMIT } from '../src/runner.js';
import { parseNotionalFloor } from '../src/api/probe-minimums.js';

const quiet = { warn() {}, info() {}, error() {} };

function env() {
  return {
    grid: { symbol: 'BTC/USD', levels: 5, spacing: 'geometric' },
    ratios: {
      bandPct: 0.15, allocationPct: 0.8, anchorMode: 'on_flat', reanchorDrift: 0.5,
      resizeMode: 'on_flat', resizeThreshold: 0.1, minOrderNotional: 10,
    },
    risk: { maxDailyLossPct: 0.05 },
    runtime: { dryRun: false, pollIntervalMs: 1 },
  };
}

/** A client whose submitOrder always fails, as Alpaca did on the first run. */
function rejectingClient(reason = 'cost basis must be >= minimal amount of order 10') {
  const calls = { attempted: 0 };
  return {
    calls,
    getAccount: async () => ({ equity: '100', last_equity: '100', buying_power: '100' }),
    getLatestCryptoQuote: async () => ({ quotes: { 'BTC/USD': { bp: 64990, ap: 65010 } } }),
    getAsset: async () => ({ min_order_size: '0.000015565', tradable: true }),
    getPositions: async () => [],
    getOrders: async () => [],
    submitOrder: async () => { calls.attempted++; throw new Error(reason); },
    cancelOrder: async () => ({}),
  };
}

// ---- the bug this exists to prevent ---------------------------------------

test('a tick with every order rejected is NOT reported as converged', async () => {
  const r = new Runner({ env: env(), client: rejectingClient(), logger: quiet });

  const s = await r.tick();

  assert.equal(s.submitted, 0);
  assert.ok(s.rejected > 0, 'rejections are counted, not swallowed');
  assert.ok(s.desired > 0, 'and we know orders were wanted');
  assert.equal(s.stalls, 1);
});

test('the log line shouts about rejections instead of looking idle', async () => {
  const r = new Runner({ env: env(), client: rejectingClient(), logger: quiet });
  const s = await r.tick();

  const line = r.format(s);
  assert.match(line, /REJECTED/, `a stalled tick must not read as healthy: ${line}`);
  assert.match(line, /stall 1\//);
});

test('a healthy converged tick does not mention rejections', async () => {
  const client = rejectingClient();
  client.submitOrder = async (o) => ({ id: 'ok', ...o });
  const r = new Runner({ env: env(), client, logger: quiet });

  const first = await r.tick();
  assert.ok(first.submitted > 0);
  assert.equal(first.rejected, 0);
  assert.doesNotMatch(r.format(first), /REJECTED/);
});

// ---- halting --------------------------------------------------------------

test('the loop halts after STALL_LIMIT consecutive all-rejected ticks', async () => {
  const client = rejectingClient();
  const r = new Runner({ env: env(), client, logger: quiet });

  const out = await r.start({ maxTicks: 20 });

  assert.equal(out.halted, HALT.STALLED);
  assert.equal(out.ticks, STALL_LIMIT, `should stop at ${STALL_LIMIT}, not grind on`);
});

test('the halt names the exchange reason so the cause is obvious', async () => {
  const r = new Runner({ env: env(), client: rejectingClient(), logger: quiet });

  await r.tick();
  await r.tick();
  const s = await r.tick();

  assert.equal(s.halted, HALT.STALLED);
  assert.ok(s.reasons.some((x) => /minimal amount of order/.test(x)));
});

test('one good tick resets the stall counter', async () => {
  const client = rejectingClient();
  let fail = true;
  client.submitOrder = async (o) => {
    if (fail) throw new Error('cost basis must be >= minimal amount of order 10');
    return { id: 'ok', ...o };
  };
  const r = new Runner({ env: env(), client, logger: quiet });

  await r.tick();
  await r.tick();
  assert.equal(r.stalls, 2);

  fail = false;
  await r.tick();
  assert.equal(r.stalls, 0, 'a transient rejection must not accumulate toward a halt');
});

test('rejections reach the dashboard snapshot', async () => {
  const r = new Runner({ env: env(), client: rejectingClient(), logger: quiet });
  await r.tick();

  const snap = r.snapshot();
  assert.ok(snap.rejections.length > 0);
  assert.match(snap.rejections[0].reason, /minimal amount of order/);
  assert.equal(snap.status.stalls, 1);
  assert.equal(snap.status.stallLimit, STALL_LIMIT);
});

// ---- probe parser ---------------------------------------------------------

test('the floor is parsed out of Alpaca rejection text', () => {
  assert.equal(parseNotionalFloor('cost basis must be >= minimal amount of order 10'), 10);
  assert.equal(parseNotionalFloor('minimal amount of order 25.5'), 25.5);
});

test('unrelated errors yield no floor rather than a wrong one', () => {
  assert.equal(parseNotionalFloor('insufficient buying power'), null);
  assert.equal(parseNotionalFloor('client_order_id must be unique'), null);
  assert.equal(parseNotionalFloor(undefined), null);
});
