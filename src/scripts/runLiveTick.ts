// CLI: run a single "tick" of the v2 live runner against Alpaca paper.
//
// Default config is the validated Phase-1 portfolio: 50/50 BTC/ETH on
// crash-protected hold, 1D timeframe, monthly rebalance (rebalance handled
// at the account level by resizing on each entry; for MVP each sleeve runs
// independently).
//
// Example:
//   npm run live-tick -- --mode paper
//
// To schedule daily, wire this into cron:
//   0 1 * * * cd /path/to/v2 && npm run live-tick -- --mode paper
//
// Safety: orders are blocked unless TRADING_ENABLED=true in .env. Without
// that flag, the tick still runs and logs a "what would have happened" entry.

import 'dotenv/config';
import { loadTradingCredentials } from '../alpaca.js';
import { runTick, type LiveRunConfig } from '../live/liveRunner.js';
import { crashProtectedHoldStrategy } from '../strategies/crashProtectedHold.js';
import {
  optionalString,
  parseArgs,
} from '../cli.js';
import type { AlpacaMode } from '../alpaca.js';

const DAILY_CRASH_PROTECTED_PARAMS = {
  fastPeriod: 7,
  slowPeriod: 30,
  confirmationBars: 3,
  bullThresholdPct: 1.5,
  bearThresholdPct: -1.5,
  allocationPctOfEquity: 99,
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const mode = (optionalString(args, 'mode') ?? 'paper') as AlpacaMode;
  const runName = optionalString(args, 'name') ?? `v2-primary-${mode}`;
  if (mode !== 'paper' && mode !== 'live') {
    throw new Error(`--mode must be paper or live, got ${mode}`);
  }

  const creds = loadTradingCredentials(mode);

  const config: LiveRunConfig = {
    name: runName,
    mode,
    timeframe: '1D',
    lookbackBars: 200,
    sleeves: [
      {
        symbol: 'BTC/USD',
        strategy: crashProtectedHoldStrategy,
        allocationPct: 50,
        params: DAILY_CRASH_PROTECTED_PARAMS,
      },
      {
        symbol: 'ETH/USD',
        strategy: crashProtectedHoldStrategy,
        allocationPct: 50,
        params: DAILY_CRASH_PROTECTED_PARAMS,
      },
    ],
    creds,
  };

  console.log(
    `Running tick "${config.name}" (${mode}) — ${config.sleeves.length} sleeves on ${config.timeframe} bars...`,
  );
  if (process.env.TRADING_ENABLED !== 'true') {
    console.log(
      `  ⚠ TRADING_ENABLED is not 'true' — orders will be BLOCKED (dry-run mode).`,
    );
  }

  const result = await runTick(config);

  console.log('\n─── Account ───');
  console.log(
    `  Equity: $${result.accountEquity?.toLocaleString(undefined, { maximumFractionDigits: 2 }) ?? 'n/a'}`,
  );
  console.log(
    `  Cash:   $${result.accountCash?.toLocaleString(undefined, { maximumFractionDigits: 2 }) ?? 'n/a'}`,
  );

  console.log('\n─── Sleeve signals ───');
  for (const s of result.sleeveSignals) {
    const tag =
      s.action === 'enter' ? '🟢' : s.action === 'exit' ? '🔴' : '⚪';
    console.log(
      `  ${tag} ${s.symbol.padEnd(10)} ${s.strategy.padEnd(25)} ${s.action.toUpperCase()} — ${s.reason}`,
    );
  }

  if (result.ordersPlaced.length > 0) {
    console.log('\n─── Orders ───');
    for (const o of result.ordersPlaced) {
      const tag = o.submitted ? '✓' : '✗';
      const amount =
        o.notional !== null
          ? `$${o.notional.toFixed(2)} notional`
          : `${o.qty?.toFixed(6)} qty`;
      console.log(
        `  ${tag} ${o.side.toUpperCase()} ${o.symbol} ${amount} — ${o.status} (${o.reason})`,
      );
    }
  } else {
    console.log('\n─── No orders placed this tick ───');
  }

  if (result.errors.length > 0) {
    console.log('\n─── Errors ───');
    for (const e of result.errors) console.log(`  ⚠ ${e}`);
  }

  console.log('\nTick logged to apex.db (live_ticks + live_trades tables).');
}

main().catch(err => {
  console.error('Tick failed:', err.message ?? err);
  process.exit(1);
});
