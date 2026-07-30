/* Apex Trader — historical bar loading, cached to disk.

   Bars never change once closed, so a fetched range is cached and reused.
   bot/backtest/data/ is gitignored — it is downloaded data, not source. */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = resolve(__dirname, 'data');

const slug = (s) => s.replace(/[^A-Za-z0-9]/g, '');

function cachePath(symbol, timeframe, start, end) {
  return join(CACHE_DIR, `${slug(symbol)}-${timeframe}-${start.slice(0, 10)}-${end.slice(0, 10)}.json`);
}

/**
 * Load bars, from cache when available.
 *
 * @param {object} opts
 * @param {object} opts.client     Alpaca client
 * @param {string} opts.symbol
 * @param {string} opts.timeframe  1Min | 15Min | 1H | 1D
 * @param {string} opts.start      ISO date
 * @param {string} opts.end        ISO date
 * @param {boolean} [opts.refresh] ignore the cache
 */
export async function loadBars({ client, symbol, timeframe, start, end, refresh = false, logger = console }) {
  const file = cachePath(symbol, timeframe, start, end);

  if (!refresh && existsSync(file)) {
    const cached = JSON.parse(readFileSync(file, 'utf8'));
    logger.info?.(`[data] ${cached.length} ${timeframe} bars from cache`);
    return cached;
  }

  logger.info?.(`[data] fetching ${symbol} ${timeframe} ${start.slice(0, 10)} -> ${end.slice(0, 10)}…`);
  const bars = await client.getCryptoBars({ symbol, timeframe, start, end });

  if (!bars.length) throw new Error(`No bars returned for ${symbol} ${start} -> ${end}.`);

  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(file, JSON.stringify(bars));
  logger.info?.(`[data] ${bars.length} bars fetched and cached`);

  return bars;
}

/** Quick sanity summary of a bar series. */
export function describeBars(bars) {
  const closes = bars.map((b) => b.c);
  const lo = Math.min(...bars.map((b) => b.l));
  const hi = Math.max(...bars.map((b) => b.h));
  return {
    count: bars.length,
    from: bars[0].t,
    to: bars[bars.length - 1].t,
    first: closes[0],
    last: closes[closes.length - 1],
    low: lo,
    high: hi,
    changePct: ((closes[closes.length - 1] / closes[0]) - 1) * 100,
    rangePct: ((hi / lo) - 1) * 100,
  };
}
