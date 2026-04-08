// src/positionSizer.js — Dynamic position sizing engine
// Replaces static POSITION_SIZE / SCALP_TRADE_SIZE with signal-strength-based sizing.
// All three bots share this module.

// ─── Risk parameters (tuned in code, not env vars) ───────────
const CONFIG = {
  maxRiskPerTrade: 0.03,        // 3% of portfolio per trade
  maxPortfolioExposure: 0.80,   // 80% max total exposure
  minPositionSize: 10,          // $10 floor — skip smaller trades
  maxPositionPct: 0.50,         // 50% ceiling — never go all-in
  baseScalpSize: 25,            // $25 scalp base (scaled by confidence)
};

// ─── Confidence scoring ──────────────────────────────────────

/**
 * Score a scalp entry setup (0 to 1).
 * Higher = deeper dip below SMA + lower RSI + better expected net profit.
 *
 * @param {object} opts
 * @param {number} opts.smaDipPct - negative % below SMA (e.g., -0.5)
 * @param {number} opts.rsi - current RSI value
 * @param {number} opts.rsiThreshold - threshold used for entry (e.g., 45)
 * @param {number} opts.expectedNetPct - expected net profit after spread (e.g., 0.15)
 * @returns {number} confidence 0-1
 */
function scoreScalp({ smaDipPct, rsi, rsiThreshold = 45, expectedNetPct = 0 }) {
  // Dip depth: -0.4% = baseline (0.3), -0.8%+ = max (1.0)
  const dipAbs = Math.abs(smaDipPct || 0);
  const dipScore = Math.min(1, Math.max(0, (dipAbs - 0.2) / 0.6));

  // RSI distance from threshold: right at threshold = 0, 15+ below = 1
  const rsiDist = Math.max(0, rsiThreshold - (rsi || 50));
  const rsiScore = Math.min(1, rsiDist / 15);

  // Expected net profit: 0.15% = baseline (0.3), 0.5%+ = max (1.0)
  const netScore = Math.min(1, Math.max(0, (expectedNetPct - 0.1) / 0.4));

  // Weighted average
  const confidence = dipScore * 0.35 + rsiScore * 0.35 + netScore * 0.30;
  return parseFloat(Math.max(0.3, Math.min(1.0, confidence)).toFixed(3));
}

/**
 * Score a swing entry (Main bot momentum).
 *
 * @param {object} opts
 * @param {number} opts.score - signal score 0-100
 * @param {string} opts.regime - detailed regime state
 * @param {boolean} opts.htfConfirmed - higher timeframe confirmation
 * @returns {number} confidence 0-1
 */
function scoreSwing({ score = 50, regime, htfConfirmed = true }) {
  // Score: 65 = min (0.4), 85 = strong (0.8), 100 = max (1.0)
  const scoreNorm = Math.min(1, Math.max(0, (score - 60) / 40));

  // Regime bonus
  let regimeBonus = 0;
  if (regime === 'BULL_TRENDING') regimeBonus = 0.15;
  else if (regime === 'BULL_PULLBACK') regimeBonus = 0.10;
  else if (regime === 'BULL_WEAKENING') regimeBonus = -0.15;

  // HTF penalty
  const htfPenalty = htfConfirmed ? 0 : -0.1;

  const confidence = scoreNorm + regimeBonus + htfPenalty;
  return parseFloat(Math.max(0.3, Math.min(1.0, confidence)).toFixed(3));
}

/**
 * Score a breakout entry (Exp2 momentum breakout).
 *
 * @param {object} opts
 * @param {number} opts.volumeRatio - current volume / 20-bar avg
 * @param {number} opts.rsi - current RSI
 * @param {number} opts.priceAboveHigh - % price is above 20-bar high
 * @param {string} opts.regime - detailed regime state
 * @returns {number} confidence 0-1
 */
function scoreBreakout({ volumeRatio = 1.5, rsi = 60, priceAboveHigh = 0, regime }) {
  // Volume: 1.5x = baseline (0.4), 3x+ = max (1.0)
  const volScore = Math.min(1, Math.max(0, (volumeRatio - 1.2) / 1.8));

  // RSI sweet spot: 58-65 = best (1.0), edges toward 52 or 72 = lower
  const rsiOptimal = 1 - Math.min(1, Math.abs(rsi - 61) / 12);

  // Breakout strength: barely above = 0.3, 2%+ above = 1.0
  const breakoutScore = Math.min(1, Math.max(0, priceAboveHigh / 2));

  // Regime
  let regimeBonus = 0;
  if (regime === 'BULL_TRENDING') regimeBonus = 0.1;
  else if (regime === 'BULL_PULLBACK') regimeBonus = 0.05;
  else if (regime === 'BULL_WEAKENING') regimeBonus = -0.15;

  const confidence = volScore * 0.35 + rsiOptimal * 0.25 + breakoutScore * 0.25 + 0.15 + regimeBonus;
  return parseFloat(Math.max(0.3, Math.min(1.0, confidence)).toFixed(3));
}

/**
 * Score a bear rally scalp (Main bot).
 *
 * @param {object} opts
 * @param {number} opts.btcBounce - BTC 24h % gain
 * @param {number} opts.rsi - coin RSI
 * @param {number} opts.volumeRatio - coin volume ratio
 * @param {number} opts.fearGreed - F&G index
 * @returns {number} confidence 0-1
 */
