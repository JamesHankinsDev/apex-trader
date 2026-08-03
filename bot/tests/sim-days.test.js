/* The simulated exchange must model day boundaries.

   SimBroker used to report `last_equity` as a constant startingEquity. Alpaca
   reports the PRIOR SESSION'S CLOSE, and the daily loss stop is
   `equity - last_equity`. Pinned, that expression is total P&L since the run
   began — so the backtest was measuring a stop the production bot does not
   have, and no per-day rule could be tested at all. */

import test from 'node:test';
import assert from 'node:assert/strict';

import { SimBroker } from '../backtest/broker.js';

/** Hourly bars across `days`, flat unless `closes` says otherwise. */
function bars(days, closes = {}) {
  const out = [];
  for (let d = 0; d < days; d++) {
    for (let h = 0; h < 24; h++) {
      const day = String(d + 1).padStart(2, '0');
      const hour = String(h).padStart(2, '0');
      const c = closes[`${d}:${h}`] ?? closes[String(d)] ?? 100;
      out.push({ t: `2024-05-${day}T${hour}:00:00Z`, o: c, h: c, l: c, c, v: 1 });
    }
  }
  return out;
}

const brokerOver = (series, cash = 1000) =>
  new SimBroker({ bars: series, symbol: 'BTC/USD', startingCash: cash, feeRate: 0 });

test('last_equity starts at the opening balance', async () => {
  const b = brokerOver(bars(2));
  const account = await b.getAccount();
  assert.equal(Number(account.last_equity), 1000);
});

test('last_equity holds steady within a session', async () => {
  const b = brokerOver(bars(1));
  b.advance();
  b.advance();
  b.advance();

  assert.equal(Number((await b.getAccount()).last_equity), 1000);
  assert.equal(b.day, '2024-05-01');
});

test('last_equity rolls to the prior session close at a day boundary', async () => {
  // Day 1 at 100, day 2 at 80: a position marked across the boundary.
  const b = brokerOver(bars(2, { 0: 100, 1: 80 }));
  b.cash = 0;
  b.position = 10; // $1000 at 100, $800 at 80

  // Walk to the last bar of day 1.
  while (b.day !== '2024-05-01' || b.bars[b.index + 1]?.t.startsWith('2024-05-01')) {
    if (!b.advance()) break;
  }
  const beforeRoll = b.equity();

  b.advance(); // first bar of day 2

  assert.equal(b.day, '2024-05-02');
  assert.equal(
    Number((await b.getAccount()).last_equity),
    beforeRoll,
    'last_equity must be the PRIOR session close, not the current mark',
  );
});

test('dailyPnl is a per-day number, not total P&L since the run began', async () => {
  const b = brokerOver(bars(3, { 0: 100, 1: 90, 2: 81 }));
  b.cash = 0;
  b.position = 10;

  while (b.advance()) { /* run to the end */ }

  const account = await b.getAccount();
  const dailyPnl = Number(account.equity) - Number(account.last_equity);
  const totalPnl = Number(account.equity) - 1000;

  assert.ok(
    Math.abs(dailyPnl) < Math.abs(totalPnl),
    `a per-day move (${dailyPnl}) must be smaller than the whole decline (${totalPnl})`,
  );
});

test('a slow grind never trips a per-day stop — the gap the drawdown stop fills', async () => {
  // -3% a day for ten days: a quarter of the account, no single day near 5%.
  const closes = {};
  let price = 100;
  for (let d = 0; d < 10; d++) { closes[String(d)] = price; price *= 0.97; }

  const b = brokerOver(bars(10, closes));
  b.cash = 0;
  b.position = 10;

  let worstDaily = 0;
  while (b.advance()) {
    const a = await b.getAccount();
    const pnlPct = (Number(a.equity) - Number(a.last_equity)) / Number(a.last_equity);
    worstDaily = Math.min(worstDaily, pnlPct);
  }

  const totalDecline = (b.equity() - 1000) / 1000;

  assert.ok(worstDaily > -0.05, `worst day ${(worstDaily * 100).toFixed(2)}% never reaches a 5% stop`);
  assert.ok(totalDecline < -0.20, `yet the account is down ${(totalDecline * 100).toFixed(1)}%`);
});
