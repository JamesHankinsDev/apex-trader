// CLI: compare multiple portfolio configurations across timeframes.
//
// Example:
//   npm run portfolio
//
// Groups: 1H baselines, 1H no-DOGE variants, 1D baselines. Each group prints
// a comparison table so you can see within-group rankings and across-group
// trends at a glance.

import 'dotenv/config';
import { getBars, insertPortfolioRun } from '../db.js';
import { runPortfolio, type PortfolioConfig } from '../portfolioSim.js';
import { breakoutMomentumStrategy } from '../strategies/breakoutMomentum.js';
import { crashProtectedHoldStrategy } from '../strategies/crashProtectedHold.js';
import { smaTrendStrategy } from '../strategies/smaTrend.js';
import type { Bar, Timeframe } from '../types.js';
import { ALL_SYMBOLS } from '../regimeConfig.js';
import { parseDateMs } from '../cli.js';

const FROM = '2021-01-01';
const TO = '2026-04-15';
const STARTING_EQUITY = 10_000;

// Pure buy-and-hold sleeve for comparison purposes.
const buyHoldStrategy = {
  name: 'buy-and-hold',
  defaultParams: {},
  onBar(ctx: Parameters<typeof crashProtectedHoldStrategy.onBar>[0]) {
    if (!ctx.position) {
      return {
        action: 'enter' as const,
        sizeUsd: ctx.equity * 0.99,
        reason: 'buy and hold',
        factors: [],
      };
    }
    return { action: 'hold' as const, reason: 'holding forever', factors: [] };
  },
};

// Params retuned for 1D bars — preserve the semantic meaning (7 days, 30 days,
// 3 days of confirmation) but express in daily bars instead of hourly.
const DAILY_CRASH_PROTECTED_PARAMS = {
  fastPeriod: 7,
  slowPeriod: 30,
  confirmationBars: 3,
  bullThresholdPct: 1.5,
  bearThresholdPct: -1.5,
  allocationPctOfEquity: 99,
};
const DAILY_BREAKOUT_PARAMS = {
  breakoutLookback: 20,       // 20 days
  minVolumeRatio: 1.5,
  trailStopAtrMult: 2.0,
  hardStopPct: 5.0,
  maxHoldBars: 30,            // 30 days — trends take time
  minAtrPct: 0.5,
  allocationPctOfEquity: 95,
};
const DAILY_SMA_TREND_PARAMS = {
  fastPeriod: 10,
  slowPeriod: 30,
  hardStopPct: 5.0,
  maxHoldBars: 90,
  cooldownBars: 2,
  allocationPctOfEquity: 95,
};

