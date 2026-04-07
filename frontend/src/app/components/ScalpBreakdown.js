import styles from "../page.module.css";
import { fmt$ } from "./helpers";

const BOTS = [
  { key: "main", label: "Main", color: "#00ff88" },
  { key: "exp1", label: "Exp 1", color: "#4488ff" },
  { key: "exp2", label: "Exp 2", color: "#ff9900" },
];

export default function ScalpBreakdown({ scalpLog, leaderboard }) {
  if (!scalpLog || !leaderboard) return null;

  const today = scalpLog.todaySummary;
  const recent = scalpLog.recentTrades || [];

  // Per-bot scalp stats from recent trades
  const botScalpStats = {};
  for (const bot of BOTS) {
    const botTrades = recent.filter(t => t.bot === bot.key);
    const wins = botTrades.filter(t => t.pnlUsd > 0);
    const totalPnl = botTrades.reduce((s, t) => s + t.pnlUsd, 0);
    const avgHold = botTrades.length > 0
      ? botTrades.reduce((s, t) => s + t.holdSeconds, 0) / botTrades.length
      : 0;
    botScalpStats[bot.key] = {
      count: botTrades.length,
      wins: wins.length,
      winRate: botTrades.length > 0 ? (wins.length / botTrades.length * 100) : 0,
      totalPnl,
      avgHold,
    };
  }

  return (
    <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)" }}>
      <div className={styles.chartLabel} style={{ marginBottom: 12 }}>SCALP VS SWING PERFORMANCE</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {BOTS.map((bot) => {
          const ss = botScalpStats[bot.key];
          const lb = leaderboard.bots?.[bot.key];
          // Swing stats = total trades minus scalp trades
          const swingCount = (lb?.totalTrades || 0) - ss.count;
          const swingPnl = (lb?.totalReturnUsd || 0) - ss.totalPnl;

          return (
            <div key={bot.key} style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid var(--border)",
              borderRadius: 6, padding: 14, overflow: "hidden",
            }}>
              {/* Bot header */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: bot.color, flexShrink: 0 }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)", fontWeight: 600 }}>{bot.label}</span>
              </div>

              {/* Scalp bar */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--dim)", letterSpacing: 1 }}>SCALPS</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: ss.totalPnl >= 0 ? "var(--green)" : "var(--red)" }}>
                    {ss.totalPnl >= 0 ? "+" : ""}{fmt$(ss.totalPnl)}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 2, height: 6, borderRadius: 3, overflow: "hidden", background: "var(--border)" }}>
                  {ss.count > 0 && (
                    <>
                      <div style={{ width: `${ss.winRate}%`, background: "var(--green)", borderRadius: 3, minWidth: ss.wins > 0 ? 2 : 0 }} />
                      <div style={{ flex: 1, background: "var(--red)", borderRadius: 3 }} />
                    </>
                  )}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--dim)" }}>
                    {ss.count} trades {ss.count > 0 ? `\u00B7 ${ss.winRate.toFixed(0)}% WR` : ""}
                  </span>
                  {ss.count > 0 && (
                    <span style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--dim)" }}>
                      avg {Math.round(ss.avgHold / 60)}min
                    </span>
                  )}
                </div>
              </div>

              {/* Swing bar */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--dim)", letterSpacing: 1 }}>SWINGS</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: swingPnl >= 0 ? "var(--green)" : "var(--red)" }}>
                    {swingPnl >= 0 ? "+" : ""}{fmt$(swingPnl)}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 2, height: 6, borderRadius: 3, overflow: "hidden", background: "var(--border)" }}>
                  {swingCount > 0 && lb?.winRate > 0 && (
                    <>
                      <div style={{ width: `${lb.winRate}%`, background: "var(--green)", borderRadius: 3, minWidth: 2 }} />
                      <div style={{ flex: 1, background: "var(--red)", borderRadius: 3 }} />
                    </>
                  )}
                </div>
                <div style={{ marginTop: 4 }}>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--dim)" }}>
                    {swingCount} trades
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Today's scalp summary */}
      {today && today.totalScalps > 0 && (
        <div style={{
          marginTop: 12, padding: "10px 14px",
          background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)",
          borderRadius: 6, fontFamily: "var(--font-mono)", fontSize: 11,
          display: "flex", flexWrap: "wrap", gap: 12, color: "var(--dim)",
        }}>
          <span>Today: {today.totalScalps} scalps</span>
          <span style={{ color: today.winRatePct >= 50 ? "var(--green)" : "var(--red)" }}>{today.winRatePct.toFixed(0)}% WR</span>
          <span style={{ color: today.totalPnlUsd >= 0 ? "var(--green)" : "var(--red)" }}>
            {today.totalPnlUsd >= 0 ? "+" : ""}{fmt$(today.totalPnlUsd)}
          </span>
          <span>Spread: ~{fmt$(today.totalSpreadCost)}</span>
          {today.bestTrade && <span style={{ color: "var(--green)" }}>Best: {today.bestTrade.coin?.replace("/USD", "")} +{fmt$(today.bestTrade.pnlUsd)}</span>}
          {today.worstTrade && today.worstTrade.pnlUsd < 0 && <span style={{ color: "var(--red)" }}>Worst: {today.worstTrade.coin?.replace("/USD", "")} {fmt$(today.worstTrade.pnlUsd)}</span>}
        </div>
      )}
    </div>
  );
}
