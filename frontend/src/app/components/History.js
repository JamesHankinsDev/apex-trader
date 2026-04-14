import { useMemo, useState } from "react";
import styles from "../page.module.css";
import { fmt$ } from "./helpers";

const BOTS = [
  { key: "main", label: "Exp 1 (Momentum)", color: "#00ff88" },
  { key: "exp1", label: "Exp 2 (Scalping)", color: "#4488ff" },
  { key: "exp2", label: "Exp 3 (Breakout)", color: "#ff9900" },
];

const EXIT_REASON_COLORS = {
  targetHit: "var(--green)",
  stopLoss: "var(--red)",
  timeExit: "var(--yellow)",
  other: "var(--dim)",
};

const EXIT_REASON_LABELS = {
  targetHit: "Target",
  stopLoss: "Stop",
  timeExit: "Time",
  other: "Other",
};

// Normalize a raw reason string into one of our 4 buckets.
function categorizeReason(reason) {
  if (!reason) return "other";
  const r = String(reason).toLowerCase();
  if (r.includes("target") || r.includes("take profit") || r.includes("tp") || r.includes("sma revers") || r.includes("reversion")) return "targetHit";
  if (r.includes("stop") || r.includes("sl")) return "stopLoss";
  if (r.includes("time") || r.includes("giveback") || r.includes("profit protect") || r.includes("gate reopen")) return "timeExit";
  return "other";
}

// Normalize a bot's status.trades SELL record into the unified shape used by History.
function normalizeBotTrade(botKey, sellTrade, allBotTrades) {
  // Find the paired BUY to get entryTime (for time-of-day analysis)
  const buy = allBotTrades.find(t =>
    t.side === "BUY" &&
    t.symbol === sellTrade.symbol &&
    new Date(t.time).getTime() <= new Date(sellTrade.time).getTime()
  );
  const entryPrice = buy?.price || 0;
  const exitPrice = sellTrade.price;
  const pnlPct = entryPrice > 0 ? ((exitPrice - entryPrice) / entryPrice) * 100 : 0;

  return {
    bot: botKey,
    coin: sellTrade.symbol,
    type: sellTrade.type || "unknown",
    pnlUsd: sellTrade.pnl || 0,
    pnlPct,
    exitReason: categorizeReason(sellTrade.reason),
    rawReason: sellTrade.reason,
    exitTime: sellTrade.time,
    entryTime: buy?.time || sellTrade.time,
    notional: sellTrade.notional || 0,
  };
}

// Normalize scalp trades from scalpLog into the same shape.
function normalizeScalpTrade(t) {
  return {
    bot: t.bot,
    coin: t.coin,
    type: "scalp",
    pnlUsd: t.pnlUsd || 0,
    pnlPct: t.pnlPct || 0,
    exitReason: t.exitReason || "other",
    rawReason: t.exitReason,
    exitTime: t.exitTime,
    entryTime: t.entryTime,
    notional: t.notional || 0,
  };
}

// Build a unified trades list from scalpLog + all 3 bot statuses.
// De-duplicates scalps by (bot+symbol+exitTime) since scalp closes also appear in status.trades.
function buildUnifiedTrades(scalpLog, statuses) {
  const unified = [];
  const scalpKeys = new Set();

  // Add scalp log entries (rich data)
  const scalpTrades = scalpLog?.recentTrades || [];
  for (const t of scalpTrades) {
    const norm = normalizeScalpTrade(t);
    unified.push(norm);
    // Dedupe key: bot|coin|exitTime
    scalpKeys.add(`${norm.bot}|${norm.coin}|${norm.exitTime}`);
  }

  // Add non-scalp trades from each bot's status.trades
  for (const { key, status } of statuses) {
    if (!status?.trades) continue;
    const botTrades = status.trades;
    for (const t of botTrades) {
      if (t.side !== "SELL" || t.pnl == null) continue;
      // Skip if this is a scalp exit already captured in scalpLog
      const dedupeKey = `${key}|${t.symbol}|${t.time}`;
      if (scalpKeys.has(dedupeKey)) continue;
      // Skip scalp-typed trades from bot status (scalpLog is authoritative for those)
      if (t.type === "scalp" || t.type === "btc-scalp") continue;
      unified.push(normalizeBotTrade(key, t, botTrades));
    }
  }

  return unified;
}

