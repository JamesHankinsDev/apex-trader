// src/scalpLog.js — Structured scalp trade log shared across all three bots
// Records every scalp exit with full context. Generates daily summaries at midnight UTC.
// Tracks per-coin win rates and auto-disables underperforming coins.

const SPREAD_COST_PER_SIDE = 0.0005; // 0.05% estimated spread cost per side

// ─── Per-coin win rate tracking ──────────────────────────────
const MIN_TRADES_FOR_DISABLE = 20;   // need this many trades before evaluating
const MIN_WIN_RATE = 0.40;           // disable coin if win rate falls below 40%
const coinStats = new Map();         // coin -> { wins, losses, totalPnl, disabled, disabledAt }

// In-memory storage
const scalpTrades = [];    // all scalp trade records
const featureSnapshots = []; // entry-time feature snapshots for ML readiness
let dailySummaries = [];   // accumulated daily summaries
let currentDay = null;     // tracks current UTC date string

/**
 * Record a scalp trade exit.
 */
function recordScalpTrade(data) {
  const entryMs = new Date(data.entryTime).getTime();
  const exitMs = new Date(data.exitTime).getTime();
  const holdSeconds = Math.round((exitMs - entryMs) / 1000);
  const spreadCost = (data.notional || 0) * SPREAD_COST_PER_SIDE * 2;

  const record = {
    bot: data.bot,
    coin: data.coin,
    entryPrice: data.entryPrice,
    exitPrice: data.exitPrice,
    entryTime: data.entryTime,
    exitTime: data.exitTime,
    holdSeconds,
    pnlUsd: data.pnlUsd,
    pnlPct: data.pnlPct,
    exitReason: data.exitReason,
    smaAtEntry: data.smaAtEntry,
    rsiAtEntry: data.rsiAtEntry,
    notional: data.notional || 0,
    spreadCost: parseFloat(spreadCost.toFixed(4)),
    recordedAt: Date.now(),
  };

  scalpTrades.push(record);
  console.log(`[SCALP_LOG] ${JSON.stringify(record)}`);

  // Update per-coin stats
  updateCoinStats(data.coin, data.pnlUsd > 0);

  checkDaySummary();
  if (scalpTrades.length > 500) scalpTrades.shift();
}

/**
 * Record a feature snapshot at scalp entry time (for ML training data).
 */
function recordFeatureSnapshot(data) {
  const snapshot = {
    bot: data.bot,
    coin: data.coin,
    timestamp: data.timestamp || new Date().toISOString(),
    price: data.price,
    sma20: data.sma20,
    rsi14: data.rsi14,
    smaDipPct: data.smaDipPct,
    expectedNetPct: data.expectedNetPct,
    regime: data.regime,
    regimeState: data.regimeState,
    fearGreed: data.fearGreed,
    btcPrice: data.btcPrice,
    btcGateOpen: data.btcGateOpen,
    volumeRatio: data.volumeRatio,
    hourOfDay: new Date().getUTCHours(),
    dayOfWeek: new Date().getUTCDay(),
  };

  featureSnapshots.push(snapshot);
  console.log(`[FEATURE_SNAP] ${JSON.stringify(snapshot)}`);

  // Cap at 1000 snapshots
  if (featureSnapshots.length > 1000) featureSnapshots.shift();
}

// ─── Per-coin win rate tracking ──────────────────────────────

function updateCoinStats(coin, isWin) {
  if (!coinStats.has(coin)) {
    coinStats.set(coin, { wins: 0, losses: 0, totalPnl: 0, disabled: false, disabledAt: null });
  }
  const stats = coinStats.get(coin);
  if (isWin) stats.wins++;
  else stats.losses++;

  const total = stats.wins + stats.losses;
  const winRate = total > 0 ? stats.wins / total : 0;

  // Check for auto-disable
  if (total >= MIN_TRADES_FOR_DISABLE && winRate < MIN_WIN_RATE && !stats.disabled) {
    stats.disabled = true;
    stats.disabledAt = new Date().toISOString();
    console.log(`[SCALP_COIN_DISABLE] ${coin} disabled — win rate ${(winRate * 100).toFixed(1)}% over ${total} trades (below ${MIN_WIN_RATE * 100}% threshold)`);
  }

  // Re-enable if performance recovers (check last 10 trades)
  if (stats.disabled && total >= MIN_TRADES_FOR_DISABLE + 10) {
    const recentTrades = scalpTrades.filter(t => t.coin === coin).slice(-10);
    const recentWins = recentTrades.filter(t => t.pnlUsd > 0).length;
    if (recentWins >= 6) { // 60%+ WR in last 10 trades = re-enable
      stats.disabled = false;
      stats.disabledAt = null;
      console.log(`[SCALP_COIN_REENABLE] ${coin} re-enabled — recent win rate ${recentWins}/10 (recovered above threshold)`);
    }
  }
}

