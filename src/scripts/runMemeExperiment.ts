// CLI: meme-coin timeframe experiment. Fetches DOGE/SHIB/PEPE at 15Min/1H/1D,
// runs breakout-momentum on each combo with timeframe-appropriate parameters,
// and prints a comparison grid.
//
// Hypothesis being tested: do shorter timeframes help on hyper-volatile coins,
// or does increased trade frequency × wider spreads dominate any edge?
//
// Example:
//   npm run meme-experiment

import 'dotenv/config';
import { fetchHistoricalBars, loadCredentials } from '../alpaca.js';
import { runBacktest } from '../backtest.js';
import { barsCoverage, getBars, insertBars } from '../db.js';
import { breakoutMomentumStrategy } from '../strategies/breakoutMomentum.js';
import type { Bar, Timeframe } from '../types.js';
import { parseDateMs } from '../cli.js';

const FROM = '2024-01-01';
const TO = '2026-04-15';
const STARTING_EQUITY = 10_000;
const SYMBOLS = ['DOGE/USD', 'SHIB/USD', 'PEPE/USD'];
const TIMEFRAMES: Timeframe[] = ['15Min', '1H', '1D'];

// Timeframe-appropriate params for breakout-momentum. The idea is to preserve
// semantic meaning across timeframes — a "20-bar breakout" means something
// different on 15Min vs 1D bars.
const PARAMS_BY_TIMEFRAME: Record<Timeframe, Record<string, number>> = {
  '15Min': {
    breakoutLookback: 20,       // 5 hours
    minVolumeRatio: 1.5,
    trailStopAtrMult: 1.5,
    hardStopPct: 2.0,
    maxHoldBars: 96,            // 24 hours
    minAtrPct: 0.2,
    allocationPctOfEquity: 95,
  },
  '1H': {
    breakoutLookback: 20,       // 20 hours
    minVolumeRatio: 1.5,
    trailStopAtrMult: 2.0,
    hardStopPct: 3.0,
    maxHoldBars: 72,            // 3 days
    minAtrPct: 0.2,
    allocationPctOfEquity: 95,
  },
  '1D': {
    breakoutLookback: 20,       // 20 days
    minVolumeRatio: 1.5,
    trailStopAtrMult: 2.0,
    hardStopPct: 5.0,
    maxHoldBars: 30,            // 30 days
    minAtrPct: 0.5,
    allocationPctOfEquity: 95,
  },
  // Unused but required by type
  '1Min': {},
  '5Min': {},
  '4H': {},
};

// Warmup bars required so indicators settle before strategy acts.
const WARMUP_BY_TIMEFRAME: Record<Timeframe, number> = {
  '15Min': 50,
  '1H': 50,
  '4H': 50,
  '1D': 25,
  '1Min': 50,
  '5Min': 50,
};

