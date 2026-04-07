import styles from "../page.module.css";
import { fmt$, fmtPct } from "./helpers";

export default function BenchmarkBar({ benchmarks, portfolioValue, startValue }) {
  if (!benchmarks?.initialized) return null;
  const bm = benchmarks;
  const pv = portfolioValue || 0;
  const sv = startValue || pv;
  const portfolioPct = sv > 0 ? ((pv - sv) / sv) * 100 : 0;
  const btcPct = bm.btcOnly.pctReturn;
  const eqPct = bm.equalWeight.pctReturn;
  const mcPct = bm.mcapWeight.pctReturn;
  const vsBtc = portfolioPct - btcPct;
  const vsEqual = portfolioPct - eqPct;
  const vsMcap = portfolioPct - mcPct;

  const items = [
    { label: "PORTFOLIO", val: fmtPct(portfolioPct), sub: fmt$(pv), color: portfolioPct >= 0 ? "var(--green)" : "var(--red)" },
    { label: "BTC HOLD", val: fmtPct(btcPct), sub: fmt$(bm.btcOnly.value), color: btcPct >= 0 ? "#ff9900" : "var(--red)" },
    { label: "EQUAL WT", val: fmtPct(eqPct), sub: fmt$(bm.equalWeight.value), color: eqPct >= 0 ? "var(--yellow)" : "var(--red)" },
    { label: "MCAP WT", val: fmtPct(mcPct), sub: fmt$(bm.mcapWeight.value), color: mcPct >= 0 ? "rgb(168,85,247)" : "var(--red)" },
    { label: "VS BTC", val: `${vsBtc >= 0 ? "+" : ""}${vsBtc.toFixed(2)}%`, sub: vsBtc >= 0 ? "outperforming" : "underperforming", color: vsBtc >= 0 ? "var(--green)" : "var(--red)" },
    { label: "VS EQUAL", val: `${vsEqual >= 0 ? "+" : ""}${vsEqual.toFixed(2)}%`, sub: vsEqual >= 0 ? "outperforming" : "underperforming", color: vsEqual >= 0 ? "var(--green)" : "var(--red)" },
    { label: "VS MCAP", val: `${vsMcap >= 0 ? "+" : ""}${vsMcap.toFixed(2)}%`, sub: vsMcap >= 0 ? "outperforming" : "underperforming", color: vsMcap >= 0 ? "var(--green)" : "var(--red)" },
  ];

  return (
    <div className={styles.benchmarkBar}>
      {items.map((s) => (
        <div className={styles.benchmarkBlock} key={s.label}>
          <div className={styles.benchmarkLabel}>{s.label}</div>
          <div className={styles.benchmarkVal} style={{ color: s.color }}>{s.val}</div>
          <div className={styles.benchmarkSub}>{s.sub}</div>
        </div>
      ))}
    </div>
  );
}
