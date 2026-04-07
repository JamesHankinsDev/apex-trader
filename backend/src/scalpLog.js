// src/scalpLog.js — Structured scalp trade log shared across all three bots
// Records every scalp exit with full context. Generates daily summaries at midnight UTC.

const SPREAD_COST_PER_SIDE = 0.0005; // 0.05% estimated spread cost per side

// In-memory storage
const scalpTrades = [];    // all scalp trade records
let dailySummaries = [];   // accumulated daily summaries
let currentDay = null;     // tracks current UTC date string

/**
 * Record a scalp trade exit.
 *
 * @param {object} data
 * @param {string} data.bot - 'main' | 'exp1' | 'exp2'
 * @param {string} data.coin - e.g. 'BTC/USD'
 * @param {number} data.entryPrice
 * @param {number} data.exitPrice
 * @param {string} data.entryTime - ISO string
 * @param {string} data.exitTime - ISO string
 * @param {number} data.pnlUsd - net P&L in dollars
 * @param {number} data.pnlPct - net P&L as percentage
 * @param {string} data.exitReason - 'targetHit' | 'stopLoss' | 'timeExit' | 'rsiExit' | 'volFade' | 'upgrade' | 'btcDrop'
 * @param {number} data.smaAtEntry - 20-period SMA at entry time
 * @param {number} data.rsiAtEntry - 14-period RSI at entry time
 * @param {number} data.notional - trade size in USD
 */
function recordScalpTrade(data) {
  const entryMs = new Date(data.entryTime).getTime();
  const exitMs = new Date(data.exitTime).getTime();
  const holdSeconds = Math.round((exitMs - entryMs) / 1000);
  const spreadCost = (data.notional || 0) * SPREAD_COST_PER_SIDE * 2; // both sides

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

  // Log structured JSON to console for external log aggregation
  console.log(`[SCALP_LOG] ${JSON.stringify(record)}`);

  // Check if day rolled over
  checkDaySummary();

  // Cap in-memory storage at 500 records
  if (scalpTrades.length > 500) scalpTrades.shift();
}

/**
 * Check if UTC day has changed; if so, generate a summary for the previous day.
 */
function checkDaySummary() {
  const nowDay = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  if (currentDay && currentDay !== nowDay) {
    // Day rolled over — summarize the previous day
    const summary = generateDaySummary(currentDay);
    if (summary.totalScalps > 0) {
      dailySummaries.push(summary);
      console.log(`[SCALP_DAILY] ${JSON.stringify(summary)}`);
      // Cap summaries at 90 days
      if (dailySummaries.length > 90) dailySummaries.shift();
    }
  }
  currentDay = nowDay;
}

/**
 * Generate a summary for a specific UTC date.
 *
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @returns {object}
 */
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

  // Per-bot breakdown
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
 *
 * @returns {object} { recentTrades, todaySummary, dailySummaries }
 */
function getScalpLogStatus() {
  const today = new Date().toISOString().slice(0, 10);
  return {
    recentTrades: scalpTrades.slice(-50).reverse(), // most recent first
    todaySummary: generateDaySummary(today),
    dailySummaries: dailySummaries.slice(-30), // last 30 days
  };
}

module.exports = {
  recordScalpTrade,
  getScalpLogStatus,
};
