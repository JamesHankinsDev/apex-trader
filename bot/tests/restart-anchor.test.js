import test from 'node:test';
import assert from 'node:assert/strict';

import { Runner } from '../src/runner.js';
import { buildClientOrderId } from '../src/grid/engine.js';

/* The on_flat brake must survive a restart.
 *
 * `on_flat` exists to stop the band re-centring while inventory is open — a
 * held position needs its exit levels to keep existing. resolveAnchor() and
 * canReanchor() both enforce that correctly.
 *
 * But on the FIRST tick of a new process there is no engine yet, and the
 * engine is what knows what we hold. buildEngine() therefore used to derive
 * the anchor with openInventory = 0 and hydrate() ran afterwards — so a
 * restart looked flat to the one decision that must never be told that, and
 * the band re-centred out from under an open position.
 *
 * The exchange knows. readLiveState() has already fetched the position by the
 * time buildEngine() runs, so the fallback is the live balance, not a zero. */

const quiet = { warn() {}, info() {}, error() {} };

function memState(anchor) {
  const store = new Map();
  if (anchor) store.set('anchor:BTC/USD', anchor);
  return {
    readAnchor: (s) => store.get(`anchor:${s}`),
    writeAnchor: (s, p) => store.set(`anchor:${s}`, p),
    readHalt: () => null,
    writeHalt: () => {},
    clearHalt: () => {},
    readPeakEquity: () => undefined,
    writePeakEquity: () => {},
  };
}

function env() {
  return {
    grid: { symbol: 'BTC/USD', levels: 6, spacing: 'geometric' },
    ratios: {
      bandPct: 0.04,
      allocationPct: 0.8,
      anchorMode: 'on_flat',
      reanchorDrift: 0.5,
      resizeMode: 'on_flat',
      resizeThreshold: 0.1,
      minOrderNotional: 0,
      feeRate: 0,
    },
    risk: { maxDailyLossPct: 1 },
    runtime: { dryRun: true, pollIntervalMs: 1 },
  };
}

/** An account holding BTC bought by the grid, exactly as a restart finds it. */
function clientHolding({ price, qty = 0.002, entry = 64660 }) {
  const filledBuy = {
    id: 'ord-1',
    status: 'filled',
    symbol: 'BTC/USD',
    side: 'buy',
    qty: String(qty),
    filled_qty: String(qty),
    filled_avg_price: String(entry),
    filled_at: '2026-07-30T18:36:46Z',
    client_order_id: buildClientOrderId('BTC/USD', 3, 'buy', 'x1'),
  };

  return {
    getAccount: async () => ({ equity: '100', last_equity: '100', buying_power: '100', cash: '89', long_market_value: '11' }),
    getLatestCryptoQuote: async () => ({ quotes: { 'BTC/USD': { bp: price - 5, ap: price + 5 } } }),
    getAsset: async () => ({ min_order_size: '0.000015565', tradable: true }),
    getPositions: async () => [{ symbol: 'BTCUSD', qty: String(qty), qty_available: String(qty) }],
    getOrders: async ({ status }) => (status === 'open' ? [] : [filledBuy]),
    submitOrder: async (o) => ({ id: 'srv-1', ...o }),
    cancelOrder: async () => {},
  };
}

test('a restart does NOT re-anchor while the exchange says we are holding', async () => {
  const storedAnchor = 63861.79;
  // Far enough past the 2% threshold (bandPct 0.04 x reanchorDrift 0.5) that
  // a grid believing itself flat would certainly re-centre.
  const price = storedAnchor * 1.06;

  const runner = new Runner({
    env: env(),
    client: clientHolding({ price }),
    logger: quiet,
    state: memState(storedAnchor),
  });

  await runner.tick();

  assert.ok(runner.engine.openInventory > 0, 'precondition: the restart hydrated a real position');
  assert.equal(
    runner.engine.config.lowerBound.toFixed(2),
    (storedAnchor * 0.96).toFixed(2),
    'band must still be built on the STORED anchor — re-centring strands the held lot with no exit',
  );
});

test('a restart with a genuinely flat account still re-anchors', async () => {
  const storedAnchor = 63861.79;
  const price = storedAnchor * 1.06;

  const flat = clientHolding({ price });
  flat.getPositions = async () => [];
  flat.getOrders = async () => [];

  const runner = new Runner({
    env: env(),
    client: flat,
    logger: quiet,
    state: memState(storedAnchor),
  });

  await runner.tick();

  assert.equal(runner.engine.openInventory, 0, 'precondition: flat');
  assert.equal(
    runner.engine.config.lowerBound.toFixed(2),
    (price * 0.96).toFixed(2),
    'nothing is held, so the band is free to follow price',
  );
});
