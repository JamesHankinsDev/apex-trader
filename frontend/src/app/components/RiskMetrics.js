import styles from "../page.module.css";
import { fmt$ } from "./helpers";

export default function RiskMetrics({ riskMetrics, wins, losses }) {
  if (!riskMetrics || (wins + losses) <= 0) return null;
  const rm = riskMetrics;
  const sharpeColor = rm.sharpeRatio == null ? "var(--dim)" : rm.sharpeRatio >= 1 ? "var(--green)" : rm.sharpeRatio >= 0 ? "var(--yellow)" : "var(--red)";
  const sortinoColor = rm.sortinoRatio == null ? "var(--dim)" : rm.sortinoRatio >= 1.5 ? "var(--green)" : rm.sortinoRatio >= 0 ? "var(--yellow)" : "var(--red)";
  const pfColor = rm.profitFactor == null ? "var(--dim)" : rm.profitFactor >= 1.5 ? "var(--green)" : rm.profitFactor >= 1 ? "var(--yellow)" : "var(--red)";

  const items = [
    { label: "SHARPE RATIO", val: rm.sharpeRatio != null ? rm.sharpeRatio.toFixed(2) : "\u2014", sub: rm.sharpeRatio == null ? "need more trades" : rm.sharpeRatio >= 2 ? "excellent (\u22652.0)" : rm.sharpeRatio >= 1 ? "good (target \u22652.0)" : rm.sharpeRatio >= 0 ? "fair (target \u22651.0)" : "poor (<0)", color: sharpeColor },
    { label: "SORTINO RATIO", val: rm.sortinoRatio != null ? rm.sortinoRatio.toFixed(2) : "\u2014", sub: rm.sortinoRatio == null ? "need more trades" : rm.sortinoRatio >= 3 ? "excellent (\u22653.0)" : rm.sortinoRatio >= 1.5 ? "good (target \u22653.0)" : rm.sortinoRatio >= 0 ? "fair (target \u22651.5)" : "poor (<0)", color: sortinoColor },
    { label: "MAX DRAWDOWN", val: `-${rm.maxDrawdownPct.toFixed(2)}%`, sub: fmt$(rm.maxDrawdown), color: rm.maxDrawdownPct > 10 ? "var(--red)" : "var(--yellow)" },
    { label: "PROFIT FACTOR", val: rm.profitFactor != null ? rm.profitFactor.toFixed(2) : "\u2014", sub: "wins / losses", color: pfColor },
    { label: "AVG WIN/LOSS", val: rm.avgWinLossRatio != null ? `${rm.avgWinLossRatio.toFixed(2)}x` : "\u2014", sub: `${fmt$(rm.avgWin)} / ${fmt$(rm.avgLoss)}`, color: rm.avgWinLossRatio >= 1.5 ? "var(--green)" : "var(--yellow)" },
    { label: "STREAK", val: rm.currentStreak > 0 ? `${rm.currentStreak} ${rm.currentStreakType === "win" ? "W" : "L"}` : "\u2014", sub: `Best: ${rm.maxWinStreak}W \u00B7 Worst: ${rm.maxLossStreak}L`, color: rm.currentStreakType === "win" ? "var(--green)" : rm.currentStreakType === "loss" ? "var(--red)" : "var(--dim)" },
  ];

  return (
    <div className={styles.riskMetricsBar}>
      {items.map((s) => (
        <div className={styles.riskBlock} key={s.label}>
          <div className={styles.benchmarkLabel}>{s.label}</div>
          <div className={styles.riskVal} style={{ color: s.color }}>{s.val}</div>
          <div className={styles.benchmarkSub}>{s.sub}</div>
        </div>
      ))}
    </div>
  );
}
