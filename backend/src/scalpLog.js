// src/scalpLog.js — Structured scalp trade log shared across all three bots
// Records every scalp exit with full context. Generates daily summaries at midnight UTC.
// Tracks per-coin win rates and auto-disables underperforming coins.
// Persists to disk so data survives restarts/deploys.

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '..', '.scalp-log-state.json');
const SPREAD_COST_PER_SIDE = 0.0005;

// ─── Per-coin win rate tracking ──────────────────────────────
const MIN_TRADES_FOR_DISABLE = 20;
const MIN_WIN_RATE = 0.40;

// ─── State (loaded from disk on startup) ─────────────────────
let state = loadState();

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      return {
        scalpTrades: raw.scalpTrades || [],
        featureSnapshots: raw.featureSnapshots || [],
        dailySummaries: raw.dailySummaries || [],
        coinStats: new Map(Object.entries(raw.coinStats || {})),
        currentDay: raw.currentDay || null,
      };
    }
  } catch (err) {
    console.log(`[SCALP_LOG] Failed to load state: ${err.message} — starting fresh`);
  }
  return {
    scalpTrades: [],
    featureSnapshots: [],
    dailySummaries: [],
    coinStats: new Map(),
    currentDay: null,
  };
}

function saveState() {
  try {
    const serializable = {
      scalpTrades: state.scalpTrades,
      featureSnapshots: state.featureSnapshots,
      dailySummaries: state.dailySummaries,
      coinStats: Object.fromEntries(state.coinStats),
      currentDay: state.currentDay,
    };
    fs.writeFileSync(STATE_FILE, JSON.stringify(serializable, null, 2));
  } catch (err) {
    console.log(`[SCALP_LOG] Failed to save state: ${err.message}`);
  }
}

// Debounce saves — don't write on every single trade
let saveTimer = null;
function debouncedSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveState, 5000); // save 5s after last write
}

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

  state.scalpTrades.push(record);
  console.log(`[SCALP_LOG] ${JSON.stringify(record)}`);

  updateCoinStats(data.coin, data.pnlUsd > 0);
  checkDaySummary();
  if (state.scalpTrades.length > 500) state.scalpTrades.shift();
  debouncedSave();
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

  state.featureSnapshots.push(snapshot);
  console.log(`[FEATURE_SNAP] ${JSON.stringify(snapshot)}`);
  if (state.featureSnapshots.length > 1000) state.featureSnapshots.shift();
  debouncedSave();
}

// ─── Per-coin win rate tracking ──────────────────────────────

function updateCoinStats(coin, isWin) {
  if (!state.coinStats.has(coin)) {
    state.coinStats.set(coin, { wins: 0, losses: 0, disabled: false, disabledAt: null });
  }
  const stats = state.coinStats.get(coin);
  if (isWin) stats.wins++;
  else stats.losses++;

  const total = stats.wins + stats.losses;
  const winRate = total > 0 ? stats.wins / total : 0;

  if (total >= MIN_TRADES_FOR_DISABLE && winRate < MIN_WIN_RATE && !stats.disabled) {
    stats.disabled = true;
    stats.disabledAt = new Date().toISOString();
    console.log(`[SCALP_COIN_DISABLE] ${coin} disabled — win rate ${(winRate * 100).toFixed(1)}% over ${total} trades`);
  }

  if (stats.disabled && total >= MIN_TRADES_FOR_DISABLE + 10) {
    const recentTrades = state.scalpTrades.filter(t => t.coin === coin).slice(-10);
    const recentWins = recentTrades.filter(t => t.pnlUsd > 0).length;
    if (recentWins >= 6) {
      stats.disabled = false;
      stats.disabledAt = null;
      console.log(`[SCALP_COIN_REENABLE] ${coin} re-enabled — recent win rate ${recentWins}/10`);
    }
  }
}

function isCoinDisabled(coin) {
  return state.coinStats.get(coin)?.disabled || false;
}

function getCoinStats() {
  const result = {};
  for (const [coin, stats] of state.coinStats) {
    const total = stats.wins + stats.losses;
    result[coin] = {
      wins: stats.wins, losses: stats.losses, total,
      winRate: total > 0 ? parseFloat(((stats.wins / total) * 100).toFixed(1)) : 0,
      disabled: stats.disabled, disabledAt: stats.disabledAt,
    };
  }
  return result;
}

// ─── Daily summary ───────────────────────────────────────────

function checkDaySummary() {
  const nowDay = new Date().toISOString().slice(0, 10);
  if (state.currentDay && state.currentDay !== nowDay) {
    const summary = generateDaySummary(state.currentDay);
    if (summary.totalScalps > 0) {
      state.dailySummaries.push(summary);
      console.log(`[SCALP_DAILY] ${JSON.stringify(summary)}`);
      if (state.dailySummaries.length > 90) state.dailySummaries.shift();
    }
  }
  state.currentDay = nowDay;
}

function generateDaySummary(dateStr) {
  const dayTrades = state.scalpTrades.filter(t => t.exitTime?.startsWith(dateStr));
  if (dayTrades.length === 0) return { date: dateStr, totalScalps: 0 };

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
    date: dateStr, totalScalps: dayTrades.length,
    wins: wins.length, losses: losses.length,
    winRatePct: parseFloat(winRate.toFixed(1)),
    avgPnlPct: parseFloat(avgPnlPct.toFixed(3)),
    totalPnlUsd: parseFloat(totalPnlUsd.toFixed(2)),
    totalSpreadCost: parseFloat(totalSpreadCost.toFixed(4)),
    bestTrade: { coin: best.coin, bot: best.bot, pnlUsd: best.pnlUsd, pnlPct: best.pnlPct },
    worstTrade: { coin: worst.coin, bot: worst.bot, pnlUsd: worst.pnlUsd, pnlPct: worst.pnlPct },
    byBot,
  };
}

function getScalpLogStatus() {
  const today = new Date().toISOString().slice(0, 10);
  return {
    recentTrades: state.scalpTrades.slice(-50).reverse(),
    todaySummary: generateDaySummary(today),
    dailySummaries: state.dailySummaries.slice(-30),
    coinStats: getCoinStats(),
    featureSnapshots: state.featureSnapshots.slice(-20).reverse(),
  };
}

module.exports = {
  recordScalpTrade,
  recordFeatureSnapshot,
  isCoinDisabled,
  getCoinStats,
  getScalpLogStatus,
};
