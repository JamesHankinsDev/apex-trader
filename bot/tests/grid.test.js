import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeGridConfig,
  assertWithinBuyingPower,
  resolveRiskLimits,
  GridConfigError,
} from '../src/grid/config.js';
import { calculateLevels, assignSides, isOutOfBand } from '../src/grid/engine.js';

const base = {
  symbol: 'BTC/USD',
  lowerBound: 50000,
  upperBound: 100000,
  levels: 6,
  orderSize: 0.001,
};

test('arithmetic spacing produces equal gaps', () => {
  const cfg = normalizeGridConfig({ ...base, spacing: 'arithmetic' });
  const levels = calculateLevels(cfg);

  assert.equal(levels.length, 6);
  assert.equal(levels[0].price, 50000);
  assert.equal(levels[5].price, 100000);

  const gaps = levels.slice(1).map((l, i) => l.price - levels[i].price);
  for (const gap of gaps) assert.ok(Math.abs(gap - 10000) < 1e-6, `gap ${gap} != 10000`);
});

test('geometric spacing produces equal ratios', () => {
  const cfg = normalizeGridConfig({ ...base, spacing: 'geometric' });
  const levels = calculateLevels(cfg);

  assert.equal(levels[0].price, 50000);
  assert.equal(levels[5].price, 100000);

  const ratios = levels.slice(1).map((l, i) => l.price / levels[i].price);
  const expected = Math.pow(2, 1 / 5);
  for (const r of ratios) assert.ok(Math.abs(r - expected) < 1e-9, `ratio ${r} != ${expected}`);
});

test('levels are strictly ascending', () => {
  for (const spacing of ['arithmetic', 'geometric']) {
    const levels = calculateLevels(normalizeGridConfig({ ...base, spacing, levels: 50 }));
    for (let i = 1; i < levels.length; i++) {
      assert.ok(levels[i].price > levels[i - 1].price, `not ascending at ${i} (${spacing})`);
    }
  }
});

test('assignSides puts buys below price and sells above', () => {
  const cfg = normalizeGridConfig({ ...base, spacing: 'arithmetic' });
  const assigned = assignSides(calculateLevels(cfg), 74000);

  for (const lvl of assigned) {
    if (lvl.side === null) continue;
    if (lvl.price < 74000) assert.equal(lvl.side, 'buy', `level ${lvl.index} should be buy`);
    else assert.equal(lvl.side, 'sell', `level ${lvl.index} should be sell`);
  }

  // Exactly one level — the nearest — is left flat.
  assert.equal(assigned.filter((l) => l.side === null).length, 1);
});

test('assignSides does not mutate its input', () => {
  const levels = calculateLevels(normalizeGridConfig(base));
  assignSides(levels, 74000);
  assert.ok(levels.every((l) => l.side === null));
});

test('isOutOfBand detects price outside the grid', () => {
  const cfg = normalizeGridConfig(base);
  assert.equal(isOutOfBand(cfg, 49999), true);
  assert.equal(isOutOfBand(cfg, 100001), true);
  assert.equal(isOutOfBand(cfg, 75000), false);
});

test('config validation rejects bad input', () => {
  const bad = [
    [{ ...base, upperBound: 40000 }, 'upper below lower'],
    [{ ...base, levels: 1 }, 'too few levels'],
    [{ ...base, orderSize: 0 }, 'zero order size'],
    [{ ...base, spacing: 'logarithmic' }, 'unknown spacing'],
    [{ ...base, symbol: 'BTC' }, 'malformed symbol'],
  ];
  for (const [cfg, label] of bad) {
    assert.throws(() => normalizeGridConfig(cfg), GridConfigError, label);
  }
});

test('buying power rejects an unfundable grid', () => {
  const cfg = normalizeGridConfig(base); // notional = 0.001 * 6 * 100000 = 600
  assert.equal(cfg.maxNotional, 600);
  assert.doesNotThrow(() => assertWithinBuyingPower(cfg, 5000));
  assert.doesNotThrow(() => assertWithinBuyingPower(cfg, 600)); // exactly affordable
  assert.throws(() => assertWithinBuyingPower(cfg, 599.99), GridConfigError);
  assert.throws(() => assertWithinBuyingPower(cfg, 100), GridConfigError);
});

test('daily stop scales with equity', () => {
  const risk = { maxDailyLossPct: 0.05 };
  assert.equal(resolveRiskLimits(risk, 100).maxDailyLossUsd, -5);
  assert.equal(resolveRiskLimits(risk, 10000).maxDailyLossUsd, -500);
  // No hand-editing needed as the account grows — that's the point.
});

test('absolute daily stop acts as a floor, tighter wins', () => {
  const risk = { maxDailyLossPct: 0.05, maxDailyLossUsd: -50 };

  // 5% of 10k = -500, but the absolute -50 is tighter.
  const big = resolveRiskLimits(risk, 10000);
  assert.equal(big.maxDailyLossUsd, -50);
  assert.match(big.source, /USD/);

  // 5% of 100 = -5, which is tighter than -50.
  const small = resolveRiskLimits(risk, 100);
  assert.equal(small.maxDailyLossUsd, -5);
  assert.match(small.source, /PCT/);
});

test('resolveRiskLimits rejects bad input', () => {
  assert.throws(() => resolveRiskLimits({ maxDailyLossPct: 0.05 }, 0), GridConfigError);
  assert.throws(() => resolveRiskLimits({ maxDailyLossPct: 0 }, 100), GridConfigError);
  assert.throws(() => resolveRiskLimits({ maxDailyLossPct: 1.5 }, 100), GridConfigError);
  // A positive "loss" is almost certainly a sign error.
  assert.throws(() => resolveRiskLimits({ maxDailyLossPct: 0.05, maxDailyLossUsd: 50 }, 100), GridConfigError);
});
