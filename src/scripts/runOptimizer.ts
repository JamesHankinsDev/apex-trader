// CLI: run walk-forward optimization for a strategy on a symbol.
//
// Example:
//   npm run optimize -- --strategy rsi-mean-revert --symbol BTC/USD --timeframe 1H \
//                       --from 2024-01-01 --to 2026-04-15 \
//                       --in-sample 180 --oos 60 --step 60 --objective sharpe
//
// Prints per-window results and an aggregate showing OOS performance and
// parameter stability.

import 'dotenv/config';
import { getBars } from '../db.js';
import { walkForward, type Objective, type Window } from '../optimizer.js';
import { getStrategy } from '../strategies/index.js';
import {
  optionalNumber,
  optionalString,
  parseArgs,
  parseDateMs,
  requireString,
} from '../cli.js';
import type { Timeframe } from '../types.js';

const DAY_MS = 24 * 60 * 60 * 1000;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const strategyName = requireString(args, 'strategy');
  const symbol = requireString(args, 'symbol');
  const timeframe = requireString(args, 'timeframe') as Timeframe;
  const fromMs = parseDateMs(requireString(args, 'from'));
  const toMs = parseDateMs(requireString(args, 'to'));
  const inSampleDays = optionalNumber(args, 'in-sample') ?? 180;
  const oosDays = optionalNumber(args, 'oos') ?? 60;
  const stepDays = optionalNumber(args, 'step') ?? 60;
  const objective = (optionalString(args, 'objective') ?? 'sharpe') as Objective;
  const equity = optionalNumber(args, 'equity') ?? 10_000;
  const minTrades = optionalNumber(args, 'min-trades') ?? 5;

  const strategy = getStrategy(strategyName);
  const bars = getBars(symbol, timeframe, fromMs, toMs);
  if (bars.length === 0) {
    console.error(`No bars for ${symbol} ${timeframe}. Run fetch-bars first.`);
    process.exit(2);
  }
  console.log(
    `Loaded ${bars.length} bars (${new Date(bars[0]!.t).toISOString().slice(0, 10)} → ${new Date(bars[bars.length - 1]!.t).toISOString().slice(0, 10)})`,
  );
  console.log(
    `Optimizing "${strategy.name}" on ${symbol} ${timeframe} — IS=${inSampleDays}d / OOS=${oosDays}d / step=${stepDays}d / objective=${objective}`,
  );

  const startWall = Date.now();
  const result = walkForward({
    strategy,
    symbol,
    timeframe,
    bars,
    startingEquity: equity,
    inSampleMs: inSampleDays * DAY_MS,
    outOfSampleMs: oosDays * DAY_MS,
    stepMs: stepDays * DAY_MS,
    objective,
    minTrades,
    onWindow: win => {
      process.stdout.write(
        `  window ${win.index + 1}: ` +
          (win.bestParams
            ? `best IS ${objective}=${win.bestIsObjective!.toFixed(2)} on ${win.isTradeCount} trades → OOS ${win.oosSummary ? fmtPct(win.oosSummary.totalReturnPct) + ` (${win.oosSummary.tradeCount} trades)` : 'n/a'}\n`
            : 'no qualifying IS candidate\n'),
      );
    },
  });

  printWindowTable(result.windows);
  printAggregate(result);
  console.log(`\n  Runtime: ${((Date.now() - startWall) / 1000).toFixed(1)}s`);
}

function printWindowTable(windows: Window[]): void {
  console.log('\n═══ Window Detail ═══');
  console.log(
    '  #   IS period             OOS period            Best Params                          IS Tr  OOS Ret    OOS Tr  OOS Sharpe',
  );
  for (const w of windows) {
    const isP = `${iso(w.inSampleStart)}→${iso(w.inSampleEnd)}`;
    const oosP = `${iso(w.oosStart)}→${iso(w.oosEnd)}`;
    const paramsStr = w.bestParams
      ? Object.entries(w.bestParams)
          .map(([k, v]) => `${k}=${v}`)
          .join(' ')
      : '—';
    const oosRet = w.oosSummary ? fmtPct(w.oosSummary.totalReturnPct) : 'n/a';
    const oosTr = w.oosSummary ? String(w.oosSummary.tradeCount) : '—';
    const oosSh = w.oosSummary?.sharpe !== null && w.oosSummary?.sharpe !== undefined
      ? w.oosSummary.sharpe.toFixed(2)
      : 'n/a';
    console.log(
      `  ${String(w.index + 1).padStart(3)} ${isP}  ${oosP}  ${paramsStr.padEnd(36)} ${String(w.isTradeCount).padStart(5)}  ${oosRet.padStart(8)}  ${oosTr.padStart(6)}  ${oosSh.padStart(10)}`,
    );
  }
}

function printAggregate(result: ReturnType<typeof walkForward>): void {
  const a = result.aggregate;
  console.log('\n═══ Aggregate (Out-of-Sample) ═══');
  console.log(`  Windows: ${a.completedWindows}/${a.totalWindows}`);
  console.log(
    `  Profitable OOS windows: ${a.profitableOosWindows}/${a.completedWindows}`,
  );
  console.log(`  Mean OOS return: ${fmtPct(a.meanOosReturnPct)}`);
  console.log(`  Median OOS return: ${fmtPct(a.medianOosReturnPct)}`);
  console.log(
    `  Mean OOS Sharpe: ${a.meanOosSharpe !== null ? a.meanOosSharpe.toFixed(2) : 'n/a'}`,
  );
  console.log(`  Total OOS trades: ${a.totalOosTrades}`);

  console.log('\n  Parameter stability (CV = stddev/|mean|, high = unstable):');
  for (const [name, s] of Object.entries(a.paramStability)) {
    const flag = s.cv > 0.3 ? ' ⚠ unstable' : s.cv > 0.15 ? ' ~drifting' : '';
    console.log(
      `    ${name.padEnd(20)} mean=${s.mean.toFixed(2).padStart(7)}  stddev=${s.stddev.toFixed(2).padStart(6)}  CV=${s.cv.toFixed(2)}${flag}`,
    );
    console.log(`       values: [${s.values.join(', ')}]`);
  }
}

function fmtPct(v: number): string {
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
}

function iso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

main().catch(err => {
  console.error(err.message ?? err);
  process.exit(1);
});
