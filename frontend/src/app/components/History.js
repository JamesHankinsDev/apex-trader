import { useMemo } from "react";
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

// ─── Readiness Banner ───────────────────────────────────────
function ReadinessBanner({ scalpCount, swingCount }) {
  const SCALP_TARGET = 50;
  const SWING_TARGET = 50;
  const scalpReady = scalpCount >= SCALP_TARGET;
  const swingReady = swingCount >= SWING_TARGET;

  const scalpPct = Math.min(100, (scalpCount / SCALP_TARGET) * 100);
  const swingPct = Math.min(100, (swingCount / SWING_TARGET) * 100);

  let status, statusColor;
  if (scalpReady && swingReady) {
    status = "Ready to tune both strategies";
    statusColor = "var(--green)";
  } else if (scalpReady) {
    status = "Ready to tune scalps — keep collecting swing data";
    statusColor = "var(--yellow)";
  } else if (swingReady) {
    status = "Ready to tune swings — keep collecting scalp data";
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
            <div style={{
              width: `${scalpPct}%`, height: "100%",
              background: scalpReady ? "var(--green)" : "var(--blue)",
            }} />
          </div>
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--dim)" }}>SWINGS</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: swingReady ? "var(--green)" : "var(--dim)" }}>
              {swingCount} / {SWING_TARGET}
            </span>
          </div>
          <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{
              width: `${swingPct}%`, height: "100%",
              background: swingReady ? "var(--green)" : "var(--blue)",
            }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Exit Reason Breakdown ──────────────────────────────────
function ExitReasonBreakdown({ scalpTrades }) {
  const perBot = useMemo(() => {
    const out = {};
    for (const bot of BOTS) {
      const trades = scalpTrades.filter(t => t.bot === bot.key);
      const total = trades.length;
      const reasons = { targetHit: 0, stopLoss: 0, timeExit: 0, other: 0 };
      for (const t of trades) {
        const r = t.exitReason || "other";
        if (reasons[r] != null) reasons[r]++;
        else reasons.other++;
      }
      out[bot.key] = { total, reasons };
    }
    return out;
  }, [scalpTrades]);

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{
        fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: 2,
        color: "var(--text)", marginBottom: 12, textTransform: "uppercase",
      }}>
        Exit Reason Breakdown (Scalps)
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
              <strong style={{ color: bot.color }}>{bot.label}</strong> — no scalps yet
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
              {["targetHit", "stopLoss", "timeExit"].map((r) => (
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
function PerCoinPerformance({ scalpTrades, coinStats }) {
  const rows = useMemo(() => {
    const map = {};
    for (const t of scalpTrades) {
      const coin = t.coin;
      if (!map[coin]) map[coin] = { coin, trades: 0, wins: 0, losses: 0, totalPnl: 0, pnlPcts: [] };
      map[coin].trades++;
      if (t.pnlUsd > 0) map[coin].wins++;
      else map[coin].losses++;
      map[coin].totalPnl += t.pnlUsd;
      map[coin].pnlPcts.push(t.pnlPct);
    }
    const arr = Object.values(map).map(r => ({
      ...r,
      winRate: r.trades > 0 ? (r.wins / r.trades) * 100 : 0,
      avgPnlPct: r.pnlPcts.length > 0 ? r.pnlPcts.reduce((a, b) => a + b, 0) / r.pnlPcts.length : 0,
      disabled: coinStats?.[r.coin]?.disabled || false,
    }));
    arr.sort((a, b) => b.trades - a.trades);
    return arr;
  }, [scalpTrades, coinStats]);

  if (rows.length === 0) {
    return (
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: 2, color: "var(--text)", marginBottom: 12, textTransform: "uppercase" }}>
          Per-Coin Performance
        </h3>
        <div style={{ fontSize: 12, color: "var(--dim)" }}>No scalp trades yet.</div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{
        fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: 2,
        color: "var(--text)", marginBottom: 12, textTransform: "uppercase",
      }}>
        Per-Coin Performance (Scalps)
      </h3>
      <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 12 }}>
        Disabled coins have fallen below 40% win rate after 20+ trades — they auto re-enable after 6/10 recent wins.
      </div>
      <div style={{
        background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)",
        borderRadius: 6, overflow: "hidden",
      }}>
        <div style={{
          display: "grid", gridTemplateColumns: "1.5fr 0.8fr 0.8fr 1fr 1fr 1fr",
          padding: "10px 14px", borderBottom: "1px solid var(--border)",
          fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 1.5,
          color: "var(--dim)", textTransform: "uppercase",
        }}>
          <span>Coin</span>
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
              display: "grid", gridTemplateColumns: "1.5fr 0.8fr 0.8fr 1fr 1fr 1fr",
              padding: "10px 14px", borderBottom: "1px solid var(--border)",
              fontFamily: "var(--font-mono)", fontSize: 12,
              opacity: r.disabled ? 0.6 : 1,
            }}>
              <span style={{ color: "var(--text)" }}>{r.coin.replace("/USD", "")}</span>
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

