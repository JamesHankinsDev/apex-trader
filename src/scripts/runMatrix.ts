// CLI: run a matrix of backtests across strategies × symbols × regimes.
// Persists every run and prints a comparison table.
//
// Example:
//   npm run matrix
//
// All strategies and configured regimes run against all symbols. Requires bars
// to be fetched first via `npm run fetch-regimes` (or `npm run fetch-bars`).

import 'dotenv/config';
import { runBacktest } from '../backtest.js';
import { getBars } from '../db.js';
import { COMPARISON_STRATEGIES } from '../strategies/index.js';
import { parseDateMs } from '../cli.js';
import {
  ALL_SYMBOLS,
  OUT_OF_SAMPLE_REGIMES,
  REGIMES,
  TIMEFRAME,
} from '../regimeConfig.js';
import type { BacktestSummary } from '../types.js';

const STARTING_EQUITY = 10_000;

interface Row {
  strategy: string;
  symbol: string;
  regime: string;
  barsFound: number;
  summary: BacktestSummary | null;
  error?: string;
}

async function main() {
  const rows: Row[] = [];

  for (const strategy of COMPARISON_STRATEGIES) {
    for (const symbol of ALL_SYMBOLS) {
      for (const regime of REGIMES) {
        const fromMs = parseDateMs(regime.from);
        const toMs = parseDateMs(regime.to);
        const bars = getBars(symbol, TIMEFRAME, fromMs, toMs);
        if (bars.length < 60) {
          rows.push({
            strategy: strategy.name,
            symbol,
            regime: regime.name,
            barsFound: bars.length,
            summary: null,
            error: `only ${bars.length} bars — fetch missing`,
          });
          continue;
        }
        try {
          const { summary } = runBacktest({
            strategy,
            symbol,
            timeframe: TIMEFRAME,
            bars,
            startingEquity: STARTING_EQUITY,
            persist: true,
          });
          rows.push({
            strategy: strategy.name,
            symbol,
            regime: regime.name,
            barsFound: bars.length,
            summary,
          });
        } catch (err: unknown) {
          rows.push({
            strategy: strategy.name,
            symbol,
            regime: regime.name,
            barsFound: bars.length,
            summary: null,
            error: (err as Error).message,
          });
        }
      }
    }
  }

  printTable(rows);
  printStrategySummary(rows);
}

function printTable(rows: Row[]): void {
  const header = [
    'Strategy',
    'Symbol',
    'Regime',
    'Return',
    'vs B&H',
    'Trades',
    'Win%',
    'MaxDD',
    'Sharpe',
  ];
  const lines: string[][] = [header];

  for (const r of rows) {
    // Mark out-of-sample regimes (ones strategies weren't designed against)
    // with an asterisk so it's obvious which results are the honest test.
    const regimeLabel = OUT_OF_SAMPLE_REGIMES.has(r.regime)
      ? `${r.regime}*`
      : r.regime;
    if (!r.summary) {
      lines.push([r.strategy, r.symbol, regimeLabel, r.error ?? 'error', '', '', '', '', '']);
      continue;
    }
    const s = r.summary;
    const vsBh = s.totalReturnPct - s.buyHoldReturnPct;
    lines.push([
      r.strategy,
      r.symbol,
      regimeLabel,
      fmtPct(s.totalReturnPct),
      fmtPct(vsBh),
      String(s.tradeCount),
      `${s.winRatePct.toFixed(0)}%`,
      `${s.maxDrawdownPct.toFixed(1)}%`,
      s.sharpe !== null ? s.sharpe.toFixed(2) : 'n/a',
    ]);
  }

  const widths = header.map((_, col) =>
    Math.max(...lines.map(l => (l[col] ?? '').length)),
  );
  const sep = widths.map(w => '─'.repeat(w)).join('─┼─');

  console.log('\n═══ Matrix Results ═══');
  lines.forEach((row, i) => {
    const line = row.map((cell, col) => (cell ?? '').padEnd(widths[col]!)).join(' │ ');
    console.log(line);
    if (i === 0) console.log(sep);
  });
}

function printStrategySummary(rows: Row[]): void {
  printAggregateSection('All Regimes', rows.filter(r => r.summary !== null));
  printAggregateSection(
    'Out-of-Sample Only (2020-2023, regimes not used to pick defaults)',
    rows.filter(r => r.summary !== null && OUT_OF_SAMPLE_REGIMES.has(r.regime)),
  );
  printAggregateSection(
    'In-Sample (2024-2026, regimes strategies were designed around)',
    rows.filter(r => r.summary !== null && !OUT_OF_SAMPLE_REGIMES.has(r.regime)),
  );
}

function printAggregateSection(label: string, rows: Row[]): void {
  if (rows.length === 0) return;
  const byStrategy = new Map<string, Row[]>();
  for (const r of rows) {
    if (!byStrategy.has(r.strategy)) byStrategy.set(r.strategy, []);
    byStrategy.get(r.strategy)!.push(r);
  }

  console.log(`\n═══ By-Strategy: ${label} ═══`);
  console.log(
    '  Strategy                 Runs  Avg Return  Avg vs B&H  Median   Profitable',
  );
  for (const [name, runs] of byStrategy) {
    const returns = runs.map(r => r.summary!.totalReturnPct).sort((a, b) => a - b);
    const vsBh = runs.map(r => r.summary!.totalReturnPct - r.summary!.buyHoldReturnPct);
    const avgRet = returns.reduce((a, b) => a + b, 0) / returns.length;
    const avgAlpha = vsBh.reduce((a, b) => a + b, 0) / vsBh.length;
    const median = returns[Math.floor(returns.length / 2)]!;
    const winning = runs.filter(r => r.summary!.totalReturnPct > 0).length;
    console.log(
      `  ${name.padEnd(25)}${String(runs.length).padStart(4)}   ${fmtPct(avgRet).padStart(8)}    ${fmtPct(avgAlpha).padStart(8)}   ${fmtPct(median).padStart(8)}   ${winning}/${runs.length}`,
    );
  }
}

function fmtPct(v: number): string {
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
}

main().catch(err => {
  console.error(err.message ?? err);
  process.exit(1);
});
