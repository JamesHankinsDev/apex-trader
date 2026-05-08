// Per-symbol spread cost model. Values are per-SIDE fractions (so a round
// trip pays 2x these). Tiered by asset quality:
//   - Majors (BTC, ETH, SOL): tight 8-12 bps
//   - Mid-cap alts (AVAX, LINK, AAVE, UNI, DOT): 15 bps
//   - Meme/hyper-volatile (DOGE, SHIB, PEPE): 20-50 bps — wide spreads that
//     can't be ignored at retail; these dominate any high-frequency strategy.
//
// These are estimates based on published Alpaca crypto quote spreads; refine
// once we have actual fill data from live paper trading.

import type { SpreadModel } from './types.js';

const PER_SIDE_SPREADS: Record<string, number> = {
  'BTC/USD': 0.0008,
  'ETH/USD': 0.0010,
  'SOL/USD': 0.0012,
  'AVAX/USD': 0.0015,
  'LINK/USD': 0.0015,
  'AAVE/USD': 0.0015,
  'UNI/USD': 0.0015,
  'DOT/USD': 0.0015,
  'DOGE/USD': 0.0020,
  'SHIB/USD': 0.0040,
  'PEPE/USD': 0.0050,
};

// Anything not in the table falls back to 15 bps (mid-cap alt default).
const FALLBACK_SPREAD = 0.0015;

export const defaultSpreadModel: SpreadModel = {
  forSymbol(symbol: string): number {
    const sym = symbol.includes('/') ? symbol : symbol.replace(/USD$/, '/USD');
    return PER_SIDE_SPREADS[sym] ?? FALLBACK_SPREAD;
  },
};