function scoreBearRally({ btcBounce = 3, rsi = 55, volumeRatio = 2, fearGreed = 20 }) {
  const bounceScore = Math.min(1, Math.max(0, (btcBounce - 2) / 5));
  const rsiScore = rsi >= 45 && rsi <= 65 ? 1 - Math.abs(rsi - 55) / 15 : 0.2;
  const volScore = Math.min(1, Math.max(0, (volumeRatio - 1.5) / 2));
  const fgRecovery = Math.min(1, Math.max(0, (fearGreed - 10) / 20));

  const confidence = bounceScore * 0.3 + rsiScore * 0.25 + volScore * 0.25 + fgRecovery * 0.2;
  return parseFloat(Math.max(0.3, Math.min(0.8, confidence)).toFixed(3)); // capped at 0.8 — bear rallies are inherently risky
}

/**
 * Score a BTC DCA tranche (Exp2 bear mode).
 *
 * @param {object} opts
 * @param {number} opts.dropPct - % BTC has dropped from reference
 * @param {number} opts.fearGreed - F&G index
 * @param {number} opts.trancheIndex - which tranche (0-3)
 * @returns {number} confidence 0-1
 */
function scoreDcaTranche({ dropPct = 5, fearGreed = 20, trancheIndex = 0 }) {
  const dropScore = Math.min(1, Math.max(0, (dropPct - 3) / 10));
  const fgScore = Math.min(1, Math.max(0, (30 - fearGreed) / 25)); // lower F&G = higher conviction
  // Later tranches = higher conviction (DCA averaging down)
  const trancheBonus = Math.min(0.15, trancheIndex * 0.05);

  const confidence = dropScore * 0.4 + fgScore * 0.35 + 0.25 + trancheBonus;
  return parseFloat(Math.max(0.5, Math.min(1.0, confidence)).toFixed(3));
}

// ─── Position size calculation ───────────────────────────────

/**
 * Calculate the position size in USD.
 *
 * @param {object} opts
 * @param {number} opts.confidence - 0 to 1 signal confidence
 * @param {number} opts.portfolioValue - current portfolio value
 * @param {number} opts.cashBalance - available cash
 * @param {number} opts.currentExposure - total notional of open positions
 * @param {number} [opts.atrPct] - current ATR as % of price (for volatility adjustment)
 * @param {number} [opts.normalAtrPct] - "normal" ATR% for this asset (baseline)
 * @param {string} [opts.tradeType] - 'scalp' | 'swing' | 'breakout' | 'bearRally' | 'dca'
 * @returns {{ size: number, confidence: number, sizeLabel: string, blocked: boolean, reason?: string }}
 */
function calculateSize(opts) {
  const {
    confidence,
    portfolioValue,
    cashBalance,
    currentExposure = 0,
    atrPct = 2,
    normalAtrPct = 2,
    tradeType = 'swing',
  } = opts;

  // Exposure check — don't exceed max portfolio exposure
  const exposurePct = portfolioValue > 0 ? currentExposure / portfolioValue : 0;
  const remainingExposure = Math.max(0, CONFIG.maxPortfolioExposure - exposurePct);
  if (remainingExposure <= 0.02) {
    return { size: 0, confidence, sizeLabel: '0%', blocked: true, reason: `exposure limit (${(exposurePct * 100).toFixed(0)}% of ${(CONFIG.maxPortfolioExposure * 100).toFixed(0)}% max)` };
  }

  // Base size from risk budget
  let baseSize;
  if (tradeType === 'scalp' || tradeType === 'btcScalp') {
    baseSize = CONFIG.baseScalpSize;
  } else {
    baseSize = portfolioValue * CONFIG.maxRiskPerTrade;
  }

  // Signal multiplier: confidence 0.3 → 0.5x, confidence 1.0 → 1.5x
  const signalMultiplier = 0.5 + (confidence * 1.0);

  // Volatility adjustment: high ATR → scale down, low ATR → scale up
  const volatilityMultiplier = normalAtrPct > 0 && atrPct > 0
    ? Math.max(0.5, Math.min(1.5, normalAtrPct / atrPct))
    : 1.0;

  let size = baseSize * signalMultiplier * volatilityMultiplier;

  // Clamp to limits
  const maxSize = Math.min(
    portfolioValue * CONFIG.maxPositionPct,
    portfolioValue * remainingExposure,
    cashBalance
  );
  size = Math.max(CONFIG.minPositionSize, Math.min(maxSize, size));

  // BTC scalps are half-size
  if (tradeType === 'btcScalp') {
    size = size * 0.5;
  }

  // Floor check
  if (size < CONFIG.minPositionSize) {
    return { size: 0, confidence, sizeLabel: '$0', blocked: true, reason: `below min size ($${CONFIG.minPositionSize})` };
  }

  const sizePct = portfolioValue > 0 ? ((size / portfolioValue) * 100).toFixed(1) : '0';
  const sizeLabel = `$${size.toFixed(2)} (${sizePct}%)`;

  return { size: parseFloat(size.toFixed(2)), confidence, sizeLabel, blocked: false };
}

module.exports = {
  CONFIG,
  scoreScalp,
  scoreSwing,
  scoreBreakout,
  scoreBearRally,
  scoreDcaTranche,
  calculateSize,
};
