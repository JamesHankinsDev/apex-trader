import styles from "../page.module.css";
import { fmt$, fmtPct, fmtTime } from "./helpers";

export default function StatsBar({ portfolioValue, startValue, todayStartValue, totalTrades, winRate, positions, lastScan }) {
  const pv = portfolioValue || 0;
  const sv = startValue || pv;
  const tsv = todayStartValue || pv;
  const todayPnl = pv > 0 ? pv - tsv : 0;
  const totalPnl = pv > 0 ? pv - sv : 0;
  const todayPct = tsv > 0 ? (todayPnl / tsv) * 100 : 0;
  const openCount = Object.keys(positions || {}).length;

  const stats = [
    { label: "PORTFOLIO VALUE", val: fmt$(pv), sub: `${totalPnl >= 0 ? "+" : ""}${fmt$(totalPnl)} all time`, color: totalPnl >= 0 ? "var(--green)" : "var(--red)" },
    { label: "TODAY P&L", val: `${todayPnl >= 0 ? "+" : ""}${fmt$(todayPnl)}`, sub: fmtPct(todayPct), color: todayPnl >= 0 ? "var(--green)" : "var(--red)" },
    { label: "TOTAL TRADES", val: totalTrades || 0, sub: `Win rate: ${winRate != null ? winRate + "%" : "\u2014"}`, color: "var(--blue)" },
    { label: "OPEN POSITIONS", val: openCount, sub: `Last scan: ${fmtTime(lastScan)}`, color: "var(--yellow)" },
  ];

  return (
    <div className={styles.statsBar}>
      {stats.map((s) => (
        <div className={styles.statBlock} key={s.label}>
          <div className={styles.statLabel}>{s.label}</div>
          <div className={styles.statVal} style={{ color: s.color }}>{s.val}</div>
          <div className={styles.statSub}>{s.sub}</div>
        </div>
      ))}
    </div>
  );
}
