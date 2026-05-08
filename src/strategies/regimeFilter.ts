// Wraps a base strategy so it only *enters* during allowed regimes. When the
// wrapper is in a position, it defers entirely to the base strategy for exit
// logic — we don't want stops/take-profits to freeze mid-trade just because
// the regime flipped.
//
// Use this to make context-free strategies regime-aware without forking them.

import { classifyRegime, type Regime } from '../regime.js';
import type { Strategy } from '../types.js';

export function withRegimeFilter(
  base: Strategy,
  allowed: Regime[],
  nameSuffix: string,
): Strategy {
  const allowedSet = new Set<Regime>(allowed);
  return {
    name: `${base.name}-${nameSuffix}`,
    defaultParams: base.defaultParams,
    paramGrid: base.paramGrid,

    onBar(ctx) {
      // If we're already in a position, delegate completely so exit rules fire.
      if (ctx.position) return base.onBar(ctx);

      const snap = classifyRegime(ctx.history);
      if (snap.regime === 'unknown') {
        // Not enough history yet — be conservative, don't enter.
        return {
          action: 'hold',
          reason: `regime unknown (warming up)`,
          factors: [{ name: 'regime_confidence', value: 0, note: snap.reason }],
        };
      }
      if (!allowedSet.has(snap.regime)) {
        return {
          action: 'hold',
          reason: `${snap.regime} regime — skipping (allowed: ${allowed.join('+')})`,
          factors: [
            { name: 'regime', value: regimeCode(snap.regime), note: snap.regime },
            { name: 'trend_pct', value: +snap.trendPct.toFixed(2) },
          ],
        };
      }
      // Regime allowed — defer to base entry logic.
      return base.onBar(ctx);
    },
  };
}

function regimeCode(r: Regime): number {
  if (r === 'bull') return 1;
  if (r === 'bear') return -1;
  if (r === 'sideways') return 0;
  return 99;
}
