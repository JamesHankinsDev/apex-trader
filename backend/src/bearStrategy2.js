// src/bearStrategy2.js - BTC DCA Accumulation strategy for Experiment 2
// In bear mode, ignores altcoins and accumulates BTC in 4 tranches.

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
const MAX_TRANCHES = 4;
const TRANCHE_PCT = 0.22; // 22% of available balance per tranche
const FIRST_DROP_PCT = 0.05; // 5% drop from regime flip price
const SUBSEQUENT_DROP_PCT = 0.04; // 4% additional drop per tranche
const EMERGENCY_LOSS_PCT = 0.20; // 20% loss on any tranche = exit all

// In-memory tranche state
const tranches = []; // { entryPrice, amount, timestamp, index }
let regimeFlipPrice = null; // BTC price when regime first flipped to bear

/**
 * Evaluate whether to deploy a new BTC tranche.
 *
 * @param {object} regime - Object returned by getMarketRegime()
 * @param {number} currentBtcPrice - Current BTC price
 * @param {Array} existingTranches - Current tranche array (passed for status)
 * @returns {object|null} Entry signal or null
 */
function evaluateBearEntry2(regime, currentBtcPrice, existingTranches, opts = {}) {
  // Set regime flip price on first bear cycle
  if (regimeFlipPrice === null) {
    regimeFlipPrice = currentBtcPrice;
    console.log(`[EXP2][BEAR] Regime flip recorded — BTC at $${currentBtcPrice.toFixed(2)}`);
  }

  // Max 4 tranches
  if (tranches.length >= MAX_TRANCHES) {
    return null;
  }

  // CAPITULATION: skip spacing and price conditions — deploy immediately
  if (opts.forceEntry) {
    console.log(`[EXP2][BEAR] CAPITULATION — force-deploying tranche ${tranches.length + 1}/4`);
    return {
      entry: true,
      type: 'btc_dca_accumulation',
      trancheIndex: tranches.length,
      tranchePct: TRANCHE_PCT,
      regime: 'capitulation',
    };
  }

  // Check spacing: last tranche must be > 12h ago
  if (tranches.length > 0) {
    const lastTranche = tranches[tranches.length - 1];
    const elapsed = Date.now() - lastTranche.timestamp;
    if (elapsed < TWELVE_HOURS_MS) {
      const hoursRemaining = ((TWELVE_HOURS_MS - elapsed) / (60 * 60 * 1000)).toFixed(1);
      console.log(`[EXP2][BEAR] Tranche spacing — ${hoursRemaining}h until next eligible`);
      return null;
    }
  }

  // Allow caller to reduce thresholds (BEAR_EXHAUSTED: 3%/2% instead of 5%/4%)
  const firstDropPct = opts.firstDropPct ?? FIRST_DROP_PCT;
  const subsequentDropPct = opts.subsequentDropPct ?? SUBSEQUENT_DROP_PCT;

  // Check price conditions
  if (tranches.length === 0) {
    // First tranche: BTC must drop enough from regime flip price
    const dropPct = (regimeFlipPrice - currentBtcPrice) / regimeFlipPrice;
    if (dropPct < firstDropPct) {
      console.log(`[EXP2][BEAR] BTC drop ${(dropPct * 100).toFixed(1)}% — needs ${(firstDropPct * 100).toFixed(0)}% from regime flip`);
      return null;
    }
  } else {
    // Subsequent tranches: BTC must drop enough below previous entry
    const prevEntry = tranches[tranches.length - 1].entryPrice;
    const dropFromPrev = (prevEntry - currentBtcPrice) / prevEntry;
    if (dropFromPrev < subsequentDropPct) {
      console.log(`[EXP2][BEAR] BTC drop ${(dropFromPrev * 100).toFixed(1)}% from last tranche — needs ${(subsequentDropPct * 100).toFixed(0)}%`);
      return null;
    }
  }

  const dropFromStart = regimeFlipPrice > 0
    ? ((regimeFlipPrice - currentBtcPrice) / regimeFlipPrice * 100).toFixed(1)
    : '0.0';

  console.log(`[EXP2][BEAR] BTC tranche ${tranches.length + 1}/4 deployed at $${currentBtcPrice.toFixed(2)} Drop from regime start: ${dropFromStart}%`);

  return {
    entry: true,
    type: 'btc_dca_accumulation',
    trancheIndex: tranches.length,
    tranchePct: TRANCHE_PCT,
    regime: 'bear',
  };
}

/**
 * Record a deployed tranche.
 */
function addTranche(entryPrice, amount) {
  tranches.push({
    entryPrice,
    amount,
    timestamp: Date.now(),
    index: tranches.length,
  });
}

/**
 * Check if tranches should be exited.
 *
 * @param {number} currentBtcPrice - Current BTC price
 * @param {boolean} gateReopened - Whether BTC gate has reopened (bull)
 * @returns {object|null} Exit signal or null
 */
function checkTrancheExit(currentBtcPrice, gateReopened) {
  if (tranches.length === 0) return null;

  // Exit condition A: gate reopened
  if (gateReopened) {
    const avgEntry = tranches.reduce((sum, t) => sum + t.entryPrice, 0) / tranches.length;
    const pnlPct = ((currentBtcPrice - avgEntry) / avgEntry * 100).toFixed(1);
    console.log(`[EXP2][BEAR] Exiting all BTC tranches — gate reopened Average entry: $${avgEntry.toFixed(2)} Exit: $${currentBtcPrice.toFixed(2)} PnL: ${pnlPct}%`);
    return { exit: true, reason: 'gateReopen', avgEntry, pnlPct: parseFloat(pnlPct) };
  }

  // Exit condition B: any tranche down > 20%
  for (const tranche of tranches) {
    const loss = (tranche.entryPrice - currentBtcPrice) / tranche.entryPrice;
    if (loss > EMERGENCY_LOSS_PCT) {
      const avgEntry = tranches.reduce((sum, t) => sum + t.entryPrice, 0) / tranches.length;
      const pnlPct = ((currentBtcPrice - avgEntry) / avgEntry * 100).toFixed(1);
      console.log(`[EXP2][BEAR] Emergency exit — tranche ${tranche.index + 1} down ${(loss * 100).toFixed(1)}% Average entry: $${avgEntry.toFixed(2)} Exit: $${currentBtcPrice.toFixed(2)} PnL: ${pnlPct}%`);
      return { exit: true, reason: 'emergencyStop', avgEntry, pnlPct: parseFloat(pnlPct) };
    }
  }

  return null;
}

/**
 * Clear all tranches (after full exit).
 */
function clearTranches() {
  tranches.length = 0;
  regimeFlipPrice = null;
}

/**
 * Get current BTC accumulation status.
 */
function getBtcAccumulationStatus() {
  if (tranches.length === 0) {
    return { active: false, tranches: 0, maxTranches: MAX_TRANCHES, regimeFlipPrice };
  }

  const avgEntry = tranches.reduce((sum, t) => sum + t.entryPrice, 0) / tranches.length;
  const totalAmount = tranches.reduce((sum, t) => sum + t.amount, 0);

  return {
    active: true,
    tranches: tranches.length,
    maxTranches: MAX_TRANCHES,
    avgEntry,
    totalAmount,
    regimeFlipPrice,
    trancheDetails: tranches.map(t => ({
      index: t.index + 1,
      entryPrice: t.entryPrice,
      amount: t.amount,
      timestamp: new Date(t.timestamp).toISOString(),
    })),
  };
}

module.exports = {
  evaluateBearEntry2,
  addTranche,
  checkTrancheExit,
  clearTranches,
  getBtcAccumulationStatus,
};
