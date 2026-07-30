/* Apex Trader — backtest driver.

   Drives the REAL Runner (and therefore the real GridEngine, sizing, rebalance
   and stop logic) against a simulated exchange, one tick per bar.

   Run:
     npm run bot:backtest
     npm run bot:backtest -- --months 6 --timeframe 1H --band 0.05 --levels 7
     npm run bot:backtest -- --sweep

   What it can and cannot prove: it replays real PRICES, so it exercises the
   grid's logic over thousands of round trips. It cannot discover new exchange
   BEHAVIOURS — the broker only knows the rules we have already learned. */

import { loadAlpacaEnv, EnvError } from '../src/utils/env.js';
import { createClient, AlpacaError } from '../src/api/alpaca.js';
import { Runner } from '../src/runner.js';
import { loadBars, describeBars } from './data.js';
import { SimBroker } from './broker.js';

const silent = { warn() {}, info() {}, error() {} };

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}

const money = (n) => (n < 0 ? '-' : '+') + '$' + Math.abs(n).toFixed(2);
const pct = (n) => (n < 0 ? '' : '+') + n.toFixed(2) + '%';

/** Env shaped the way Runner expects, without touching process.env. */
function backtestEnv({ symbol, levels, spacing, band, allocation, anchorMode, stopPct, minNotional }) {
  return {
    tradingMode: 'paper',
    grid: { symbol, levels, spacing },
    ratios: {
      bandPct: band,
      allocationPct: allocation,
      anchorMode,
      reanchorDrift: 0.5,
      resizeMode: 'on_flat',
      resizeThreshold: 0.1,
      minOrderNotional: minNotional,
    },
    risk: { maxDailyLossPct: 1, stopPct }, // daily stop off: it is a per-DAY rule
    runtime: { dryRun: false, pollIntervalMs: 0 },
  };
}

async function runOne({ bars, config, startingCash, feeRate }) {
  const broker = new SimBroker({
    bars,
    symbol: config.symbol,
    startingCash,
    feeRate,
    minNotional: config.minNotional,
  });

  // In-memory anchor store: a backtest must neither read nor write the live
  // bot/state/anchor.json. It previously did both, via the shared Runner.
  const anchors = new Map();
  const state = {
    readAnchor: (sym) => anchors.get(sym),
    writeAnchor: (sym, price) => anchors.set(sym, price),
  };

  const runner = new Runner({ env: backtestEnv(config), client: broker, logger: silent, state });

  let ticks = 0;
  let halted = null;

  while (broker.advance()) {
    try {
      const s = await runner.tick();
      ticks++;
      if (s.halted) { halted = s.halted; break; }
    } catch (err) {
      // A config that cannot produce a valid grid is a result, not a crash.
      halted = `error: ${err.message}`;
      break;
    }
  }

  // Mark to the final bar and settle.
  const finalEquity = broker.equity();
  const curve = broker.equityCurve;
  let peak = -Infinity;
  let maxDd = 0;
  for (const p of curve) {
    peak = Math.max(peak, p.equity);
    maxDd = Math.max(maxDd, (peak - p.equity) / peak);
  }

  const buys = broker.filled.filter((f) => f.side === 'buy').length;
  const sells = broker.filled.filter((f) => f.side === 'sell').length;
  const barsHolding = curve.filter((_, i) => i > 0).length
    ? broker.filled.length ? null : 0
    : 0;

  return {
    config,
    ticks,
    halted,
    startingEquity: startingCash,
    finalEquity,
    pnl: finalEquity - startingCash,
    pnlPct: ((finalEquity / startingCash) - 1) * 100,
    buys,
    sells,
    roundTrips: Math.min(buys, sells),
    feesQuote: broker.feesPaidQuote,
    feesBase: broker.feesPaidBase,
    maxDrawdownPct: maxDd * 100,
    rejections: broker.rejections.length,
    rejectionReasons: [...new Set(broker.rejections.map((r) => r.reason))],
    endPosition: broker.position,
    engineRealized: runner.engine?.realizedPnl ?? 0,
    barsHolding,
  };
}