interface NamedConfig extends PortfolioConfig {
  timeframe: Timeframe;
  group: string;
  rebalanceDays?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const MAJORS_SLEEVES_1H = [
  { symbol: 'BTC/USD', strategy: crashProtectedHoldStrategy, allocationPct: 25 },
  { symbol: 'ETH/USD', strategy: crashProtectedHoldStrategy, allocationPct: 25 },
];

// ── Config set ──────────────────────────────────────────────
const CONFIGS: NamedConfig[] = [
  // Group 1: 1H baselines (re-run for comparison against 1D)
  {
    group: 'Baselines (1H)',
    timeframe: '1H',
    name: '100% BTC buy-and-hold',
    sleeves: [{ symbol: 'BTC/USD', strategy: buyHoldStrategy, allocationPct: 100 }],
  },
  {
    group: 'Baselines (1H)',
    timeframe: '1H',
    name: '100% ETH buy-and-hold',
    sleeves: [{ symbol: 'ETH/USD', strategy: buyHoldStrategy, allocationPct: 100 }],
  },
  {
    group: 'Baselines (1H)',
    timeframe: '1H',
    name: '50/50 BTC/ETH crash-protected',
    sleeves: [
      { symbol: 'BTC/USD', strategy: crashProtectedHoldStrategy, allocationPct: 50 },
      { symbol: 'ETH/USD', strategy: crashProtectedHoldStrategy, allocationPct: 50 },
    ],
  },

  // Group 2: 1H including DOGE (the previous winner + user's proposal)
  {
    group: '1H with DOGE',
    timeframe: '1H',
    name: 'ALL crash-protected (incl DOGE)',
    sleeves: [
      ...MAJORS_SLEEVES_1H,
      { symbol: 'AVAX/USD', strategy: crashProtectedHoldStrategy, allocationPct: 10 },
      { symbol: 'LINK/USD', strategy: crashProtectedHoldStrategy, allocationPct: 10 },
      { symbol: 'AAVE/USD', strategy: crashProtectedHoldStrategy, allocationPct: 10 },
      { symbol: 'UNI/USD', strategy: crashProtectedHoldStrategy, allocationPct: 10 },
      { symbol: 'DOGE/USD', strategy: crashProtectedHoldStrategy, allocationPct: 10 },
    ],
  },
  {
    group: '1H with DOGE',
    timeframe: '1H',
    name: 'Passive majors + breakout momentum alts (incl DOGE)',
    sleeves: [
      ...MAJORS_SLEEVES_1H,
      { symbol: 'AVAX/USD', strategy: breakoutMomentumStrategy, allocationPct: 10 },
      { symbol: 'LINK/USD', strategy: breakoutMomentumStrategy, allocationPct: 10 },
      { symbol: 'AAVE/USD', strategy: breakoutMomentumStrategy, allocationPct: 10 },
      { symbol: 'UNI/USD', strategy: breakoutMomentumStrategy, allocationPct: 10 },
      { symbol: 'DOGE/USD', strategy: breakoutMomentumStrategy, allocationPct: 10 },
    ],
  },

  // Group 3: 1H WITHOUT DOGE — stress-test the winner's result for survivorship bias
  // With DOGE removed, the 4 remaining alts get 12.5% each (still 50% active total).
  {
    group: '1H NO DOGE',
    timeframe: '1H',
    name: 'ALL crash-protected (no DOGE)',
    sleeves: [
      ...MAJORS_SLEEVES_1H,
      { symbol: 'AVAX/USD', strategy: crashProtectedHoldStrategy, allocationPct: 12.5 },
      { symbol: 'LINK/USD', strategy: crashProtectedHoldStrategy, allocationPct: 12.5 },
      { symbol: 'AAVE/USD', strategy: crashProtectedHoldStrategy, allocationPct: 12.5 },
      { symbol: 'UNI/USD', strategy: crashProtectedHoldStrategy, allocationPct: 12.5 },
    ],
  },
  {
    group: '1H NO DOGE',
    timeframe: '1H',
    name: 'Passive majors + breakout momentum alts (no DOGE)',
    sleeves: [
      ...MAJORS_SLEEVES_1H,
      { symbol: 'AVAX/USD', strategy: breakoutMomentumStrategy, allocationPct: 12.5 },
      { symbol: 'LINK/USD', strategy: breakoutMomentumStrategy, allocationPct: 12.5 },
      { symbol: 'AAVE/USD', strategy: breakoutMomentumStrategy, allocationPct: 12.5 },
      { symbol: 'UNI/USD', strategy: breakoutMomentumStrategy, allocationPct: 12.5 },
    ],
  },
  {
    group: '1H NO DOGE',
    timeframe: '1H',
    name: 'ALL buy-and-hold (no DOGE)',
    sleeves: [
      { symbol: 'BTC/USD', strategy: buyHoldStrategy, allocationPct: 25 },
      { symbol: 'ETH/USD', strategy: buyHoldStrategy, allocationPct: 25 },
      { symbol: 'AVAX/USD', strategy: buyHoldStrategy, allocationPct: 12.5 },
      { symbol: 'LINK/USD', strategy: buyHoldStrategy, allocationPct: 12.5 },
      { symbol: 'AAVE/USD', strategy: buyHoldStrategy, allocationPct: 12.5 },
      { symbol: 'UNI/USD', strategy: buyHoldStrategy, allocationPct: 12.5 },
    ],
  },

  // Group 4: Daily timeframe — retuned params for 1D bars
  {
    group: '1D baselines',
    timeframe: '1D',
    name: '50/50 BTC/ETH crash-protected (1D)',
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
  },
  {
    group: '1D variants',
    timeframe: '1D',
    name: 'ALL crash-protected incl DOGE (1D)',
    sleeves: [
      { symbol: 'BTC/USD', strategy: crashProtectedHoldStrategy, allocationPct: 25, params: DAILY_CRASH_PROTECTED_PARAMS },
      { symbol: 'ETH/USD', strategy: crashProtectedHoldStrategy, allocationPct: 25, params: DAILY_CRASH_PROTECTED_PARAMS },
      { symbol: 'AVAX/USD', strategy: crashProtectedHoldStrategy, allocationPct: 10, params: DAILY_CRASH_PROTECTED_PARAMS },
      { symbol: 'LINK/USD', strategy: crashProtectedHoldStrategy, allocationPct: 10, params: DAILY_CRASH_PROTECTED_PARAMS },
      { symbol: 'AAVE/USD', strategy: crashProtectedHoldStrategy, allocationPct: 10, params: DAILY_CRASH_PROTECTED_PARAMS },
      { symbol: 'UNI/USD', strategy: crashProtectedHoldStrategy, allocationPct: 10, params: DAILY_CRASH_PROTECTED_PARAMS },
      { symbol: 'DOGE/USD', strategy: crashProtectedHoldStrategy, allocationPct: 10, params: DAILY_CRASH_PROTECTED_PARAMS },
    ],
  },
  {
    group: '1D variants',
    timeframe: '1D',
    name: 'ALL crash-protected no DOGE (1D)',
    sleeves: [
      { symbol: 'BTC/USD', strategy: crashProtectedHoldStrategy, allocationPct: 25, params: DAILY_CRASH_PROTECTED_PARAMS },
      { symbol: 'ETH/USD', strategy: crashProtectedHoldStrategy, allocationPct: 25, params: DAILY_CRASH_PROTECTED_PARAMS },
      { symbol: 'AVAX/USD', strategy: crashProtectedHoldStrategy, allocationPct: 12.5, params: DAILY_CRASH_PROTECTED_PARAMS },
      { symbol: 'LINK/USD', strategy: crashProtectedHoldStrategy, allocationPct: 12.5, params: DAILY_CRASH_PROTECTED_PARAMS },
      { symbol: 'AAVE/USD', strategy: crashProtectedHoldStrategy, allocationPct: 12.5, params: DAILY_CRASH_PROTECTED_PARAMS },
      { symbol: 'UNI/USD', strategy: crashProtectedHoldStrategy, allocationPct: 12.5, params: DAILY_CRASH_PROTECTED_PARAMS },
    ],
  },
  {
    group: '1D variants',
    timeframe: '1D',
    name: 'Passive majors + breakout momentum alts incl DOGE (1D)',
    sleeves: [
      { symbol: 'BTC/USD', strategy: crashProtectedHoldStrategy, allocationPct: 25, params: DAILY_CRASH_PROTECTED_PARAMS },
      { symbol: 'ETH/USD', strategy: crashProtectedHoldStrategy, allocationPct: 25, params: DAILY_CRASH_PROTECTED_PARAMS },
      { symbol: 'AVAX/USD', strategy: breakoutMomentumStrategy, allocationPct: 10, params: DAILY_BREAKOUT_PARAMS },
      { symbol: 'LINK/USD', strategy: breakoutMomentumStrategy, allocationPct: 10, params: DAILY_BREAKOUT_PARAMS },
      { symbol: 'AAVE/USD', strategy: breakoutMomentumStrategy, allocationPct: 10, params: DAILY_BREAKOUT_PARAMS },
      { symbol: 'UNI/USD', strategy: breakoutMomentumStrategy, allocationPct: 10, params: DAILY_BREAKOUT_PARAMS },
      { symbol: 'DOGE/USD', strategy: breakoutMomentumStrategy, allocationPct: 10, params: DAILY_BREAKOUT_PARAMS },
    ],
  },
  {
    group: '1D variants',
    timeframe: '1D',
    name: 'Passive majors + sma-trend alts incl DOGE (1D)',
    sleeves: [
      { symbol: 'BTC/USD', strategy: crashProtectedHoldStrategy, allocationPct: 25, params: DAILY_CRASH_PROTECTED_PARAMS },
      { symbol: 'ETH/USD', strategy: crashProtectedHoldStrategy, allocationPct: 25, params: DAILY_CRASH_PROTECTED_PARAMS },
      { symbol: 'AVAX/USD', strategy: smaTrendStrategy, allocationPct: 10, params: DAILY_SMA_TREND_PARAMS },
      { symbol: 'LINK/USD', strategy: smaTrendStrategy, allocationPct: 10, params: DAILY_SMA_TREND_PARAMS },
      { symbol: 'AAVE/USD', strategy: smaTrendStrategy, allocationPct: 10, params: DAILY_SMA_TREND_PARAMS },
      { symbol: 'UNI/USD', strategy: smaTrendStrategy, allocationPct: 10, params: DAILY_SMA_TREND_PARAMS },
      { symbol: 'DOGE/USD', strategy: smaTrendStrategy, allocationPct: 10, params: DAILY_SMA_TREND_PARAMS },
    ],
  },

  // Group 5: Rebalancing variants — tests whether quarterly rebalancing
  // (redistributing to target weights every 90 days) helps or hurts the
  // top-performing portfolios. Rebalancing can help when sleeves diverge
  // (reallocates from winners to losers — "buy low sell high"), but can
  // also hurt when winners keep winning (you're cutting your winners).
  {
    group: 'Rebalancing',
    timeframe: '1D',
    name: '50/50 BTC/ETH crash-protected (1D, QTR rebalance)',
    rebalanceDays: 90,
    sleeves: [
      { symbol: 'BTC/USD', strategy: crashProtectedHoldStrategy, allocationPct: 50, params: DAILY_CRASH_PROTECTED_PARAMS },
      { symbol: 'ETH/USD', strategy: crashProtectedHoldStrategy, allocationPct: 50, params: DAILY_CRASH_PROTECTED_PARAMS },
    ],
  },
  {
    group: 'Rebalancing',
    timeframe: '1D',
    name: 'ALL crash-protected incl DOGE (1D, QTR rebalance)',
    rebalanceDays: 90,
    sleeves: [
      { symbol: 'BTC/USD', strategy: crashProtectedHoldStrategy, allocationPct: 25, params: DAILY_CRASH_PROTECTED_PARAMS },
      { symbol: 'ETH/USD', strategy: crashProtectedHoldStrategy, allocationPct: 25, params: DAILY_CRASH_PROTECTED_PARAMS },
      { symbol: 'AVAX/USD', strategy: crashProtectedHoldStrategy, allocationPct: 10, params: DAILY_CRASH_PROTECTED_PARAMS },
      { symbol: 'LINK/USD', strategy: crashProtectedHoldStrategy, allocationPct: 10, params: DAILY_CRASH_PROTECTED_PARAMS },
      { symbol: 'AAVE/USD', strategy: crashProtectedHoldStrategy, allocationPct: 10, params: DAILY_CRASH_PROTECTED_PARAMS },
      { symbol: 'UNI/USD', strategy: crashProtectedHoldStrategy, allocationPct: 10, params: DAILY_CRASH_PROTECTED_PARAMS },
      { symbol: 'DOGE/USD', strategy: crashProtectedHoldStrategy, allocationPct: 10, params: DAILY_CRASH_PROTECTED_PARAMS },
    ],
  },
  {
    group: 'Rebalancing',
    timeframe: '1D',
    name: 'ALL crash-protected no DOGE (1D, QTR rebalance)',
    rebalanceDays: 90,
    sleeves: [
      { symbol: 'BTC/USD', strategy: crashProtectedHoldStrategy, allocationPct: 25, params: DAILY_CRASH_PROTECTED_PARAMS },
      { symbol: 'ETH/USD', strategy: crashProtectedHoldStrategy, allocationPct: 25, params: DAILY_CRASH_PROTECTED_PARAMS },
      { symbol: 'AVAX/USD', strategy: crashProtectedHoldStrategy, allocationPct: 12.5, params: DAILY_CRASH_PROTECTED_PARAMS },
      { symbol: 'LINK/USD', strategy: crashProtectedHoldStrategy, allocationPct: 12.5, params: DAILY_CRASH_PROTECTED_PARAMS },
      { symbol: 'AAVE/USD', strategy: crashProtectedHoldStrategy, allocationPct: 12.5, params: DAILY_CRASH_PROTECTED_PARAMS },
      { symbol: 'UNI/USD', strategy: crashProtectedHoldStrategy, allocationPct: 12.5, params: DAILY_CRASH_PROTECTED_PARAMS },
    ],
  },
  {
    group: 'Rebalancing',
    timeframe: '1H',
    name: '50/50 BTC/ETH crash-protected (1H, QTR rebalance)',
    rebalanceDays: 90,
    sleeves: [
      { symbol: 'BTC/USD', strategy: crashProtectedHoldStrategy, allocationPct: 50 },
      { symbol: 'ETH/USD', strategy: crashProtectedHoldStrategy, allocationPct: 50 },
    ],
  },
  {
    group: 'Rebalancing',
    timeframe: '1D',
    name: '50/50 BTC/ETH crash-protected (1D, MONTHLY rebalance)',
    rebalanceDays: 30,
    sleeves: [
      { symbol: 'BTC/USD', strategy: crashProtectedHoldStrategy, allocationPct: 50, params: DAILY_CRASH_PROTECTED_PARAMS },
      { symbol: 'ETH/USD', strategy: crashProtectedHoldStrategy, allocationPct: 50, params: DAILY_CRASH_PROTECTED_PARAMS },
    ],
  },
];

async function main() {
  const fromMs = parseDateMs(FROM);
  const toMs = parseDateMs(TO);

  // Preload bars per timeframe (both 1H and 1D) so each config runs instantly.
  const timeframesUsed = Array.from(new Set(CONFIGS.map(c => c.timeframe)));
  const barsByTimeframe = new Map<Timeframe, Map<string, Bar[]>>();
  for (const tf of timeframesUsed) {
    const map = new Map<string, Bar[]>();
    for (const symbol of ALL_SYMBOLS) {
      map.set(symbol, getBars(symbol, tf, fromMs, toMs));
    }
    barsByTimeframe.set(tf, map);
  }

  // Quick coverage sanity check
  console.log('Bar coverage:');
  for (const [tf, map] of barsByTimeframe) {
    const counts = [...map.entries()]
      .map(([s, b]) => `${s}:${b.length}`)
      .join('  ');
    console.log(`  ${tf} -> ${counts}`);
  }
  console.log('');

  const results = CONFIGS.map(cfg => {
    const bars = barsByTimeframe.get(cfg.timeframe)!;
    const r = runPortfolio({
      config: cfg,
      barsBySymbol: bars,
      timeframe: cfg.timeframe,
      startingEquity: STARTING_EQUITY,
      // Daily needs fewer warmup bars than hourly.
      warmupBars: cfg.timeframe === '1D' ? 30 : 50,
      rebalanceIntervalMs:
        cfg.rebalanceDays !== undefined ? cfg.rebalanceDays * DAY_MS : undefined,
    });
    // Persist so the UI can browse the same results.
    if (r.equityCurve.length > 0) {
      try {
        insertPortfolioRun({
          name: cfg.name,
          timeframe: cfg.timeframe,
          startT: r.equityCurve[0]!.t,
          endT: r.equityCurve[r.equityCurve.length - 1]!.t,
          startingEquity: r.startingEquity,
          endingEquity: r.endingEquity,
          totalReturnPct: r.totalReturnPct,
          maxDrawdownPct: r.maxDrawdownPct,
          sharpe: r.sharpe,
          rebalanceIntervalDays: cfg.rebalanceDays ?? null,
          equityCurve: r.equityCurve,
          sleeves: r.sleeveResults,
        });
      } catch (err) {
        console.warn(`  failed to persist ${cfg.name}:`, (err as Error).message);
      }
    }
    return { cfg, result: r };
  });

  // Print by group
  const groups = Array.from(new Set(CONFIGS.map(c => c.group)));
  for (const group of groups) {
    const rows = results.filter(r => r.cfg.group === group);
    console.log(`═══ ${group} ═══`);
    console.log(
      '  Final $     Return    MaxDD   Sharpe  Name',
    );
    console.log('  ' + '─'.repeat(93));
    for (const { cfg, result } of rows) {
      console.log(
        `  ${fmtMoney(result.endingEquity).padStart(9)}  ${fmtPct(result.totalReturnPct).padStart(8)}  ${(result.maxDrawdownPct.toFixed(1) + '%').padStart(6)}  ${(result.sharpe !== null ? result.sharpe.toFixed(2) : 'n/a').padStart(6)}  ${cfg.name}`,
      );
    }
    console.log('');
  }

  // Overall ranking
  const ranked = [...results].sort(
    (a, b) => b.result.totalReturnPct - a.result.totalReturnPct,
  );
  console.log('═══ Overall ranking ═══');
  for (let i = 0; i < ranked.length; i++) {
    const { cfg, result } = ranked[i]!;
    console.log(
      `  ${String(i + 1).padStart(2)}. ${fmtPct(result.totalReturnPct).padStart(9)}  ${fmtMoney(result.endingEquity).padStart(9)}   ${(result.sharpe !== null ? result.sharpe.toFixed(2) : 'n/a').padStart(5)} Sharpe  ${cfg.name}  [${cfg.timeframe}]`,
    );
  }
  console.log('');

  // Sleeve breakdowns for the headline active-vs-passive comparisons
  const spotlight = [
    'ALL crash-protected (no DOGE)',
    'Passive majors + breakout momentum alts (no DOGE)',
    'ALL crash-protected no DOGE (1D)',
    'Passive majors + breakout momentum alts incl DOGE (1D)',
  ];
  for (const name of spotlight) {
    const r = results.find(x => x.cfg.name === name);
    if (!r) continue;
    console.log(`═══ Sleeve breakdown: ${name} ═══`);
    for (const s of r.result.sleeveResults) {
      const warn = s.warnings.length > 0 ? `  ⚠ ${s.warnings.join('; ')}` : '';
      console.log(
        `  ${s.symbol.padEnd(10)} ${s.strategy.padEnd(24)} ${(s.allocation + '%').padStart(5)}  start $${s.startingCash.toFixed(0).padStart(6)}   end $${s.endingEquity.toFixed(0).padStart(8)}   ${fmtPct(s.returnPct).padStart(10)}   ${String(s.tradeCount).padStart(4)} trades${warn}`,
      );
    }
    console.log('');
  }
}

function fmtPct(v: number): string {
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
}

function fmtMoney(v: number): string {
  return `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

main().catch(err => {
  console.error(err.message ?? err);
  process.exit(1);
});
