// CLI: run a backtest over bars already stored in SQLite.
//
// Example:
//   npm run backtest -- --strategy rsi-mean-revert --symbol BTC/USD --timeframe 1H \
//                       --from 2026-01-01 --to 2026-04-01 --equity 10000 --persist
//
// Requires bars to be fetched first via `npm run fetch-bars`.

import 'dotenv/config';
import { runBacktest } from '../backtest.js';
import { getBars } from '../db.js';
import { getStrategy } from '../strategies/index.js';
import {
  flag,
  optionalNumber,
  parseArgs,
  parseDateMs,
  requireString,
} from '../cli.js';
import type { Timeframe } from '../types.js';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const strategyName = requireString(args, 'strategy');
  const symbol = requireString(args, 'symbol');
  const timeframe = requireString(args, 'timeframe') as Timeframe;
  const fromMs = parseDateMs(requireString(args, 'from'));
  const toMs = parseDateMs(requireString(args, 'to'));
  const equity = optionalNumber(args, 'equity') ?? 10_000;
  const warmup = optionalNumber(args, 'warmup') ?? 50;
  const persist = flag(args, 'persist');

  const strategy = getStrategy(strategyName);
  const bars = getBars(symbol, timeframe, fromMs, toMs);
  if (bars.length === 0) {
    console.error(
      `No bars found for ${symbol} ${timeframe} in that range. Run fetch-bars first.`,
    );
    process.exit(2);
  }
  console.log(
    `Loaded ${bars.length} bars (${new Date(bars[0]!.t).toISOString()} → ${new Date(bars[bars.length - 1]!.t).toISOString()})`,
  );

  const result = runBacktest({
    strategy,
    symbol,
    timeframe,
    bars,
    startingEquity: equity,
    warmupBars: warmup,
    persist,
  });

  printSummary(result.summary, result.trades.length);
  if (persist && result.runId !== null) {
    console.log(`\nPersisted as run #${result.runId}.`);
  }
}

function printSummary(s: ReturnType<typeof runBacktest>['summary'], tradeCount: number): void {
  const line = (label: string, value: string) =>
    console.log(`  ${label.padEnd(22)} ${value}`);
  console.log('\n═══ Backtest Summary ═══');
  line('Strategy', s.strategy);
  line('Symbol / timeframe', `${s.symbol} / ${s.timeframe}`);
  line('Period', `${new Date(s.startT).toISOString().slice(0, 10)} → ${new Date(s.endT).toISOString().slice(0, 10)}`);
  line('Starting equity', `$${s.startingEquity.toFixed(2)}`);
  line('Ending equity', `$${s.endingEquity.toFixed(2)}`);
  line('Total return', `${fmtPct(s.totalReturnPct)}`);
  line('Buy & hold return', `${fmtPct(s.buyHoldReturnPct)}`);
  line('vs Buy & hold', `${fmtPct(s.totalReturnPct - s.buyHoldReturnPct)}`);
  line('Trades', `${tradeCount} (${s.winCount}W / ${s.lossCount}L)`);
  line('Win rate', `${s.winRatePct.toFixed(1)}%`);
  line('Avg win / loss', `${fmtPct(s.avgWinPct)} / ${fmtPct(s.avgLossPct)}`);
  line('Best / worst', `${fmtPct(s.bestTradePct)} / ${fmtPct(s.worstTradePct)}`);
  line('Max drawdown', `${s.maxDrawdownPct.toFixed(2)}%`);
  line('Sharpe (annualized)', s.sharpe !== null ? s.sharpe.toFixed(2) : 'n/a');
  console.log('');
}

function fmtPct(v: number): string {
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
}

main().catch(err => {
  console.error(err.message ?? err);
  process.exit(1);
});
