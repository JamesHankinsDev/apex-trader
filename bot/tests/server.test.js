import test from 'node:test';
import assert from 'node:assert/strict';

import { createApiServer } from '../src/api/server.js';

const quiet = { warn() {}, info() {}, error() {} };

function fakeRunner(overrides = {}) {
  return {
    running: true,
    halted: null,
    dryRun: true,
    ticks: 7,
    startedAt: Date.now() - 1000,
    snapshot: () => ({
      status: { running: true, ticks: 7 },
      account: { equity: 100, dailyPnl: 0, lossLimit: -5 },
      market: { price: 64000, idle: false },
      grid: { lowerBound: 55000, upperBound: 75000, levels: 11 },
      position: { inventory: 0, realizedPnl: 0, roundTrips: 0, heldLevels: [] },
      book: [],
      ladder: [],
      fills: [],
    }),
    ...overrides,
  };
}

/** Boot on an ephemeral port and return a fetch bound to it. */
async function boot(opts = {}) {
  const api = createApiServer({ runner: fakeRunner(), port: 0, logger: quiet, ...opts });
  await api.start();
  const { port, address } = api.server.address();
  const base = `http://${address === '::' || address === '0.0.0.0' ? '127.0.0.1' : address}:${port}`;
  return {
    api,
    base,
    get: (path, init) => fetch(`${base}${path}`, init),
    close: () => api.stop(),
  };
}

test('health and state serve without a token when unset', async () => {
  const t = await boot();
  try {
    const health = await t.get('/health');
    assert.equal(health.status, 200);
    assert.equal((await health.json()).ok, true);

    const state = await t.get('/state');
    assert.equal(state.status, 200);
    assert.equal((await state.json()).account.equity, 100);
  } finally {
    await t.close();
  }
});

test('without a token the server binds localhost only', async () => {
  // Even when asked to bind everywhere, it must refuse.
  const t = await boot({ host: '0.0.0.0' });
  try {
    assert.equal(t.api.server.address().address, '127.0.0.1');
  } finally {
    await t.close();
  }
});

test('with a token, protected routes reject unauthenticated calls', async () => {
  const t = await boot({ token: 'sekrit', host: '127.0.0.1' });
  try {
    assert.equal((await t.get('/state')).status, 401);
    assert.equal((await t.get('/grid')).status, 401);
    assert.equal((await t.get('/state', { headers: { authorization: 'Bearer wrong' } })).status, 401);

    const ok = await t.get('/state', { headers: { authorization: 'Bearer sekrit' } });
    assert.equal(ok.status, 200);
  } finally {
    await t.close();
  }
});

test('health stays open so platform probes work without the token', async () => {
  const t = await boot({ token: 'sekrit', host: '127.0.0.1' });
  try {
    assert.equal((await t.get('/health')).status, 200);
  } finally {
    await t.close();
  }
});

test('the API is read-only — writes are refused', async () => {
  const t = await boot();
  try {
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
      const res = await t.get('/state', { method });
      assert.equal(res.status, 405, `${method} should be rejected`);
    }
  } finally {
    await t.close();
  }
});

test('there is no route that can place or cancel an order', async () => {
  const t = await boot();
  try {
    for (const path of ['/orders', '/submit', '/cancel', '/liquidate', '/halt']) {
      assert.equal((await t.get(path)).status, 404, `${path} must not exist`);
    }
  } finally {
    await t.close();
  }
});

test('unknown routes list what does exist', async () => {
  const t = await boot();
  try {
    const res = await t.get('/nope');
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.ok(body.routes.includes('/state'));
  } finally {
    await t.close();
  }
});

test('a snapshot that throws does not leak internals', async () => {
  const t = await boot({
    runner: fakeRunner({ snapshot: () => { throw new Error('boom: secret detail'); } }),
  });
  try {
    const res = await t.get('/state');
    assert.equal(res.status, 500);
    assert.equal((await res.json()).error, 'Internal error');
  } finally {
    await t.close();
  }
});

test('CORS preflight is answered', async () => {
  const t = await boot({ corsOrigin: 'http://localhost:3000' });
  try {
    const res = await t.get('/state', { method: 'OPTIONS' });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:3000');
  } finally {
    await t.close();
  }
});
