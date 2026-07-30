/* Apex Trader — bot entry point.

   Currently runs a dry-run: it loads and validates the environment, builds the
   grid, and prints the levels it would rest orders at. The live trading loop is
   gated behind the unimplemented GridEngine.reconcile / onFill methods. */

import { loadEnv, EnvError } from './utils/env.js';
import { gridConfigFromEnv, GridConfigError } from './grid/config.js';
import { GridEngine, isOutOfBand } from './grid/engine.js';

function fmt(n, digits = 2) {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function printGrid(engine, cfg) {
  const mid = Math.sqrt(cfg.lowerBound * cfg.upperBound);
  const plan = engine.plan(mid);

  console.log(`\n  ${cfg.symbol}  ·  ${cfg.levels} levels  ·  ${cfg.spacing} spacing`);
  console.log(`  band $${fmt(cfg.lowerBound)} – $${fmt(cfg.upperBound)}`);
  console.log(`  ${fmt(cfg.orderSize, 6)} per level  ·  worst-case notional $${fmt(cfg.maxNotional)}\n`);

  const shown = plan.length ? plan : engine.levels;
  for (const lvl of [...shown].reverse()) {
    const side = lvl.side ? lvl.side.toUpperCase().padEnd(4) : ' --  ';
    const marker = lvl.side === null ? '  <- price' : '';
    console.log(`   ${String(lvl.index).padStart(3)}  ${side}  $${fmt(lvl.price)}${marker}`);
  }
  console.log('');
}

async function main() {
  const env = loadEnv();
  const cfg = gridConfigFromEnv(env);

  console.log(`\n▲ Apex Trader 2.0  ·  mode=${env.tradingMode}  ·  ${env.alpaca.baseUrl}`);

  const engine = new GridEngine({ config: cfg, client: null });
  printGrid(engine, cfg);

  const mid = Math.sqrt(cfg.lowerBound * cfg.upperBound);
  if (isOutOfBand(cfg, mid)) {
    console.warn('  ⚠️  reference price is outside the configured band — grid would idle.\n');
  }

  console.log('  Dry run only. Implement GridEngine.reconcile() and onFill()');
  console.log('  in src/grid/engine.js to enable live trading.\n');
}

main().catch((err) => {
  if (err instanceof EnvError || err instanceof GridConfigError) {
    // Configuration problems are user errors — show the message, not a stack.
    console.error(`\n✖ ${err.name}: ${err.message}\n`);
    process.exit(1);
  }
  console.error(err);
  process.exit(1);
});
