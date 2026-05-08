// Shared regime windows and symbol list used by the fetch and matrix runners.
// Update here to add new regimes — both scripts stay in sync automatically.
//
// Regime boundaries are picked roughly by BTC's macro behavior:
//   2020-2021 bull — BTC $10k → $65k, explosive rally
//   2022       bear — crypto winter, BTC $65k → $16k
//   2023    recovery — grinding range/uptrend
//   2024       bull — BTC ETF launch, halving, $42k → $93k
//   2025   sideways — cooling, range-bound
//   2026       bear — current drawdown

import type { Timeframe } from './types.js';

export interface RegimeWindow {
  name: string;
  from: string; // ISO date
  to: string;
}

export const REGIMES: RegimeWindow[] = [
  { name: '2020-2021-bull', from: '2020-01-01', to: '2022-01-01' },
  { name: '2022-bear', from: '2022-01-01', to: '2023-01-01' },
  { name: '2023-recovery', from: '2023-01-01', to: '2024-01-01' },
  { name: '2024-bull', from: '2024-01-01', to: '2025-01-01' },
  { name: '2025-sideways', from: '2025-01-01', to: '2025-07-01' },
  { name: '2026-bear', from: '2026-01-01', to: '2026-04-15' },
];

export const SYMBOLS = ['BTC/USD', 'ETH/USD', 'SOL/USD'];

// Smaller/more volatile alts. Used for the "active trading sleeve" portfolio
// experiment — higher volatility may create more opportunity, but also higher
// spreads and larger permanent drawdowns. Treat results skeptically — Alpaca
// only lists survivors, so there's selection bias built in.
export const ALT_SYMBOLS = [
  'AVAX/USD',
  'LINK/USD',
  'AAVE/USD',
  'UNI/USD',
  'DOGE/USD',
];

// All tradable symbols — major + alt.
export const ALL_SYMBOLS = [...SYMBOLS, ...ALT_SYMBOLS];

export const TIMEFRAME: Timeframe = '1H';

// Timeframes to fetch for the matrix/portfolio experiments. Keep 1H as the
// primary; 1D is for lower-frequency tests where spread cost per trade matters
// less and strategies need fewer bars of warmup.
export const TIMEFRAMES: Timeframe[] = ['1H', '1D'];

// Regimes introduced in this session are "out-of-sample" for strategies whose
// defaults were chosen against 2024-2026 data. Highlight them in reports.
export const OUT_OF_SAMPLE_REGIMES = new Set([
  '2020-2021-bull',
  '2022-bear',
  '2023-recovery',
]);