async function main() {
  const fromMs = parseDateMs(FROM);
  const toMs = parseDateMs(TO);
  const creds = loadCredentials();

  // 1. Ensure data is available for every (symbol, timeframe) combination
  for (const symbol of SYMBOLS) {
    for (const tf of TIMEFRAMES) {
      const coverage = barsCoverage(symbol, tf);
      const hasCoverage =
        coverage.minT !== null &&
        coverage.maxT !== null &&
        coverage.minT <= fromMs &&
        coverage.maxT >= toMs;
      if (hasCoverage) {
        console.log(`${symbol} ${tf}: ${coverage.count} bars already in DB`);
        continue;
      }
      process.stdout.write(`Fetching ${symbol} ${tf}... `);
      try {
        const bars = await fetchHistoricalBars(creds, symbol, tf, fromMs, toMs);
        insertBars(symbol, tf, bars);
        console.log(`${bars.length} bars`);
      } catch (err) {
        console.log(`FAILED: ${(err as Error).message}`);
      }
    }
  }

  console.log('');

  // 2. Run breakout-momentum for each combo + buy-and-hold baseline
  interface Result {
    symbol: string;
    timeframe: Timeframe;
    strategyReturnPct: number;
    buyHoldReturnPct: number;
    tradeCount: number;
    winRatePct: number;
    maxDrawdownPct: number;
    bars: number;
  }
  const results: Result[] = [];

  for (const symbol of SYMBOLS) {
    for (const tf of TIMEFRAMES) {
      const bars = getBars(symbol, tf, fromMs, toMs);
      if (bars.length < WARMUP_BY_TIMEFRAME[tf] + 2) {
        console.log(`${symbol} ${tf}: insufficient bars (${bars.length})`);
        continue;
      }
      try {
        const r = runBacktest({
          strategy: breakoutMomentumStrategy,
          params: PARAMS_BY_TIMEFRAME[tf],
          symbol,
          timeframe: tf,
          bars,
          startingEquity: STARTING_EQUITY,
          warmupBars: WARMUP_BY_TIMEFRAME[tf],
          persist: false,
        });
        results.push({
          symbol,
          timeframe: tf,
          strategyReturnPct: r.summary.totalReturnPct,
          buyHoldReturnPct: r.summary.buyHoldReturnPct,
          tradeCount: r.summary.tradeCount,
          winRatePct: r.summary.winRatePct,
          maxDrawdownPct: r.summary.maxDrawdownPct,
          bars: bars.length,
        });
      } catch (err) {
        console.log(`${symbol} ${tf} FAILED: ${(err as Error).message}`);
      }
    }
  }

  // 3. Comparison grid
  console.log('\n═══ Meme Coin Timeframe Comparison ═══');
  console.log(
    `Strategy: breakout-momentum. Period: ${FROM} → ${TO}. Starting $${STARTING_EQUITY.toLocaleString()} per combo.`,
  );
  console.log('(spreads: DOGE 20bps, SHIB 40bps, PEPE 50bps per side)\n');

  console.log(
    '  Symbol      Timeframe    Strategy     Buy & Hold    vs B&H    Trades   Win%    MaxDD    Bars',
  );
  console.log('  ' + '─'.repeat(100));
  for (const r of results) {
    const alpha = r.strategyReturnPct - r.buyHoldReturnPct;
    const alphaCls = alpha >= 0 ? '+' : '';
    console.log(
      `  ${r.symbol.padEnd(11)} ${r.timeframe.padEnd(11)}  ${fmtPct(r.strategyReturnPct).padStart(9)}   ${fmtPct(r.buyHoldReturnPct).padStart(10)}   ${(alphaCls + alpha.toFixed(1) + 'pp').padStart(8)}  ${String(r.tradeCount).padStart(6)}   ${(r.winRatePct.toFixed(0) + '%').padStart(4)}   ${(r.maxDrawdownPct.toFixed(1) + '%').padStart(6)}  ${String(r.bars).padStart(6)}`,
    );
  }

  // 4. Pattern summary by timeframe (aggregate across coins)
  console.log('\n═══ Aggregated by timeframe ═══');
  for (const tf of TIMEFRAMES) {
    const tfRows = results.filter(r => r.timeframe === tf);
    if (tfRows.length === 0) continue;
    const avgReturn = tfRows.reduce((a, r) => a + r.strategyReturnPct, 0) / tfRows.length;
    const avgTrades = tfRows.reduce((a, r) => a + r.tradeCount, 0) / tfRows.length;
    const avgAlpha =
      tfRows.reduce((a, r) => a + (r.strategyReturnPct - r.buyHoldReturnPct), 0) /
      tfRows.length;
    const profitable = tfRows.filter(r => r.strategyReturnPct > 0).length;
    console.log(
      `  ${tf.padEnd(6)}  avg return ${fmtPct(avgReturn).padStart(9)}  avg trades ${avgTrades.toFixed(0).padStart(5)}  avg vs B&H ${(avgAlpha >= 0 ? '+' : '') + avgAlpha.toFixed(1) + 'pp'}  profitable ${profitable}/${tfRows.length}`,
    );
  }

  // 5. Interpretation nudge
  console.log('\n═══ What to look for ═══');
  console.log(
    '  If 15Min rows have dramatically more trades AND worse returns than 1H/1D,',
  );
  console.log(
    '  that confirms the spread-tax hypothesis — shorter timeframes are self-defeating.',
  );
  console.log(
    '  If 15Min is *better* than 1H/1D, the hypothesis is wrong and rapid trading is worth pursuing.',
  );
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