// ─── Regime Performance ─────────────────────────────────────
// Joins feature snapshots (which have regime) with scalp trades by bot+coin+closest time
function RegimePerformance({ scalpTrades, featureSnapshots }) {
  const rows = useMemo(() => {
    if (!scalpTrades.length || !featureSnapshots.length) return [];

    // Build lookup: {bot}|{coin} -> sorted snapshots by time
    const snapshotMap = {};
    for (const s of featureSnapshots) {
      const key = `${s.bot}|${s.coin}`;
      if (!snapshotMap[key]) snapshotMap[key] = [];
      snapshotMap[key].push(s);
    }
    Object.values(snapshotMap).forEach(arr => arr.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));

    // Match each trade to the closest prior snapshot within 5 minutes
    const byRegime = {};
    for (const t of scalpTrades) {
      const key = `${t.bot}|${t.coin}`;
      const snaps = snapshotMap[key];
      if (!snaps) continue;
      const entryMs = new Date(t.entryTime).getTime();
      // Find nearest snapshot before entry, within 5 minutes
      let best = null;
      let bestDiff = 5 * 60 * 1000;
      for (const s of snaps) {
        const sMs = new Date(s.timestamp).getTime();
        const diff = Math.abs(entryMs - sMs);
        if (diff < bestDiff) {
          best = s;
          bestDiff = diff;
        }
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
  }, [scalpTrades, featureSnapshots]);

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{
        fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: 2,
        color: "var(--text)", marginBottom: 12, textTransform: "uppercase",
      }}>
        Regime Performance
      </h3>
      <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 12 }}>
        How each market regime has performed. Regimes with 10+ trades and &lt; 35% win rate should be excluded.
      </div>
      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--dim)" }}>
          Not enough data yet — feature snapshots must match scalp trades within 5 minutes.
        </div>
      ) : (
        <div style={{
          background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)",
          borderRadius: 6, overflow: "hidden",
        }}>
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
function TimeOfDayPerformance({ scalpTrades }) {
  const hourStats = useMemo(() => {
    const hours = Array(24).fill(null).map(() => ({ trades: 0, wins: 0, totalPnl: 0 }));
    for (const t of scalpTrades) {
      if (!t.exitTime) continue;
      const h = new Date(t.exitTime).getUTCHours();
      hours[h].trades++;
      if (t.pnlUsd > 0) hours[h].wins++;
      hours[h].totalPnl += t.pnlUsd;
    }
    return hours;
  }, [scalpTrades]);

  const maxTrades = Math.max(...hourStats.map(h => h.trades), 1);
  const hasData = scalpTrades.length > 0;

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{
        fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: 2,
        color: "var(--text)", marginBottom: 12, textTransform: "uppercase",
      }}>
        Performance by Hour (UTC)
      </h3>
      <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 12 }}>
        Green bars are net-positive hours, red are net-negative. Bar height shows trade volume.
      </div>
      {!hasData ? (
        <div style={{ fontSize: 12, color: "var(--dim)" }}>No data yet.</div>
      ) : (
        <div style={{
          background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)",
          borderRadius: 6, padding: 14,
        }}>
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

// ─── Main History Component ─────────────────────────────────
export default function History({ onClose, scalpLog, statuses }) {
  const scalpTrades = scalpLog?.recentTrades || [];
  const featureSnapshots = scalpLog?.featureSnapshots || [];
  const coinStats = scalpLog?.coinStats || {};

  // Swing count = total closed trades per bot minus scalp count per bot
  const swingCount = useMemo(() => {
    let total = 0;
    for (const { key, status } of statuses) {
      if (!status) continue;
      const botTotal = (status.wins || 0) + (status.losses || 0);
      const botScalps = scalpTrades.filter(t => t.bot === key).length;
      total += Math.max(0, botTotal - botScalps);
    }
    return total;
  }, [statuses, scalpTrades]);

  return (
    <div className={styles.guideOverlay} onClick={onClose}>
      <div className={styles.guidePanel} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 900 }}>
        <div className={styles.guideHeader}>
          <span>HISTORY & TUNING ANALYSIS</span>
          <button className={styles.guideClose} onClick={onClose}>X</button>
        </div>
        <div className={styles.guideContent}>
          <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 20, fontStyle: "italic" }}>
            Data aggregated across all 3 bots. Use these breakdowns to decide what to tune and why.
          </div>

          <ReadinessBanner scalpCount={scalpTrades.length} swingCount={swingCount} />

          <ExitReasonBreakdown scalpTrades={scalpTrades} />

          <PerCoinPerformance scalpTrades={scalpTrades} coinStats={coinStats} />

          <RegimePerformance scalpTrades={scalpTrades} featureSnapshots={featureSnapshots} />

          <TimeOfDayPerformance scalpTrades={scalpTrades} />

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
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