function report(r, benchmark) {
  const c = r.config;
  console.log(`\n  ${'─'.repeat(64)}`);
  console.log(`  band ±${(c.band * 100).toFixed(1)}%  ·  ${c.levels} levels  ·  ${c.anchorMode}  ·  alloc ${(c.allocation * 100).toFixed(0)}%`);
  console.log(`  ${'─'.repeat(64)}`);
  console.log(`    ticks simulated     ${r.ticks}`);
  if (r.halted) console.log(`    HALTED              ${r.halted}`);
  console.log(`    fills               ${r.buys} buy / ${r.sells} sell  ->  ${r.roundTrips} round trip(s)`);
  console.log(`    fees paid           ${r.feesBase.toFixed(8)} base + $${r.feesQuote.toFixed(2)} quote`);
  console.log(`    max drawdown        ${r.maxDrawdownPct.toFixed(2)}%`);
  if (r.rejections) {
    console.log(`    rejections          ${r.rejections}`);
    for (const reason of r.rejectionReasons.slice(0, 3)) console.log(`                        ${reason}`);
  }
  console.log(`    ending position     ${r.endPosition.toFixed(9)}`);
  console.log('');
  console.log(`    equity              $${r.startingEquity.toFixed(2)}  ->  $${r.finalEquity.toFixed(2)}   ${money(r.pnl)}  ${pct(r.pnlPct)}`);
  if (benchmark !== undefined) {
    console.log(`    buy & hold          ${pct(benchmark)}   <- same period, no trading`);
    console.log(`    vs buy & hold       ${pct(r.pnlPct - benchmark)}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { alpaca } = loadAlpacaEnv();
  const client = createClient(alpaca);

  const symbol = args.symbol ?? process.env.GRID_SYMBOL ?? 'BTC/USD';
  const months = Number(args.months ?? 6);
  const timeframe = args.timeframe ?? '1H';
  const startingCash = Number(args.cash ?? 100);
  const feeRate = Number(args.fee ?? 0.0015);

  // --start/--end pin an explicit window so the same config can be tested
  // across different market regimes, not just the most recent one.
  const end = args.end ? new Date(args.end) : new Date(Date.now() - 24 * 3600 * 1000);
  const start = args.start
    ? new Date(args.start)
    : new Date(end.getTime() - months * 30 * 24 * 3600 * 1000);

  const bars = await loadBars({
    client,
    symbol,
    timeframe,
    start: start.toISOString(),
    end: end.toISOString(),
    refresh: Boolean(args.refresh),
  });

  const d = describeBars(bars);
  console.log(`\n▲ Backtest  ·  ${symbol}  ·  ${timeframe}  ·  ${d.count} bars`);
  console.log(`  ${d.from.slice(0, 10)} -> ${d.to.slice(0, 10)}`);
  console.log(`  price $${d.first.toFixed(0)} -> $${d.last.toFixed(0)}  (${pct(d.changePct)})   range $${d.low.toFixed(0)}–$${d.high.toFixed(0)}  (${d.rangePct.toFixed(1)}% wide)`);
  console.log(`  starting cash $${startingCash.toFixed(2)}  ·  fee ${(feeRate * 100).toFixed(2)}%/side`);

  const base = {
    symbol,
    spacing: args.spacing ?? 'geometric',
    allocation: Number(args.allocation ?? 0.8),
    anchorMode: args.anchor ?? 'on_flat',
    stopPct: args.stop === undefined ? undefined : Number(args.stop),
    minNotional: Number(args.minNotional ?? 10),
  };

  const combos = args.sweep
    ? [
        { band: 0.05, levels: 7 },
        { band: 0.075, levels: 6 },
        { band: 0.10, levels: 6 },
        { band: 0.15, levels: 5 },
        { band: 0.20, levels: 5 },
      ]
    : [{ band: Number(args.band ?? 0.05), levels: Number(args.levels ?? 7) }];

  const results = [];
  for (const combo of combos) {
    const r = await runOne({ bars, config: { ...base, ...combo }, startingCash, feeRate });
    results.push(r);
    report(r, d.changePct);
  }

  if (results.length > 1) {
    console.log(`\n  ${'═'.repeat(64)}`);
    console.log('  SUMMARY (best first)');
    console.log(`  ${'═'.repeat(64)}`);
    const fullRun = Math.max(...results.map((r) => r.ticks));
    console.log('    band    levels  trips   P&L        vs hold    max DD    coverage');
    for (const r of [...results].sort((a, b) => b.pnlPct - a.pnlPct)) {
      const coverage = (r.ticks / fullRun) * 100;
      console.log(
        '    ±' + String((r.config.band * 100).toFixed(1) + '%').padEnd(7),
        String(r.config.levels).padStart(4), '  ',
        String(r.roundTrips).padStart(5), '  ',
        pct(r.pnlPct).padStart(8), '  ',
        pct(r.pnlPct - d.changePct).padStart(8), '  ',
        (r.maxDrawdownPct.toFixed(2) + '%').padStart(7), '  ',
        (coverage >= 99.9 ? 'full' : coverage.toFixed(0) + '%  HALTED').padStart(12),
      );
    }

    const partial = results.filter((r) => r.ticks < fullRun * 0.999);
    if (partial.length) {
      console.log('');
      console.log('  ⚠ A halted run only covers part of the period, so its P&L is NOT');
      console.log('    comparable with a full one. Read those rows as "this config could');
      console.log('    not survive the period", not as a return.');
    }

    console.log('');
    console.log('  Past results do not predict future ones. This replays one specific');
    console.log('  period; a different six months can invert the ranking entirely.');
  }
  console.log('');
}

main().catch((err) => {
  if (err instanceof EnvError) { console.error(`\n✖ ${err.name}: ${err.message}\n`); process.exit(1); }
  if (err instanceof AlpacaError) { console.error(`\n✖ Alpaca (${err.status}) on ${err.endpoint}: ${err.message}\n`); process.exit(1); }
  console.error(err);
  process.exit(1);
});
