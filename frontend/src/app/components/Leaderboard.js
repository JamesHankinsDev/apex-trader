import { fmt$, fmtPct } from "./helpers";
import styles from "../page.module.css";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

function calcChange(equityHistory, currentValue, lookbackMs) {
  if (!equityHistory || equityHistory.length < 2 || !currentValue) return null;
  const cutoff = Date.now() - lookbackMs;
  let pastValue = null;
  for (let i = equityHistory.length - 1; i >= 0; i--) {
    if (equityHistory[i].t <= cutoff) { pastValue = equityHistory[i].v; break; }
  }
  if (pastValue === null) {
    if (equityHistory[0].t > cutoff) return null;
    pastValue = equityHistory[0].v;
  }
  if (pastValue <= 0) return null;
  const change = currentValue - pastValue;
  const pct = (change / pastValue) * 100;
  return { change, pct };
}

export default function Leaderboard({ leaderboard, statuses }) {
  if (!leaderboard) return null;
  const lb = leaderboard;
  const expScores = lb.experimentScores;
  const bots = [
    { key: "main", name: "Exp 1", color: "#00ff88" },
    { key: "exp1", name: "Exp 2", color: "#4488ff" },
    { key: "exp2", name: "Exp 3", color: "#ff9900" },
  ];

  return (
    <div className={styles.leaderboard}>
      {bots.map((b) => {
        const s = lb.bots[b.key];
        if (!s) return null;
        const isLeader = lb.leader === b.key;
        const retColor = s.totalReturnPct >= 0 ? "var(--green)" : "var(--red)";
        const es = expScores?.[b.key];

        const botStatus = statuses?.find(st => st.key === b.key)?.status;
        const eq = botStatus?.equityHistory;
        const pv = botStatus?.portfolioValue || s.currentBalance;
        const hourly = calcChange(eq, pv, HOUR_MS);
        const daily = calcChange(eq, pv, DAY_MS);
        const weekly = calcChange(eq, pv, WEEK_MS);

        return (
          <div key={b.key} className={`${styles.leaderboardCard} ${isLeader ? styles.leaderboardLeader : ""}`}>
            {/* Top row: bot name + score + balance + return */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <div className={styles.leaderboardDot} style={{ background: b.color }} />
              <span className={styles.leaderboardName}>
                {b.name} {isLeader ? "\uD83C\uDFC6" : ""}
              </span>
              {es && es.eligible && (
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
                  padding: "1px 6px", borderRadius: 3,
                  background: isLeader ? "rgba(0,255,136,0.12)" : "rgba(255,255,255,0.05)",
                  color: isLeader ? "var(--green)" : "var(--dim)",
                  border: isLeader ? "1px solid rgba(0,255,136,0.25)" : "1px solid var(--border)",
                }}>
                  {es.score.toFixed(1)}
                </span>
              )}
              {es && !es.eligible && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--dim)" }}>
                  {es.reason || "not eligible"}
                </span>
              )}
              <span className={styles.leaderboardBalance}>{fmt$(pv)}</span>
              <span className={styles.leaderboardReturn} style={{ color: retColor }}>
                {fmtPct(s.totalReturnPct)}
              </span>
            </div>

            {/* Period changes + stats row */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <PeriodBadge label="1H" data={hourly} />
              <PeriodBadge label="1D" data={daily} />
              <PeriodBadge label="1W" data={weekly} />
              <span className={styles.leaderboardMeta} style={{ marginLeft: "auto" }}>
                {s.totalTrades > 0 ? `${s.winRate.toFixed(0)}% WR` : "0 trades"} \u00B7 {s.totalTrades} trades
                {s.sharpeRatio != null && ` \u00B7 SR ${s.sharpeRatio.toFixed(1)}`}
                {s.sortinoRatio != null && ` \u00B7 SO ${s.sortinoRatio.toFixed(1)}`}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PeriodBadge({ label, data }) {
  if (!data) {
    return (
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 10,
        color: "var(--dim)", display: "inline-flex", alignItems: "center", gap: 4,
      }}>
        <span style={{ color: "var(--dim)", fontSize: 9, letterSpacing: 1 }}>{label}</span>
        <span>{"\u2014"}</span>
      </span>
    );
  }

  const color = data.pct >= 0 ? "var(--green)" : "var(--red)";
  return (
    <span style={{
      fontFamily: "var(--font-mono)", fontSize: 10,
      display: "inline-flex", alignItems: "center", gap: 4,
    }}>
      <span style={{ color: "var(--dim)", fontSize: 9, letterSpacing: 1 }}>{label}</span>
      <span style={{ color, fontWeight: 600 }}>
        {data.pct >= 0 ? "+" : ""}{data.pct.toFixed(2)}%
      </span>
      <span style={{ color, fontSize: 9 }}>
        ({data.change >= 0 ? "+" : ""}{fmt$(data.change)})
      </span>
    </span>
  );
}