// ─── Type filter chips ──────────────────────────────────────
function TypeFilter({ activeType, setActiveType, typeCounts }) {
  const types = [
    { key: "all", label: "All" },
    { key: "scalp", label: "Scalps" },
    { key: "swing", label: "Swings" },
    { key: "breakout", label: "Breakouts" },
    { key: "bear", label: "Bear" },
  ];
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
      {types.map(t => {
        const count = typeCounts[t.key] || 0;
        const active = activeType === t.key;
        return (
          <button
            key={t.key}
            onClick={() => setActiveType(t.key)}
            style={{
              padding: "6px 12px",
              fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 1,
              border: `1px solid ${active ? "#4488ff" : "var(--border)"}`,
              borderRadius: 4, cursor: "pointer",
              background: active ? "rgba(68,136,255,0.15)" : "transparent",
              color: active ? "#4488ff" : "var(--dim)",
              textTransform: "uppercase",
            }}
          >
            {t.label} ({count})
          </button>
        );
      })}
    </div>
  );
}

// ─── Readiness Banner ───────────────────────────────────────
function ReadinessBanner({ scalpCount, nonScalpCount }) {
  const SCALP_TARGET = 50;
  const SWING_TARGET = 50;
  const scalpReady = scalpCount >= SCALP_TARGET;
  const swingReady = nonScalpCount >= SWING_TARGET;

  const scalpPct = Math.min(100, (scalpCount / SCALP_TARGET) * 100);
  const swingPct = Math.min(100, (nonScalpCount / SWING_TARGET) * 100);

  let status, statusColor;
  if (scalpReady && swingReady) {
    status = "Ready to tune both strategies";
    statusColor = "var(--green)";
  } else if (scalpReady) {
    status = "Ready to tune scalps — keep collecting swing/breakout data";
    statusColor = "var(--yellow)";
  } else if (swingReady) {
    status = "Ready to tune swings/breakouts — keep collecting scalp data";
    statusColor = "var(--yellow)";
  } else {
    status = "Keep collecting data — sample size too small to tune";
    statusColor = "var(--dim)";
  }

  return (
    <div style={{
      padding: 14, background: "rgba(255,255,255,0.02)",
      border: "1px solid var(--border)", borderRadius: 6, marginBottom: 20,
    }}>
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 2,
        color: statusColor, marginBottom: 12, textTransform: "uppercase",
      }}>
        Tuning Readiness — {status}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--dim)" }}>SCALPS</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: scalpReady ? "var(--green)" : "var(--dim)" }}>
              {scalpCount} / {SCALP_TARGET}
            </span>
          </div>
          <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${scalpPct}%`, height: "100%", background: scalpReady ? "var(--green)" : "var(--blue)" }} />
          </div>
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--dim)" }}>SWINGS / BREAKOUTS</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: swingReady ? "var(--green)" : "var(--dim)" }}>
              {nonScalpCount} / {SWING_TARGET}
            </span>
          </div>
          <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${swingPct}%`, height: "100%", background: swingReady ? "var(--green)" : "var(--blue)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Exit Reason Breakdown ──────────────────────────────────
