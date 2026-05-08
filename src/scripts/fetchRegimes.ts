// CLI: fetch the full regime matrix (symbols × time windows) into SQLite.
// One call to batch-download everything the matrix runner needs.
//
// Example:
//   npm run fetch-regimes
//
// Re-runnable: upserts existing bars, so it's safe to run again after a gap.
// Regimes and symbols are configured in src/regimeConfig.ts.

import 'dotenv/config';
import { fetchHistoricalBars, loadCredentials } from '../alpaca.js';
import { barsCoverage, insertBars } from '../db.js';
import { parseDateMs } from '../cli.js';
import { ALL_SYMBOLS, REGIMES, TIMEFRAMES } from '../regimeConfig.js';

async function main() {
  const creds = loadCredentials();
  for (const timeframe of TIMEFRAMES) {
    for (const symbol of ALL_SYMBOLS) {
      for (const regime of REGIMES) {
        const fromMs = parseDateMs(regime.from);
        const toMs = parseDateMs(regime.to);
        process.stdout.write(
          `Fetching ${symbol} ${timeframe} ${regime.name} (${regime.from} → ${regime.to})... `,
        );
        try {
          const bars = await fetchHistoricalBars(
            creds,
            symbol,
            timeframe,
            fromMs,
            toMs,
          );
          insertBars(symbol, timeframe, bars);
          console.log(`${bars.length} bars`);
        } catch (err: unknown) {
          console.log(`FAILED: ${(err as Error).message}`);
        }
      }
    }
  }

  console.log('\n─── Coverage ───');
  for (const timeframe of TIMEFRAMES) {
    for (const symbol of ALL_SYMBOLS) {
      const c = barsCoverage(symbol, timeframe);
      if (c.count > 0 && c.minT && c.maxT) {
        console.log(
          `  ${symbol} ${timeframe}: ${c.count} bars, ${new Date(c.minT).toISOString().slice(0, 10)} → ${new Date(c.maxT).toISOString().slice(0, 10)}`,
        );
      } else {
        console.log(`  ${symbol} ${timeframe}: none`);
      }
    }
  }
}

main().catch(err => {
  console.error(err.message ?? err);
  process.exit(1);
});
