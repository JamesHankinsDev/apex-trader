// src/experimentScorer.js — Composite scoring of experiment bots
// Evaluates each experiment on 5 metrics and selects the winner
// for the live trader to mirror automatically.

const { getPerformanceStats } = require('./performance');

// ─── Scoring weights ─────────────────────────────────────────
// Total = 1.0. Tuned to balance growth with risk-adjusted returns.
const WEIGHTS = {
  winRate: 0.20,          // consistency
  portfolioGrowth: 0.25,  // raw returns
  sharpe: 0.25,           // risk-adjusted returns (total volatility)
  sortino: 0.20,          // risk-adjusted returns (downside only)
  tradeCount: 0.10,       // statistical significance — more trades = more reliable
};

// ─── Minimum thresholds to be eligible ───────────────────────
const MIN_TRADES = 100;   // need 100+ trades before live trader will adopt
const REQUIRE_POSITIVE = true; // portfolio must be net positive to qualify
const EVAL_INTERVAL_MS = 5 * 60 * 1000; // re-evaluate every 5 minutes

// ─── State ───────────────────────────────────────────────────
let currentWinner = null;   // 'main' | 'exp1' | 'exp2'
let lastEvaluation = null;  // full evaluation result
let lastEvalTime = 0;

/**
 * Normalize a value to 0-1 range given min/max bounds.
 * Clamps to [0, 1].
 */
function normalize(value, min, max) {
  if (value == null || !isFinite(value)) return 0;
  if (max === min) return value >= max ? 1 : 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/**
 * Compute the composite experiment score for a bot.
 * Returns { score, breakdown, eligible, stats }
 */
function scoreBot(botKey) {
  const stats = getPerformanceStats(botKey);

  // Eligibility: minimum trade count
  if (stats.totalTrades < MIN_TRADES) {
    return {
      score: 0,
      breakdown: {},
      eligible: false,
      reason: `${stats.totalTrades}/${MIN_TRADES} trades — holding cash`,
      stats,
    };
  }

  // Eligibility: portfolio must be net positive
  if (REQUIRE_POSITIVE && stats.totalReturnPct <= 0) {
    return {
      score: 0,
      breakdown: {},
      eligible: false,
      reason: `portfolio ${stats.totalReturnPct.toFixed(1)}% — must be positive to qualify`,
      stats,
    };
  }

  // Normalize each metric to 0-1
  // Win rate: 30% = 0, 70% = 1
  const winRateScore = normalize(stats.winRate, 30, 70);

  // Portfolio growth: -20% = 0, +30% = 1
  const growthScore = normalize(stats.totalReturnPct, -20, 30);

  // Sharpe: -1 = 0, 3 = 1
  const sharpeScore = normalize(stats.sharpeRatio, -1, 3);

  // Sortino: -1 = 0, 4 = 1
  const sortinoScore = normalize(stats.sortinoRatio, -1, 4);

  // Trade count: 5 = 0, 50 = 1 (more trades = more statistical significance)
  const tradeCountScore = normalize(stats.totalTrades, 5, 50);

  const breakdown = {
    winRate: parseFloat((winRateScore * WEIGHTS.winRate * 100).toFixed(1)),
    portfolioGrowth: parseFloat((growthScore * WEIGHTS.portfolioGrowth * 100).toFixed(1)),
    sharpe: parseFloat((sharpeScore * WEIGHTS.sharpe * 100).toFixed(1)),
    sortino: parseFloat((sortinoScore * WEIGHTS.sortino * 100).toFixed(1)),
    tradeCount: parseFloat((tradeCountScore * WEIGHTS.tradeCount * 100).toFixed(1)),
  };

  const score = parseFloat((
    winRateScore * WEIGHTS.winRate +
    growthScore * WEIGHTS.portfolioGrowth +
    sharpeScore * WEIGHTS.sharpe +
    sortinoScore * WEIGHTS.sortino +
    tradeCountScore * WEIGHTS.tradeCount
  ).toFixed(4));

  return { score: parseFloat((score * 100).toFixed(1)), breakdown, eligible: true, stats };
}

/**
 * Evaluate all three experiments and determine the winner.
 * Caches result for EVAL_INTERVAL_MS.
 *
 * @returns {{ winner, scores, evaluatedAt }}
 */
function evaluate() {
  // Use cached result if recent enough
  if (lastEvaluation && (Date.now() - lastEvalTime) < EVAL_INTERVAL_MS) {
    return lastEvaluation;
  }

  const scores = {
    main: scoreBot('main'),
    exp1: scoreBot('exp1'),
    exp2: scoreBot('exp2'),
  };

  // Find the eligible bot with the highest score
  let winner = null;
  let highestScore = -1;

  for (const [key, result] of Object.entries(scores)) {
    if (result.eligible && result.score > highestScore) {
      highestScore = result.score;
      winner = key;
    }
  }

  const prevWinner = currentWinner;
  currentWinner = winner;

  if (winner && winner !== prevWinner) {
    const winnerLabel = { main: 'Exp 1', exp1: 'Exp 2', exp2: 'Exp 3' }[winner];
    console.log(`[EXPERIMENT_SCORER] New winner: ${winnerLabel} (score ${highestScore.toFixed(1)}) — live trader will mirror this strategy`);
  } else if (!winner && prevWinner) {
    console.log(`[EXPERIMENT_SCORER] No eligible winner — live trader holding cash (need ${MIN_TRADES}+ trades with positive portfolio)`);
  }

  lastEvaluation = {
    winner,
    winnerLabel: winner ? { main: 'Experiment 1', exp1: 'Experiment 2', exp2: 'Experiment 3' }[winner] : null,
    scores,
    evaluatedAt: new Date().toISOString(),
  };
  lastEvalTime = Date.now();

  return lastEvaluation;
}

/**
 * Get the current winner's bot key.
 * @returns {string|null} 'main' | 'exp1' | 'exp2' | null
 */
function getWinner() {
  if (!lastEvaluation) evaluate();
  return currentWinner;
}

/**
 * Get full evaluation for the dashboard.
 */
function getEvaluation() {
  return evaluate();
}

module.exports = {
  evaluate,
  getWinner,
  getEvaluation,
  scoreBot,
  WEIGHTS,
};
