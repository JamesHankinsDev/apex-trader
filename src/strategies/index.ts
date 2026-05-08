// Strategy registry. Add new strategies here so CLIs can look them up by name.

import type { Strategy } from '../types.js';
import { breakoutMomentumStrategy } from './breakoutMomentum.js';
import { crashProtectedHoldStrategy } from './crashProtectedHold.js';
import { rsiMeanRevertStrategy } from './rsiMeanRevert.js';
import { smaTrendStrategy } from './smaTrend.js';
import { withRegimeFilter } from './regimeFilter.js';

// Regime-aware variants of the base strategies. Each gates entries to the
// regime where the base logic makes sense:
//   - RSI mean-reversion thrives on chop → sideways only
//   - Breakout and SMA-trend are trend-followers → bull only
// Exits still fire via the base logic regardless of regime.
const rsiSidewaysOnly = withRegimeFilter(
  rsiMeanRevertStrategy,
  ['sideways'],
  'sideways',
);
const breakoutBullOnly = withRegimeFilter(
  breakoutMomentumStrategy,
  ['bull'],
  'bull',
);
const smaTrendBullOnly = withRegimeFilter(
  smaTrendStrategy,
  ['bull'],
  'bull',
);

export const STRATEGIES: Record<string, Strategy> = {
  // Base strategies (kept so CLI can reference them directly).
  [rsiMeanRevertStrategy.name]: rsiMeanRevertStrategy,
  [breakoutMomentumStrategy.name]: breakoutMomentumStrategy,
  [smaTrendStrategy.name]: smaTrendStrategy,
  // Regime-aware variants — these are what the matrix/optimizer run.
  [rsiSidewaysOnly.name]: rsiSidewaysOnly,
  [breakoutBullOnly.name]: breakoutBullOnly,
  [smaTrendBullOnly.name]: smaTrendBullOnly,
  // Benchmark baseline.
  [crashProtectedHoldStrategy.name]: crashProtectedHoldStrategy,
};

// Subset used by matrix/optimizer runners — regime-aware variants plus the
// benchmark. Base strategies remain accessible via getStrategy() for targeted
// single-combo runs.
export const COMPARISON_STRATEGIES: Strategy[] = [
  rsiSidewaysOnly,
  breakoutBullOnly,
  smaTrendBullOnly,
  crashProtectedHoldStrategy,
];

export function getStrategy(name: string): Strategy {
  const s = STRATEGIES[name];
  if (!s) {
    const available = Object.keys(STRATEGIES).join(', ');
    throw new Error(`Unknown strategy "${name}". Available: ${available}`);
  }
  return s;
}
