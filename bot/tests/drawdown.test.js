/* The cumulative drawdown stop.

   MAX_DAILY_LOSS_PCT measures against the prior session close, so it resets
   every day and cannot see a slow grind: -3% a day for ten days costs a
   quarter of the account without ever tripping a 5% daily limit. Measured on
   the bundled datasets, BTC 2026 drew down 7.5% peak-to-trough with no single
   day worse than -3.1% — the daily stop never fired once.

   This stop measures against the equity high-water mark instead. The peak
   must survive a restart, or a bot already 19% down would rebase on the
   bottom and never fire at all. */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Runner, HALT, PEAK_PERSIST_DELTA } from '../src/runner.js';
import { resolveDrawdown, GridConfigError } from '../src/grid/config.js';

const quiet = { warn() {}, info() {}, error() {} };

/** In-memory state: a test must never write to bot/state/. */
function memState(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    writes: [],
    readAnchor: (s) => store.get(`anchor:${s}`),
    writeAnchor: (s, p) => store.set(`anchor:${s}`, p),
    readHalt: () => store.get('halt') ?? null,
    writeHalt: (reason, ctx) => store.set('halt', { reason, at: 'test', ...ctx }),
    clearHalt: () => store.delete('halt'),
    readPeakEquity: () => store.get('peak'),
    writePeakEquity(equity) {
      store.set('peak', equity);
      this.writes.push(equity);
    },
  };
}

function env({ maxDrawdownPct = 0.20, maxDailyLossPct = 1 } = {}) {
  return {
    grid: { symbol: 'BTC/USD', levels: 11, spacing: 'arithmetic' },
    ratios: {
      bandPct: 0.15, allocationPct: 0.8, anchorMode: 'on_flat',
      reanchorDrift: 0.5, resizeMode: 'on_flat', resizeThreshold: 0.1, feeRate: 0,
    },
    // Daily stop wide open by default so these tests isolate the drawdown one.
    risk: { maxDailyLossPct, maxDrawdownPct },
    runtime: { dryRun: false, pollIntervalMs: 1 },
  };
}

