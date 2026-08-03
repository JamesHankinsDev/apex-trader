/* Rounding dust must never read as an open position.

   The bug this guards: recordFill() rounded the fee-adjusted buy quantity to
   9dp. Rounding UP recorded fractionally more than the exchange delivered, so
   desiredOrders() scaled the exit down to the real balance and the closing
   sell came back a nano-unit short of what inventory said was held. The level
   stayed in the Map holding ~1e-9.

   That nano-unit is not a rounding curiosity. openInventory gates both
   canReanchor() and shouldResize(), so the band froze for the rest of the run
   and the level was never re-bought. Whether it triggered depended on the 10th
   decimal of orderSize x (1 - feeRate), which moves with equity — so the same
   strategy over the same prices returned +1.80% or -7.45% depending only on
   the account balance. */

import test from 'node:test';
import assert from 'node:assert/strict';

import { GridEngine, buildClientOrderId } from '../src/grid/engine.js';
import { normalizeGridConfig } from '../src/grid/config.js';
import { canReanchor } from '../src/grid/rebalance.js';

// The ETH grid that first exposed this. orderSize x (1 - 0.0015) lands just
// above a 9dp boundary, so rounding up overstates the position.
const config = normalizeGridConfig({
  symbol: 'ETH/USD',
  lowerBound: 2517.97,
  upperBound: 3776.96,
  levels: 5,
  spacing: 'geometric',
  orderSize: 0.004236213,
});

const FEE = 0.0015;
const BUY_PRICE = 3083.87;
const SELL_PRICE = 3412.87;

const noop = { warn() {}, info() {} };
const client = {
  getOrders: async () => [],
  submitOrder: async (o) => o,
  cancelOrder: async () => ({}),
};

const engineAt = (feeRate = FEE) =>
  new GridEngine({ config, client, dryRun: false, feeRate, logger: noop });

const fillAt = (levelIndex, side, qty, price) => ({
  client_order_id: buildClientOrderId('ETH/USD', levelIndex, side, 1),
  filled_qty: String(qty),
  filled_avg_price: String(price),
  status: 'filled',
});

test('a fee-adjusted buy is recorded floored, never rounded up', () => {
  const e = engineAt();
  e.recordFill(fillAt(2, 'buy', 0.004236213, BUY_PRICE));

  const delivered = 0.004236213 * (1 - FEE);
  const recorded = e.inventory.get(2).qty;

  assert.ok(
    recorded <= delivered,
    `recorded ${recorded} exceeds the ${delivered} the exchange delivered`,
  );
  assert.equal(recorded, 0.004229858);
});

test('selling the recorded balance fully closes the level', () => {
  const e = engineAt();
  e.recordFill(fillAt(2, 'buy', 0.004236213, BUY_PRICE));

  e.recordFill(fillAt(3, 'sell', e.inventory.get(2).qty, SELL_PRICE));

  assert.equal(e.inventory.size, 0);
  assert.equal(e.openInventory, 0);
});

test('a nano-unit residue does not keep the level held', () => {
  const e = engineAt();
  // The pre-fix state: inventory one nano-unit above what is sellable.
  e.inventory.set(2, { qty: 0.004229859, price: BUY_PRICE, cost: 0.004236213 * BUY_PRICE });

  e.recordFill(fillAt(3, 'sell', 0.004229858, SELL_PRICE));

  assert.equal(e.inventory.size, 0, 'dust must not keep the level marked held');
  assert.equal(e.openInventory, 0);
});

test('dust does not freeze re-anchoring', () => {
  const e = engineAt();
  e.inventory.set(2, { qty: 0.004229859, price: BUY_PRICE, cost: 0.004236213 * BUY_PRICE });
  e.recordFill(fillAt(3, 'sell', 0.004229858, SELL_PRICE));

  const gate = canReanchor({ wantsReanchor: true, openInventory: e.openInventory });
  assert.equal(gate.reanchor, true, gate.reason);
});

test('a dust-closed level is free to be bought again', () => {
  const e = engineAt();
  e.inventory.set(2, { qty: 0.004229859, price: BUY_PRICE, cost: 0.004236213 * BUY_PRICE });
  e.recordFill(fillAt(3, 'sell', 0.004229858, SELL_PRICE));

  // Price above level 2 means level 2 should rest a buy again.
  const book = e.desiredOrders(3300);
  assert.ok(
    book.some((o) => o.levelIndex === 2 && o.side === 'buy'),
    'level 2 should be re-armed once closed',
  );
});

test('closing on dust releases the whole cost basis', () => {
  const e = engineAt();
  const cost = 0.004236213 * BUY_PRICE;
  e.inventory.set(2, { qty: 0.004229859, price: BUY_PRICE, cost });

  e.recordFill(fillAt(3, 'sell', 0.004229858, SELL_PRICE));

  const net = 0.004229858 * SELL_PRICE * (1 - FEE);
  // Stranding the residual cost would drift realized P&L low by that share.
  assert.ok(
    Math.abs(e.realizedPnl - (net - cost)) < 1e-9,
    `realized ${e.realizedPnl} should equal ${net - cost}`,
  );
});

test('a genuine partial exit still leaves the remainder held', () => {
  const e = engineAt();
  e.recordFill(fillAt(2, 'buy', 0.004236213, BUY_PRICE));
  const held = e.inventory.get(2).qty;

  e.recordFill(fillAt(3, 'sell', held / 2, SELL_PRICE));

  assert.equal(e.inventory.size, 1, 'half a position is not dust');
  assert.ok(Math.abs(e.inventory.get(2).qty - held / 2) < 1e-9);
  assert.ok(e.openInventory > 0);
});
