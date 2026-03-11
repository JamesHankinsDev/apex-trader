// src/performance.js - Cross-bot performance tracking module
// Data flows one way: bots call recordTrade(), never the reverse.

const STARTING_BALANCE = 100;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// In-memory storage per bot
const tradeHistory = new Map(); // bot -> [trade]
const balances = new Map();     // bot -> { current, starting }

// Weekly snapshots
const weeklySnapshots = [];
let firstTradeTime = null;
let lastSnapshotWeek = 0;

/**
 * Record a completed trade for a bot.
 *
 * @param {object} tradeData
 * @param {string} tradeData.bot - 'main' | 'exp1' | 'exp2'
 * @param {string} tradeData.coin - Symbol
 * @param {number} tradeData.entryPrice
 * @param {number} tradeData.exitPrice
 * @param {string} tradeData.entryTime
 * @param {string} tradeData.exitTime
 * @param {number} tradeData.pnlPct - Percentage gain/loss
 * @param {number} tradeData.pnlUsd - Dollar gain/loss
 * @param {string} tradeData.exitReason - 'takeProfit' | 'stopLoss' | 'timeExit' | 'exhaustion' | 'gateReopen'
 * @param {string} tradeData.regime - 'bull' | 'bear'
 * @param {string} tradeData.type - Strategy type that triggered entry
 */
function recordTrade(tradeData) {
  const { bot } = tradeData;
  if (!bot) return;

  if (!tradeHistory.has(bot)) {
    tradeHistory.set(bot, []);
  }
  tradeHistory.get(bot).push({
    ...tradeData,
    recordedAt: Date.now(),
  });

  // Track first trade time for weekly snapshots
  if (!firstTradeTime) {
    firstTradeTime = Date.now();
  }

  // Check if a weekly snapshot is due
  checkWeeklySnapshot();
}

/**
 * Update a bot's current balance.
 */
function updateBalance(bot, currentBalance) {
  if (!balances.has(bot)) {
    balances.set(bot, { current: currentBalance, starting: STARTING_BALANCE });
  } else {
    balances.get(bot).current = currentBalance;
  }
}

/**
 * Get performance stats for a bot.
 *
 * @param {string} bot - 'main' | 'exp1' | 'exp2'
 * @returns {object} Performance stats
 */
function getPerformanceStats(bot) {
  const trades = tradeHistory.get(bot) || [];
  const balance = balances.get(bot) || { current: STARTING_BALANCE, starting: STARTING_BALANCE };

  const totalReturnUsd = balance.current - STARTING_BALANCE;
  const totalReturnPct = (totalReturnUsd / STARTING_BALANCE) * 100;

  // Win/loss breakdown
  const wins = trades.filter(t => t.pnlUsd > 0);
  const losses = trades.filter(t => t.pnlUsd <= 0);
  const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;

  const avgWinPct = wins.length > 0
    ? wins.reduce((sum, t) => sum + t.pnlPct, 0) / wins.length
    : 0;
  const avgLossPct = losses.length > 0
    ? losses.reduce((sum, t) => sum + t.pnlPct, 0) / losses.length
    : 0;
  const riskRewardRatio = avgLossPct !== 0
    ? Math.abs(avgWinPct / avgLossPct)
    : avgWinPct > 0 ? Infinity : 0;

  // Bull/bear breakdown
  const bullTrades = trades.filter(t => t.regime === 'bull');
  const bearTrades = trades.filter(t => t.regime === 'bear');
  const bullReturnPct = bullTrades.reduce((sum, t) => sum + t.pnlPct, 0);
  const bearReturnPct = bearTrades.reduce((sum, t) => sum + t.pnlPct, 0);

  // Max drawdown from trade P&L sequence
  let maxDrawdownPct = 0;
  let peak = STARTING_BALANCE;
  let equity = STARTING_BALANCE;
  for (const t of trades) {
    equity += t.pnlUsd;
    if (equity > peak) peak = equity;
    const dd = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
    if (dd > maxDrawdownPct) maxDrawdownPct = dd;
  }

  // Sharpe ratio (simplified daily)
  const sharpeRatio = calculateSharpe(trades);

  return {
    totalReturnPct: parseFloat(totalReturnPct.toFixed(2)),
    totalReturnUsd: parseFloat(totalReturnUsd.toFixed(2)),
    winRate: parseFloat(winRate.toFixed(1)),
    avgWinPct: parseFloat(avgWinPct.toFixed(2)),
    avgLossPct: parseFloat(avgLossPct.toFixed(2)),
    riskRewardRatio: isFinite(riskRewardRatio) ? parseFloat(riskRewardRatio.toFixed(2)) : null,
    totalTrades: trades.length,
    bullTrades: bullTrades.length,
    bearTrades: bearTrades.length,
    bullReturnPct: parseFloat(bullReturnPct.toFixed(2)),
    bearReturnPct: parseFloat(bearReturnPct.toFixed(2)),
    maxDrawdownPct: parseFloat(maxDrawdownPct.toFixed(2)),
    sharpeRatio,
    currentBalance: balance.current,
    startingBalance: STARTING_BALANCE,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Simplified daily Sharpe with 0% risk-free rate.
 */
function calculateSharpe(trades) {
  if (trades.length === 0) return null;

  // Group trades by day
  const dailyReturns = new Map();
  for (const t of trades) {
    const day = new Date(t.exitTime).toDateString();
    if (!dailyReturns.has(day)) dailyReturns.set(day, 0);
    dailyReturns.set(day, dailyReturns.get(day) + t.pnlPct);
  }

  const days = Array.from(dailyReturns.values());
  if (days.length < 7) return null;

  const mean = days.reduce((a, b) => a + b, 0) / days.length;
  const variance = days.reduce((sum, r) => sum + (r - mean) ** 2, 0) / days.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return null;

  const sharpe = (mean / stdDev) * Math.sqrt(365);
  return parseFloat(sharpe.toFixed(2));
}

/**
 * Check and create weekly snapshots if due.
 */
function checkWeeklySnapshot() {
  if (!firstTradeTime) return;

  const elapsed = Date.now() - firstTradeTime;
  const currentWeek = Math.floor(elapsed / WEEK_MS);

  if (currentWeek > lastSnapshotWeek || (currentWeek === 0 && weeklySnapshots.length === 0 && elapsed >= WEEK_MS)) {
    // Take snapshot for all weeks we missed
    while (lastSnapshotWeek < currentWeek) {
      lastSnapshotWeek++;
      weeklySnapshots.push({
        week: lastSnapshotWeek,
        timestamp: new Date().toISOString(),
        main: getPerformanceStats('main'),
        exp1: getPerformanceStats('exp1'),
        exp2: getPerformanceStats('exp2'),
      });
    }
  }
}

/**
 * Get all weekly snapshots.
 */
function getWeeklySnapshots() {
  return weeklySnapshots;
}

module.exports = {
  recordTrade,
  updateBalance,
  getPerformanceStats,
  getWeeklySnapshots,
};