function fakeClient({ equity = 100, lastEquity = 100, price = 65000 } = {}) {
  return {
    getAccount: async () => ({
      equity: String(equity),
      last_equity: String(lastEquity),
      buying_power: String(equity),
      cash: String(equity),
      long_market_value: '0',
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

// ---- the pure resolver ----------------------------------------------------

test('drawdown is measured against the high-water mark, not the start', () => {
  const d = resolveDrawdown({ peakEquity: 120, equity: 90, maxDrawdownPct: 0.2 });
  assert.ok(Math.abs(d.drawdown - 0.25) < 1e-9, '90 is 25% below 120');
  assert.equal(d.breached, true);
});

test('a missing peak can only understate the drawdown, never invent one', () => {
  const d = resolveDrawdown({ peakEquity: undefined, equity: 90, maxDrawdownPct: 0.2 });
  assert.equal(d.peak, 90, 'peak clamps up to live equity');
  assert.equal(d.drawdown, 0);
  assert.equal(d.breached, false);
});

test('a stale peak below live equity is ignored', () => {
  const d = resolveDrawdown({ peakEquity: 50, equity: 90, maxDrawdownPct: 0.2 });
  assert.equal(d.peak, 90);
  assert.equal(d.breached, false);
});

test('an undefined limit disables the stop but still reports the number', () => {
  const d = resolveDrawdown({ peakEquity: 200, equity: 100, maxDrawdownPct: undefined });
  assert.ok(Math.abs(d.drawdown - 0.5) < 1e-9);
  assert.equal(d.limit, null);
  assert.equal(d.breached, false);
});

test('an out-of-range limit is rejected rather than silently clamped', () => {
  assert.throws(
    () => resolveDrawdown({ peakEquity: 100, equity: 90, maxDrawdownPct: 1.5 }),
    GridConfigError,
  );
});

// ---- the stop in the run loop ---------------------------------------------

test('the loop halts once equity falls past the limit', async () => {
  const state = memState({ peak: 100 });
  const r = new Runner({
    env: env({ maxDrawdownPct: 0.2 }),
    client: fakeClient({ equity: 79 }), // 21% below the peak
    logger: quiet,
    state,
  });

  const s = await r.tick();

  assert.equal(s.halted, HALT.DRAWDOWN);
  assert.equal(r.halted, HALT.DRAWDOWN);
  assert.ok(Math.abs(s.drawdown - 0.21) < 1e-9);
});

test('the halt is latched with the peak that caused it', async () => {
  const state = memState({ peak: 100 });
  const r = new Runner({
    env: env({ maxDrawdownPct: 0.2 }), client: fakeClient({ equity: 79 }),
    logger: quiet, state,
  });

  await r.tick();

  const latched = state.readHalt();
  assert.equal(latched.reason, HALT.DRAWDOWN);
  assert.equal(latched.peak, 100);
});

test('a drawdown inside the limit does not halt', async () => {
  const state = memState({ peak: 100 });
  const r = new Runner({
    env: env({ maxDrawdownPct: 0.2 }), client: fakeClient({ equity: 85 }),
    logger: quiet, state,
  });

  const s = await r.tick();

  assert.equal(s.halted, undefined);
  assert.ok(Math.abs(s.drawdown - 0.15) < 1e-9);
});

test('the stop is checked BEFORE any order is placed', async () => {
  const state = memState({ peak: 100 });
  const client = fakeClient({ equity: 79 });
  const submitted = [];
  client.submitOrder = async (o) => { submitted.push(o); return { id: 'x', ...o }; };

  const r = new Runner({ env: env({ maxDrawdownPct: 0.2 }), client, logger: quiet, state });
  await r.tick();

  assert.equal(submitted.length, 0, 'a breached limit must never be followed by fresh exposure');
});

test('MAX_DRAWDOWN_PCT=off disables the stop entirely', async () => {
  const state = memState({ peak: 1000 });
  // risk is replaced wholesale rather than passed through env(): a default
  // parameter treats an explicit `undefined` as absent and would hand back
  // the 20% default, quietly testing the opposite of what this claims.
  const off = { ...env(), risk: { maxDailyLossPct: 1, maxDrawdownPct: undefined } };

  const r = new Runner({
    env: off,
    // Half the peak — far past any limit — but still enough equity to fund
    // the grid, so a SizingError can't stand in for the halt we're checking.
    // lastEquity matches so the DAILY stop stays out of it too.
    client: fakeClient({ equity: 500, lastEquity: 500 }),
    logger: quiet, state,
  });

  const s = await r.tick();
  assert.equal(s.halted, undefined, '50% down and still trading, because the stop is off');
});

// ---- the high-water mark --------------------------------------------------

test('the peak is loaded from disk, so a restart cannot rebase it', () => {
  const state = memState({ peak: 250 });
  const r = new Runner({ env: env(), client: fakeClient(), logger: quiet, state });
  assert.equal(r.peakEquity, 250);
});

test('a restart mid-drawdown still halts on the persisted peak', async () => {
  // The failure this guards: peak held only in memory rebases to current
  // equity on restart, and a bot already far down never fires the stop.
  const state = memState({ peak: 100 });
  const r = new Runner({
    env: env({ maxDrawdownPct: 0.2 }), client: fakeClient({ equity: 75 }),
    logger: quiet, state,
  });

  const s = await r.tick();
  assert.equal(s.halted, HALT.DRAWDOWN);
});

test('a new high is persisted', async () => {
  const state = memState({ peak: 100 });
  const r = new Runner({ env: env(), client: fakeClient({ equity: 140 }), logger: quiet, state });

  await r.tick();

  assert.equal(r.peakEquity, 140);
  assert.equal(state.readPeakEquity(), 140);
});

test('a trivial new high is kept in memory but not written to disk', async () => {
  const state = memState({ peak: 100 });
  const r = new Runner({ env: env(), client: fakeClient({ equity: 100.01 }), logger: quiet, state });

  await r.tick();

  assert.equal(r.peakEquity, 100.01, 'tracked exactly in memory');
  assert.equal(state.writes.length, 0, `under ${PEAK_PERSIST_DELTA} — not worth a disk write`);
  assert.equal(state.readPeakEquity(), 100);
});

test('a failed peak write does not kill the tick', async () => {
  const state = memState({ peak: 100 });
  state.writePeakEquity = () => { throw new Error('disk full'); };

  const r = new Runner({ env: env(), client: fakeClient({ equity: 200 }), logger: quiet, state });
  const s = await r.tick();

  assert.equal(s.halted, undefined, 'a state write failure must not stop an unattended bot');
});
