// src/riskMetrics.js — Shared risk metrics computation for all bots
// Computes Sharpe, Sortino, drawdown, profit factor, streaks, and avg win/loss
// from a bot's trades array and equity history.

/**
 * Compute risk metrics from a bot's trade list and equity history.
 *
 * @param {Array} trades - Array of trade objects with { pnl: number|null, ... }
 * @param {Array} equityHistory - Array of { t: timestamp, v: portfolioValue }
 * @returns {object} Risk metrics object
 */
function computeRiskMetrics(trades, equityHistory) {
  const closedTrades = (trades || []).filter(t => t.pnl != null);
  const equity = equityHistory || [];

  // Profit Factor: gross wins / gross losses
  let grossWins = 0, grossLosses = 0;
  const wins = [], losses = [];
  for (const t of closedTrades) {
    if (t.pnl > 0) { grossWins += t.pnl; wins.push(t.pnl); }
    else if (t.pnl < 0) { grossLosses += Math.abs(t.pnl); losses.push(t.pnl); }
  }
  const profitFactor = grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? Infinity : 0;
  const avgWin = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;
  const avgWinLossRatio = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : avgWin > 0 ? Infinity : 0;

  // Win/Loss Streaks (iterate oldest-first; trades are stored newest-first)
  let curStreak = 0, curStreakType = null;
  let maxWinStreak = 0, maxLossStreak = 0;
  for (let i = closedTrades.length - 1; i >= 0; i--) {
    const isWin = closedTrades[i].pnl > 0;
    const type = isWin ? 'win' : 'loss';
    if (type === curStreakType) { curStreak++; }
    else { curStreak = 1; curStreakType = type; }
    if (isWin && curStreak > maxWinStreak) maxWinStreak = curStreak;
    if (!isWin && curStreak > maxLossStreak) maxLossStreak = curStreak;
  }

  // Max Drawdown from equity history
  let maxDrawdown = 0, maxDrawdownPct = 0;
  let peak = 0;
  for (const pt of equity) {
    if (pt.v > peak) peak = pt.v;
    const dd = peak - pt.v;
    if (dd > maxDrawdown) {
      maxDrawdown = dd;
      maxDrawdownPct = peak > 0 ? (dd / peak) * 100 : 0;
    }
  }

  // Sharpe & Sortino from equity returns
  let sharpeRatio = null, sortinoRatio = null;
  if (equity.length >= 3) {
    const returns = [];
    for (let i = 1; i < equity.length; i++) {
      if (equity[i - 1].v > 0) {
        returns.push((equity[i].v - equity[i - 1].v) / equity[i - 1].v);
      }
    }
    if (returns.length >= 2) {
      const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + (r - meanReturn) ** 2, 0) / returns.length;
      const stdDev = Math.sqrt(variance);

      // Annualize based on actual interval between data points
      const intervalsPerYear = (365 * 24 * 3600 * 1000) /
        ((equity[equity.length - 1].t - equity[0].t) / (equity.length - 1) || 60000);
      const annualizedReturn = meanReturn * intervalsPerYear;
      const annualizedStd = stdDev * Math.sqrt(intervalsPerYear);
      const riskFreeRate = 0.05; // 5% annual

      sharpeRatio = annualizedStd > 0 ? (annualizedReturn - riskFreeRate) / annualizedStd : 0;

      // Sortino: only downside deviation
      const downsideReturns = returns.filter(r => r < 0);
      if (downsideReturns.length > 0) {
        const downsideVariance = downsideReturns.reduce((sum, r) => sum + r ** 2, 0) / returns.length;
        const downsideDev = Math.sqrt(downsideVariance) * Math.sqrt(intervalsPerYear);
        sortinoRatio = downsideDev > 0 ? (annualizedReturn - riskFreeRate) / downsideDev : 0;
      } else {
        sortinoRatio = annualizedReturn > riskFreeRate ? Infinity : 0;
      }
    }
  }

  return {
    profitFactor: isFinite(profitFactor) ? parseFloat(profitFactor.toFixed(2)) : null,
    avgWin: parseFloat(avgWin.toFixed(2)),
    avgLoss: parseFloat(avgLoss.toFixed(2)),
    avgWinLossRatio: isFinite(avgWinLossRatio) ? parseFloat(avgWinLossRatio.toFixed(2)) : null,
    maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
    maxDrawdownPct: parseFloat(maxDrawdownPct.toFixed(2)),
    sharpeRatio: sharpeRatio != null && isFinite(sharpeRatio) ? parseFloat(sharpeRatio.toFixed(2)) : null,
    sortinoRatio: sortinoRatio != null && isFinite(sortinoRatio) ? parseFloat(sortinoRatio.toFixed(2)) : null,
    currentStreak: curStreak,
    currentStreakType: curStreakType,
    maxWinStreak,
    maxLossStreak,
  };
}

module.exports = { computeRiskMetrics };