function ExitReasonBreakdown({ trades }) {
  const perBot = useMemo(() => {
    const out = {};
    for (const bot of BOTS) {
      const botTrades = trades.filter(t => t.bot === bot.key);
      const total = botTrades.length;
      const reasons = { targetHit: 0, stopLoss: 0, timeExit: 0, other: 0 };
      for (const t of botTrades) {
        reasons[t.exitReason] = (reasons[t.exitReason] || 0) + 1;
      }
      out[bot.key] = { total, reasons };
    }
    return out;
  }, [trades]);

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: 2, color: "var(--text)", marginBottom: 12, textTransform: "uppercase" }}>
        Exit Reason Breakdown
      </h3>
      <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 12 }}>
        High stop-out % means stops are too tight or entries are too early.
        High time-exit % means the strategy is hesitant to commit.
      </div>
      {BOTS.map((bot) => {
        const data = perBot[bot.key];
        if (data.total === 0) {
          return (
            <div key={bot.key} style={{ marginBottom: 10, fontSize: 12, color: "var(--dim)" }}>
              <strong style={{ color: bot.color }}>{bot.label}</strong> — no trades in this filter
            </div>
          );
        }
        return (
          <div key={bot.key} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: bot.color }}>{bot.label}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--dim)" }}>{data.total} trades</span>
            </div>
            <div style={{ display: "flex", gap: 2, height: 22, borderRadius: 3, overflow: "hidden", background: "var(--border)" }}>
              {["targetHit", "stopLoss", "timeExit", "other"].map((r) => {
                const count = data.reasons[r];
                if (count === 0) return null;
                const pct = (count / data.total) * 100;
                return (
                  <div key={r} style={{
                    width: `${pct}%`, background: EXIT_REASON_COLORS[r],
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "var(--font-mono)", fontSize: 10, color: "#000", fontWeight: 600,
                  }}>
                    {pct >= 8 ? `${pct.toFixed(0)}%` : ""}
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 4, fontSize: 10, color: "var(--dim)", fontFamily: "var(--font-mono)" }}>
              {["targetHit", "stopLoss", "timeExit", "other"].map((r) => (
                <span key={r}>
                  <span style={{ color: EXIT_REASON_COLORS[r] }}>{"\u25A0"}</span> {EXIT_REASON_LABELS[r]}: {data.reasons[r]}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Per-Coin Performance ───────────────────────────────────
function PerCoinPerformance({ trades, coinStats }) {
  const rows = useMemo(() => {
    const map = {};
    for (const t of trades) {
      const coin = t.coin;
      if (!map[coin]) map[coin] = { coin, trades: 0, wins: 0, losses: 0, totalPnl: 0, pnlPcts: [], types: new Set() };
      map[coin].trades++;
      if (t.pnlUsd > 0) map[coin].wins++;
      else map[coin].losses++;
      map[coin].totalPnl += t.pnlUsd;
      map[coin].pnlPcts.push(t.pnlPct);
      map[coin].types.add(t.type);
    }
    const arr = Object.values(map).map(r => ({
      ...r,
      winRate: r.trades > 0 ? (r.wins / r.trades) * 100 : 0,
      avgPnlPct: r.pnlPcts.length > 0 ? r.pnlPcts.reduce((a, b) => a + b, 0) / r.pnlPcts.length : 0,
      disabled: coinStats?.[r.coin]?.disabled || false,
      typeList: Array.from(r.types).join(", "),
    }));
    arr.sort((a, b) => b.trades - a.trades);
    return arr;
  }, [trades, coinStats]);

  if (rows.length === 0) {
    return (
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: 2, color: "var(--text)", marginBottom: 12, textTransform: "uppercase" }}>
          Per-Coin Performance
        </h3>
        <div style={{ fontSize: 12, color: "var(--dim)" }}>No trades in this filter.</div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: 2, color: "var(--text)", marginBottom: 12, textTransform: "uppercase" }}>
        Per-Coin Performance
      </h3>
      <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 12 }}>
        Disabled status applies only to scalp gating (40% WR threshold after 20+ scalps).
      </div>
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "1.2fr 1.3fr 0.8fr 0.8fr 1fr 1fr 1fr",
          padding: "10px 14px", borderBottom: "1px solid var(--border)",
          fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 1.5,
          color: "var(--dim)", textTransform: "uppercase",
        }}>
          <span>Coin</span>
          <span>Types</span>
          <span style={{ textAlign: "right" }}>Trades</span>
          <span style={{ textAlign: "right" }}>Win %</span>
          <span style={{ textAlign: "right" }}>Avg %</span>
          <span style={{ textAlign: "right" }}>Total P&L</span>
          <span style={{ textAlign: "right" }}>Status</span>
        </div>
        {rows.map((r) => {
          const wrColor = r.winRate >= 50 ? "var(--green)" : r.winRate >= 35 ? "var(--yellow)" : "var(--red)";
          const pnlColor = r.totalPnl >= 0 ? "var(--green)" : "var(--red)";
          return (
            <div key={r.coin} style={{
              display: "grid", gridTemplateColumns: "1.2fr 1.3fr 0.8fr 0.8fr 1fr 1fr 1fr",
              padding: "10px 14px", borderBottom: "1px solid var(--border)",
              fontFamily: "var(--font-mono)", fontSize: 12,
              opacity: r.disabled ? 0.6 : 1,
            }}>
              <span style={{ color: "var(--text)" }}>{r.coin.replace("/USD", "")}</span>
              <span style={{ color: "var(--dim)", fontSize: 10 }}>{r.typeList}</span>
              <span style={{ textAlign: "right", color: "var(--dim)" }}>{r.trades}</span>
              <span style={{ textAlign: "right", color: wrColor }}>{r.winRate.toFixed(0)}%</span>
              <span style={{ textAlign: "right", color: r.avgPnlPct >= 0 ? "var(--green)" : "var(--red)" }}>
                {r.avgPnlPct >= 0 ? "+" : ""}{r.avgPnlPct.toFixed(2)}%
              </span>
              <span style={{ textAlign: "right", color: pnlColor }}>
                {r.totalPnl >= 0 ? "+" : ""}{fmt$(r.totalPnl)}
              </span>
              <span style={{ textAlign: "right", color: r.disabled ? "var(--red)" : "var(--green)", fontSize: 10 }}>
                {r.disabled ? "DISABLED" : "ACTIVE"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Regime Performance (scalps only, relies on feature snapshots) ──
function RegimePerformance({ trades, featureSnapshots }) {
  const rows = useMemo(() => {
    const scalpOnly = trades.filter(t => t.type === "scalp");
    if (!scalpOnly.length || !featureSnapshots.length) return [];

    const snapshotMap = {};
    for (const s of featureSnapshots) {
      const key = `${s.bot}|${s.coin}`;
      if (!snapshotMap[key]) snapshotMap[key] = [];
      snapshotMap[key].push(s);
    }
    Object.values(snapshotMap).forEach(arr => arr.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));

    const byRegime = {};
    for (const t of scalpOnly) {
      const key = `${t.bot}|${t.coin}`;
      const snaps = snapshotMap[key];
      if (!snaps) continue;
      const entryMs = new Date(t.entryTime).getTime();
      let best = null;
      let bestDiff = 5 * 60 * 1000;
      for (const s of snaps) {
        const sMs = new Date(s.timestamp).getTime();
        const diff = Math.abs(entryMs - sMs);
        if (diff < bestDiff) { best = s; bestDiff = diff; }
      }
      const regime = best?.regimeState || best?.regime || "Unknown";
      if (!byRegime[regime]) byRegime[regime] = { regime, trades: 0, wins: 0, totalPnl: 0 };
      byRegime[regime].trades++;
      if (t.pnlUsd > 0) byRegime[regime].wins++;
      byRegime[regime].totalPnl += t.pnlUsd;
    }

    const arr = Object.values(byRegime).map(r => ({
      ...r,
      winRate: r.trades > 0 ? (r.wins / r.trades) * 100 : 0,
    }));
    arr.sort((a, b) => b.trades - a.trades);
    return arr;
  }, [trades, featureSnapshots]);

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: 2, color: "var(--text)", marginBottom: 12, textTransform: "uppercase" }}>
        Regime Performance (Scalps)
      </h3>
      <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 12 }}>
        Regimes with 10+ trades and &lt; 35% win rate should be excluded. Only scalps have regime data.
      </div>
      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--dim)" }}>
          Not enough data yet — feature snapshots must match scalp trades within 5 minutes.
        </div>
      ) : (
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
          <div style={{
            display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr",
            padding: "10px 14px", borderBottom: "1px solid var(--border)",
            fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 1.5,
            color: "var(--dim)", textTransform: "uppercase",
          }}>
            <span>Regime</span>
            <span style={{ textAlign: "right" }}>Trades</span>
            <span style={{ textAlign: "right" }}>Win %</span>
            <span style={{ textAlign: "right" }}>Total P&L</span>
          </div>
          {rows.map((r) => {
            const wrColor = r.winRate >= 50 ? "var(--green)" : r.winRate >= 35 ? "var(--yellow)" : "var(--red)";
            const pnlColor = r.totalPnl >= 0 ? "var(--green)" : "var(--red)";
            return (
              <div key={r.regime} style={{
                display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr",
                padding: "10px 14px", borderBottom: "1px solid var(--border)",
                fontFamily: "var(--font-mono)", fontSize: 12,
              }}>
                <span style={{ color: "var(--text)" }}>{r.regime}</span>
                <span style={{ textAlign: "right", color: "var(--dim)" }}>{r.trades}</span>
                <span style={{ textAlign: "right", color: wrColor }}>{r.winRate.toFixed(0)}%</span>
                <span style={{ textAlign: "right", color: pnlColor }}>
                  {r.totalPnl >= 0 ? "+" : ""}{fmt$(r.totalPnl)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Time-of-Day Performance ────────────────────────────────
function TimeOfDayPerformance({ trades }) {
  const hourStats = useMemo(() => {
    const hours = Array(24).fill(null).map(() => ({ trades: 0, wins: 0, totalPnl: 0 }));
    for (const t of trades) {
      if (!t.exitTime) continue;
      const h = new Date(t.exitTime).getUTCHours();
      hours[h].trades++;
      if (t.pnlUsd > 0) hours[h].wins++;
      hours[h].totalPnl += t.pnlUsd;
    }
    return hours;
  }, [trades]);

  const maxTrades = Math.max(...hourStats.map(h => h.trades), 1);
  const hasData = trades.length > 0;

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: 2, color: "var(--text)", marginBottom: 12, textTransform: "uppercase" }}>
        Performance by Hour (UTC)
      </h3>
      <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 12 }}>
        Green bars are net-positive hours, red are net-negative. Bar height shows trade volume.
      </div>
      {!hasData ? (
        <div style={{ fontSize: 12, color: "var(--dim)" }}>No data in this filter.</div>
      ) : (
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: 6, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 80 }}>
            {hourStats.map((h, i) => {
              const heightPct = (h.trades / maxTrades) * 100;
              const color = h.trades === 0 ? "var(--border)" : h.totalPnl >= 0 ? "var(--green)" : "var(--red)";
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                  <div title={`${i}:00 UTC — ${h.trades} trades, ${h.trades > 0 ? ((h.wins / h.trades) * 100).toFixed(0) : 0}% WR, ${fmt$(h.totalPnl)}`} style={{
                    width: "100%", height: `${Math.max(2, heightPct)}%`,
                    background: color, borderRadius: "2px 2px 0 0",
                  }} />
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 2, marginTop: 4 }}>
            {hourStats.map((h, i) => (
              <div key={i} style={{ flex: 1, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--dim)" }}>
                {i % 3 === 0 ? i : ""}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Type filter matching ───────────────────────────────────
function filterByType(trades, activeType) {
  if (activeType === "all") return trades;
  if (activeType === "scalp") return trades.filter(t => t.type === "scalp" || t.type === "btc-scalp");
  if (activeType === "swing") return trades.filter(t => t.type === "swing");
  if (activeType === "breakout") return trades.filter(t => t.type === "breakout");
  if (activeType === "bear") return trades.filter(t => t.type?.startsWith("bear") || t.type === "btc-dca");
  return trades;
}

// ─── Main History Component ─────────────────────────────────
export default function History({ onClose, scalpLog, statuses }) {
  const [activeType, setActiveType] = useState("all");

  // Build unified trades list once from all sources
  const allTrades = useMemo(() => buildUnifiedTrades(scalpLog, statuses), [scalpLog, statuses]);
  const featureSnapshots = scalpLog?.featureSnapshots || [];
  const coinStats = scalpLog?.coinStats || {};

  // Counts per filter bucket
  const typeCounts = useMemo(() => ({
    all: allTrades.length,
    scalp: allTrades.filter(t => t.type === "scalp" || t.type === "btc-scalp").length,
    swing: allTrades.filter(t => t.type === "swing").length,
    breakout: allTrades.filter(t => t.type === "breakout").length,
    bear: allTrades.filter(t => t.type?.startsWith("bear") || t.type === "btc-dca").length,
  }), [allTrades]);

  // Apply type filter
  const filteredTrades = useMemo(() => filterByType(allTrades, activeType), [allTrades, activeType]);

  const scalpCount = typeCounts.scalp;
  const nonScalpCount = allTrades.length - scalpCount;

  return (
    <div className={styles.guideOverlay} onClick={onClose}>
      <div className={styles.guidePanel} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 900 }}>
        <div className={styles.guideHeader}>
          <span>HISTORY & TUNING ANALYSIS</span>
          <button className={styles.guideClose} onClick={onClose}>X</button>
        </div>
        <div className={styles.guideContent}>
          <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 16, fontStyle: "italic" }}>
            Data aggregated across all 3 bots. {allTrades.length} total trades analyzed.
          </div>

          <TypeFilter activeType={activeType} setActiveType={setActiveType} typeCounts={typeCounts} />

          <ReadinessBanner scalpCount={scalpCount} nonScalpCount={nonScalpCount} />

          <ExitReasonBreakdown trades={filteredTrades} />

          <PerCoinPerformance trades={filteredTrades} coinStats={coinStats} />

          <RegimePerformance trades={filteredTrades} featureSnapshots={featureSnapshots} />

          <TimeOfDayPerformance trades={filteredTrades} />

          <div style={{
            marginTop: 20, padding: 14,
            background: "rgba(68,136,255,0.04)", border: "1px solid rgba(68,136,255,0.15)",
            borderRadius: 6,
          }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 2, color: "var(--blue)", marginBottom: 8, textTransform: "uppercase" }}>
              How to Use This
            </div>
            <ul style={{ fontSize: 12, color: "var(--dim)", paddingLeft: 18, lineHeight: 1.8 }}>
              <li><strong style={{ color: "var(--text)" }}>High stop-loss %</strong> (&gt;60%) → widen stops or tighten entry criteria</li>
              <li><strong style={{ color: "var(--text)" }}>High time-exit %</strong> (&gt;40%) → shorten hold time or strategy isn&apos;t committing</li>
              <li><strong style={{ color: "var(--text)" }}>A coin with &lt; 35% win rate over 20+ trades</strong> → disable or investigate spread</li>
              <li><strong style={{ color: "var(--text)" }}>A regime consistently losing</strong> → skip entries during that regime</li>
              <li><strong style={{ color: "var(--text)" }}>Bad hour pattern</strong> → add a time gate for volatile low-liquidity hours</li>
              <li><strong style={{ color: "var(--text)" }}>Use the type filter</strong> to isolate scalps vs swings vs breakouts — they often need different tuning</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
