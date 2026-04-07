import { fmt$, fmtPct } from "./helpers";
import styles from "../page.module.css";

export default function Leaderboard({ leaderboard }) {
  if (!leaderboard) return null;
  const lb = leaderboard;
  const bots = [
    { key: "main", name: "Main", color: "#00ff88" },
    { key: "exp1", name: "Exp 1", color: "#4488ff" },
    { key: "exp2", name: "Exp 2", color: "#ff9900" },
  ];

  return (
    <div className={styles.leaderboard}>
      {bots.map((b) => {
        const s = lb.bots[b.key];
        if (!s) return null;
        const isLeader = lb.leader === b.key;
        const retColor = s.totalReturnPct >= 0 ? "var(--green)" : "var(--red)";
        return (
          <div key={b.key} className={`${styles.leaderboardCard} ${isLeader ? styles.leaderboardLeader : ""}`}>
            <div className={styles.leaderboardDot} style={{ background: b.color }} />
            <span className={styles.leaderboardName}>
              {b.name} {isLeader ? "\uD83C\uDFC6" : ""}
            </span>
            <span className={styles.leaderboardReturn} style={{ color: retColor }}>
              {fmtPct(s.totalReturnPct)}
            </span>
            <span className={styles.leaderboardBalance}>{fmt$(s.currentBalance)}</span>
            <span className={styles.leaderboardMeta}>
              {s.totalTrades > 0 ? `${s.winRate.toFixed(0)}% WR` : "0 trades"} · {s.totalTrades} trades
            </span>
          </div>
        );
      })}
    </div>
  );
}