/**
 * Check if a coin is disabled for scalping.
 * @param {string} coin - e.g. 'BTC/USD'
 * @returns {boolean}
 */
function isCoinDisabled(coin) {
  const stats = coinStats.get(coin);
  return stats?.disabled || false;
}

/**
 * Get all coin stats for the dashboard.
 * @returns {object} { coin: { wins, losses, winRate, disabled, total } }
 */
function getCoinStats() {
  const result = {};
  for (const [coin, stats] of coinStats) {
    const total = stats.wins + stats.losses;
    result[coin] = {
      wins: stats.wins,
      losses: stats.losses,
      total,
      winRate: total > 0 ? parseFloat(((stats.wins / total) * 100).toFixed(1)) : 0,
      disabled: stats.disabled,
      disabledAt: stats.disabledAt,
    };
  }
  return result;
}

// ─── Daily summary ───────────────────────────────────────────

function checkDaySummary() {
  const nowDay = new Date().toISOString().slice(0, 10);
  if (currentDay && currentDay !== nowDay) {
    const summary = generateDaySummary(currentDay);
    if (summary.totalScalps > 0) {
      dailySummaries.push(summary);
      console.log(`[SCALP_DAILY] ${JSON.stringify(summary)}`);
      if (dailySummaries.length > 90) dailySummaries.shift();
    }
  }
  currentDay = nowDay;
}

function generateDaySummary(dateStr) {
  const dayTrades = scalpTrades.filter(t => t.exitTime?.startsWith(dateStr));

  if (dayTrades.length === 0) {
    return { date: dateStr, totalScalps: 0 };
  }

  const wins = dayTrades.filter(t => t.pnlUsd > 0);
  const losses = dayTrades.filter(t => t.pnlUsd <= 0);
  const winRate = (wins.length / dayTrades.length) * 100;
  const avgPnlPct = dayTrades.reduce((s, t) => s + t.pnlPct, 0) / dayTrades.length;
  const totalPnlUsd = dayTrades.reduce((s, t) => s + t.pnlUsd, 0);
  const totalSpreadCost = dayTrades.reduce((s, t) => s + t.spreadCost, 0);

  const best = dayTrades.reduce((b, t) => t.pnlUsd > b.pnlUsd ? t : b, dayTrades[0]);
  const worst = dayTrades.reduce((w, t) => t.pnlUsd < w.pnlUsd ? t : w, dayTrades[0]);

  const byBot = {};
  for (const t of dayTrades) {
    if (!byBot[t.bot]) byBot[t.bot] = { count: 0, pnlUsd: 0, wins: 0 };
    byBot[t.bot].count++;
    byBot[t.bot].pnlUsd += t.pnlUsd;
    if (t.pnlUsd > 0) byBot[t.bot].wins++;
  }

  return {
    date: dateStr,
    totalScalps: dayTrades.length,
    wins: wins.length,
    losses: losses.length,
    winRatePct: parseFloat(winRate.toFixed(1)),
    avgPnlPct: parseFloat(avgPnlPct.toFixed(3)),
    totalPnlUsd: parseFloat(totalPnlUsd.toFixed(2)),
    totalSpreadCost: parseFloat(totalSpreadCost.toFixed(4)),
    bestTrade: { coin: best.coin, bot: best.bot, pnlUsd: best.pnlUsd, pnlPct: best.pnlPct },
    worstTrade: { coin: worst.coin, bot: worst.bot, pnlUsd: worst.pnlUsd, pnlPct: worst.pnlPct },
    byBot,
  };
}

/**
 * Get scalp log data for the dashboard API.
 */
function getScalpLogStatus() {
  const today = new Date().toISOString().slice(0, 10);
  return {
    recentTrades: scalpTrades.slice(-50).reverse(),
    todaySummary: generateDaySummary(today),
    dailySummaries: dailySummaries.slice(-30),
    coinStats: getCoinStats(),
    featureSnapshots: featureSnapshots.slice(-20).reverse(),
  };
}

module.exports = {
  recordScalpTrade,
  recordFeatureSnapshot,
  isCoinDisabled,
  getCoinStats,
  getScalpLogStatus,
};
