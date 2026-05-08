// CLI: download historical bars from Alpaca and store them in SQLite.
//
// Example:
//   npm run fetch-bars -- --symbol BTC/USD --timeframe 1H --from 2026-01-01 --to 2026-04-01
//
// Bars are upserted (INSERT OR REPLACE), so re-running is idempotent.

import 'dotenv/config';
import { fetchHistoricalBars, loadCredentials } from '../alpaca.js';
import { barsCoverage, insertBars } from '../db.js';
import {
  parseArgs,
  parseDateMs,
  requireString,
} from '../cli.js';
import type { Timeframe } from '../types.js';

const SUPPORTED_TIMEFRAMES: Timeframe[] = [
  '1Min',
  '5Min',
  '15Min',
  '1H',
  '4H',
  '1D',
];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const symbol = requireString(args, 'symbol');
  const timeframeRaw = requireString(args, 'timeframe');
  if (!SUPPORTED_TIMEFRAMES.includes(timeframeRaw as Timeframe)) {
    throw new Error(
      `--timeframe must be one of: ${SUPPORTED_TIMEFRAMES.join(', ')}`,
    );
  }
  const timeframe = timeframeRaw as Timeframe;
  const fromMs = parseDateMs(requireString(args, 'from'));
  const toMs = parseDateMs(requireString(args, 'to'));
  if (toMs <= fromMs) throw new Error('--to must be after --from');

  const creds = loadCredentials();

  console.log(
    `Fetching ${symbol} ${timeframe} from ${new Date(fromMs).toISOString()} to ${new Date(toMs).toISOString()}...`,
  );
  const bars = await fetchHistoricalBars(creds, symbol, timeframe, fromMs, toMs);
  console.log(`Received ${bars.length} bars.`);

  if (bars.length === 0) {
    console.log('No bars returned — check credentials and date range.');
    return;
  }

  const inserted = insertBars(symbol, timeframe, bars);
  const coverage = barsCoverage(symbol, timeframe);
  console.log(`Stored ${inserted} bars.`);
  if (coverage.minT && coverage.maxT) {
    console.log(
      `DB now has ${coverage.count} ${symbol} ${timeframe} bars covering ` +
        `${new Date(coverage.minT).toISOString()} → ${new Date(coverage.maxT).toISOString()}`,
    );
  }
}

main().catch(err => {
  console.error(err.message ?? err);
  process.exit(1);
});
