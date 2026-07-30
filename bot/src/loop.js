/* Apex Trader — continuous run loop entry point.

   Run: npm run bot:loop

   DRY_RUN defaults to true, so this is safe to leave running while you watch
   what it would do. Ctrl-C cancels resting orders before exiting: with the
   bot stopped nothing would place counter-orders against a fill, so leaving
   the book resting would let a buy fill with no exit behind it. */

import { loadEnv, EnvError } from './utils/env.js';
import { createClient, AlpacaError } from './api/alpaca.js';
import { GridConfigError } from './grid/config.js';
import { SizingError } from './grid/sizing.js';
import { Runner, HALT } from './runner.js';

const HALT_MESSAGE = {
  [HALT.DAILY_LOSS]: 'daily loss limit reached — resting orders cancelled, position kept',
  [HALT.STOP_PRICE]: 'price stop hit — inventory liquidated',
  [HALT.MANUAL]: 'stopped by request',
};

async function main() {
  const env = loadEnv();
  const client = createClient(env.alpaca);
  const runner = new Runner({ env, client });

  console.log(`\n▲ Apex Trader 2.0  ·  mode=${env.tradingMode}  ·  ${env.grid.symbol}`);
  console.log(`  poll every ${env.runtime.pollIntervalMs}ms  ·  anchor=${env.ratios.anchorMode}  ·  resize=${env.ratios.resizeMode}`);
  console.log(`  daily stop ${(env.risk.maxDailyLossPct * 100).toFixed(1)}% of equity` +
    (env.risk.stopPct ? `  ·  price stop ${(env.risk.stopPct * 100).toFixed(1)}% below band` : '  ·  no price stop'));

  if (env.runtime.dryRun) {
    console.log('\n  DRY_RUN is ON — planning only, nothing will be sent.');
    console.log('  Set DRY_RUN=false to trade.\n');
  } else {
    console.log(`\n  ⚠️  LIVE ORDERS ENABLED on the ${env.tradingMode} account.\n`);
  }

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n  ${signal} — stopping.`);
    runner.running = false;
    try {
      if (runner.engine && !env.runtime.dryRun) {
        const cancelled = await runner.engine.shutdown();
        console.log(`  cancelled ${cancelled.length} resting order(s).`);
      }
    } catch (err) {
      console.error(`  could not cancel cleanly: ${err.message}`);
    }
    console.log(`  realized P&L this run: $${(runner.engine?.realizedPnl ?? 0).toFixed(2)}\n`);
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  const out = await runner.start();

  if (out.halted) {
    console.log(`\n  ⛔ ${HALT_MESSAGE[out.halted] ?? out.halted}`);
    console.log(`  ran ${out.ticks} tick(s), realized $${(runner.engine?.realizedPnl ?? 0).toFixed(2)}\n`);
    process.exit(2);
  }
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
