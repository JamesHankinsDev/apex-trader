import styles from "../page.module.css";
import { fmt$, fmtPct } from "./helpers";

export default function MobileKPIs({ portfolioValue, startValue, todayStartValue, running }) {
  const pv = portfolioValue || 0;
  const sv = startValue || pv;
  const tsv = todayStartValue || pv;
  const todayPnl = pv > 0 ? pv - tsv : 0;
  const totalPnl = pv > 0 ? pv - sv : 0;
  const todayPct = tsv > 0 ? (todayPnl / tsv) * 100 : 0;
  const totalPct = sv > 0 ? (totalPnl / sv) * 100 : 0;

  return (
    <div className={styles.mobileKpis}>
      {/* Hero: portfolio value */}
      <div className={styles.mobileHero}>
        <div className={styles.mobileHeroLabel}>PORTFOLIO</div>
        <div className={styles.mobileHeroVal}>{fmt$(pv)}</div>
        <div className={styles.mobileHeroSub} style={{ color: totalPnl >= 0 ? "var(--green)" : "var(--red)" }}>
          {totalPnl >= 0 ? "+" : ""}{fmt$(totalPnl)} ({fmtPct(totalPct)}) all time
        </div>
      </div>

      {/* Two compact cards */}
      <div className={styles.mobileKpiRow}>
        <div className={styles.mobileKpiCard}>
          <div className={styles.mobileKpiLabel}>TODAY</div>
          <div className={styles.mobileKpiVal} style={{ color: todayPnl >= 0 ? "var(--green)" : "var(--red)" }}>
            {todayPnl >= 0 ? "+" : ""}{fmt$(todayPnl)}
          </div>
          <div className={styles.mobileKpiSub}>{fmtPct(todayPct)}</div>
        </div>
        <div className={styles.mobileKpiCard}>
          <div className={styles.mobileKpiLabel}>STATUS</div>
          <div className={styles.mobileKpiVal} style={{ color: running ? "var(--green)" : "var(--dim)" }}>
            {running ? "Active" : "Offline"}
          </div>
          <div className={styles.mobileKpiSub}>{running ? "Scanning" : "Stopped"}</div>
        </div>
      </div>
    </div>
  );
}
