/* Apex Trader — one-shot report.

   Runs a SINGLE tick and prints what the grid looks like, then exits. Use
   `npm run bot:loop` to actually trade; this is for eyeballing a config.

   It delegates to the same Runner the loop uses rather than reimplementing
   the derivation. It used to duplicate it, drifted, and ended up comparing
   worst-case notional against RAW buying power — so it crash-looped on
   Railway with "exceeds available capital" while the loop was fine. One
   code path now, so a fix to the loop can't leave this behind. */

import { loadEnv, EnvError } from './utils/env.js';
import { createClient, AlpacaError } from './api/alpaca.js';
import { GridConfigError } from './grid/config.js';
import { SizingError } from './grid/sizing.js';
import { Runner } from './runner.js';
import { isOutOfBand } from './grid/engine.js';
import { readHalt } from './utils/state.js';

function fmt(n, digits = 2) {
  return Number(n).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

const quiet = { warn() {}, info() {}, error() {} };

async function main() {
  const env = loadEnv();
  const client = createClient(env.alpaca);
  const { symbol } = env.grid;

  console.log(`\n▲ Apex Trader 2.0  ·  mode=${env.tradingMode}  ·  ${env.alpaca.baseUrl}`);

  const latched = readHalt();
  if (latched) {
    console.log(`\n  ⛔ halt latched ${latched.at}: ${latched.reason}`);
    console.log('     The loop would refuse to trade. Clear with: npm run bot:resume\n');
  }

  // Always dry-run: a report must never place an order.
  const runner = new Runner({
    env: { ...env, runtime: { ...env.runtime, dryRun: true } },
    client,
    logger: quiet,
  });

  const live = await runner.readLiveState();
  console.log(`  equity $${fmt(live.equity)}  ·  cash $${fmt(live.cash)}  ·  ${symbol} $${fmt(live.price)}`);
  console.log(`  capital available to the grid: $${fmt(live.buyingPower)}` +
    (live.reserved ? `  (incl. $${fmt(live.reserved)} reserved by our own resting buys)` : ''));

  const { config: cfg, derivation: d } = await runner.buildEngine(live);
  await runner.engine.hydrate();

  console.log('');
  if (d) {
    console.log(`  anchor    $${fmt(d.anchor)}  (${d.anchorReason})`);
    console.log(`  band      ±${(d.bandPct * 100).toFixed(1)}%  ->  $${fmt(cfg.lowerBound)} – $${fmt(cfg.upperBound)}`);
    console.log(`  allocate  ${(d.allocationPct * 100).toFixed(0)}% of equity = $${fmt(d.deployable)}`);
  } else {
    console.log(`  band      $${fmt(cfg.lowerBound)} – $${fmt(cfg.upperBound)} (pinned)`);
  }
  console.log(`  size      ${cfg.orderSize.toFixed(9)} ${symbol.split('/')[0]}/level = $${fmt(cfg.orderSize * live.price)} each`);
  console.log(`  worst     $${fmt(cfg.maxNotional)} of $${fmt(live.buyingPower + runner.engine.heldCost)} capital`);
  console.log(`\n  ${cfg.levels} levels · ${cfg.spacing} spacing\n`);

  const held = runner.engine.inventory;
  const book = new Map(runner.engine.desiredOrders(live.price).map((o) => [o.levelIndex, o]));
  for (const lvl of [...runner.engine.levels].reverse()) {
    const o = book.get(lvl.index);
    const side = o ? o.side.toUpperCase().padEnd(4) : (held.has(lvl.index) ? 'HELD' : ' -- ');
    console.log(`   ${String(lvl.index).padStart(3)}  ${side}  $${fmt(lvl.price)}`);
  }

  if (isOutOfBand(cfg, live.price)) {
    console.warn('\n  ⚠️  price is outside the band — the grid idles.');
  }
  if (runner.engine.openInventory > 0) {
    console.log(`\n  holding ${runner.engine.openInventory} across ${held.size} level(s)`);
  }

  console.log('\n  Report only — nothing was sent. Use `npm run bot:loop` to trade.\n');
}

main().catch((err) => {
  if (err instanceof EnvError || err instanceof GridConfigError || err instanceof SizingError) {
    console.error(`\n✖ ${err.name}: ${err.message}\n`);
    process.exit(1);
  }
  if (err instanceof AlpacaError) {
    console.error(`\n✖ Alpaca (${err.status ?? 'no response'}) on ${err.endpoint}: ${err.message}\n`);
    process.exit(1);
  }
  console.error(err);
  process.exit(1);
});
