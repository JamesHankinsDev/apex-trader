// CLI: run walk-forward optimization across all 3 strategies × 3 symbols and
// print a single comparison table.
//
// Example:
//   npm run optimize-matrix
//
// Uses the same date range and window sizes as the regime matrix by default.

import 'dotenv/config';
import { getBars } from '../db.js';
import {
  walkForward,
  type Objective,
  type WalkForwardResult,
} from '../optimizer.js';
import { COMPARISON_STRATEGIES } from '../strategies/index.js';
import { parseDateMs } from '../cli.js';
import type { Timeframe } from '../types.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const SYMBOLS = ['BTC/USD', 'ETH/USD', 'SOL/USD'];
const TIMEFRAME: Timeframe = '1H';
const FROM = '2024-01-01';
const TO = '2026-04-15';
const IN_SAMPLE_DAYS = 180;
const OOS_DAYS = 60;
const STEP_DAYS = 60;
const OBJECTIVE: Objective = 'sharpe';
const STARTING_EQUITY = 10_000;

interface Row {
  strategy: string;
  symbol: string;
  result: WalkForwardResult | null;
  runtimeMs: number;
  error?: string;
}

async function main() {
  const rows: Row[] = [];
  const fromMs = parseDateMs(FROM);
  const toMs = parseDateMs(TO);

  for (const strategy of COMPARISON_STRATEGIES) {
    for (const symbol of SYMBOLS) {
      const t0 = Date.now();
      const bars = getBars(symbol, TIMEFRAME, fromMs, toMs);
      if (bars.length < 200) {
        rows.push({
          strategy: strategy.name,
          symbol,
          result: null,
          runtimeMs: 0,
          error: `only ${bars.length} bars`,
        });
        continue;
      }
      process.stdout.write(
        `Optimizing ${strategy.name.padEnd(18)} ${symbol.padEnd(9)} ... `,
      );
      try {
        const result = walkForward({
          strategy,
          symbol,
          timeframe: TIMEFRAME,
          bars,
          startingEquity: STARTING_EQUITY,
          inSampleMs: IN_SAMPLE_DAYS * DAY_MS,
          outOfSampleMs: OOS_DAYS * DAY_MS,
          stepMs: STEP_DAYS * DAY_MS,
          objective: OBJECTIVE,
        });
        const runtimeMs = Date.now() - t0;
        const a = result.aggregate;
        console.log(
          `${a.completedWindows}/${a.totalWindows} windows, ` +
            `mean OOS ${fmtPct(a.meanOosReturnPct)}, ` +
            `${a.profitableOosWindows}/${a.completedWindows} profitable ` +
            `(${(runtimeMs / 1000).toFixed(1)}s)`,
        );
        rows.push({ strategy: strategy.name, symbol, result, runtimeMs });
      } catch (err: unknown) {
        console.log(`FAILED: ${(err as Error).message}`);
        rows.push({
          strategy: strategy.name,
          symbol,
          result: null,
          runtimeMs: Date.now() - t0,
          error: (err as Error).message,
        });
      }
    }
  }

  printComparison(rows);
  printRankings(rows);
}

function printComparison(rows: Row[]): void {
  console.log('\n═══ Walk-Forward OOS Summary ═══');
  console.log(
    '  Strategy             Symbol    Windows  Profitable  Mean OOS   Median OOS  Mean Sharpe  OOS Trades  Stability',
  );
  console.log(
    '  ' + '─'.repeat(108),
  );
  for (const r of rows) {
    if (!r.result) {
      console.log(`  ${r.strategy.padEnd(20)} ${r.symbol.padEnd(9)} ${r.error ?? 'error'}`);
      continue;
    }
    const a = r.result.aggregate;
    const avgCv =
      Object.values(a.paramStability).reduce((s, p) => s + p.cv, 0) /
      Math.max(1, Object.keys(a.paramStability).length);
    const stabilityLabel =
      avgCv < 0.15 ? 'stable' : avgCv < 0.30 ? 'drifting' : 'unstable';
    console.log(
      `  ${r.strategy.padEnd(20)} ${r.symbol.padEnd(9)} ${String(a.completedWindows + '/' + a.totalWindows).padEnd(8)} ${String(a.profitableOosWindows + '/' + a.completedWindows).padEnd(11)} ${fmtPct(a.meanOosReturnPct).padStart(8)}   ${fmtPct(a.medianOosReturnPct).padStart(9)}  ${(a.meanOosSharpe !== null ? a.meanOosSharpe.toFixed(2) : 'n/a').padStart(11)}  ${String(a.totalOosTrades).padStart(10)}  ${stabilityLabel} (CV ${avgCv.toFixed(2)})`,
    );
  }
}

function printRankings(rows: Row[]): void {
  const valid = rows.filter(r => r.result !== null && r.result.aggregate.completedWindows > 0);
  if (valid.length === 0) return;

  valid.sort((a, b) => {
    const aMean = a.result!.aggregate.meanOosReturnPct;
    const bMean = b.result!.aggregate.meanOosReturnPct;
    return bMean - aMean;
  });

  console.log('\n═══ Ranked by Mean OOS Return ═══');
  valid.slice(0, 5).forEach((r, i) => {
    const a = r.result!.aggregate;
    console.log(
      `  ${i + 1}. ${r.strategy.padEnd(18)} ${r.symbol.padEnd(9)} ${fmtPct(a.meanOosReturnPct).padStart(8)} (profitable ${a.profitableOosWindows}/${a.completedWindows})`,
    );
  });
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
