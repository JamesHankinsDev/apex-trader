import styles from "../page.module.css";
import { fmt$ } from "./helpers";

export default function PositionCard({ pos, botType, onSell }) {
  const curPrice = pos.livePrice || pos.entryPrice;
  const pnlPct = pos.entryPrice ? ((curPrice - pos.entryPrice) / pos.entryPrice) * 100 : 0;
  const pnlVal = (pnlPct / 100) * (pos.notional || 0);
  const currentValue = (pos.notional || 0) + pnlVal;

  return (
    <div className={styles.posCard}>
      <div className={styles.posHeader}>
        <span className={styles.ticker}>{pos.symbol?.replace("/USD", "")}</span>
        <span className={styles.posEntry} style={{ color: pnlPct >= 0 ? "var(--green)" : "var(--red)" }}>
          {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--dim)", letterSpacing: 1, marginBottom: 2 }}>PURCHASED AT</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--text)" }}>{fmt$(pos.entryPrice)}</div>
        </div>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--dim)", letterSpacing: 1, marginBottom: 2 }}>CURRENT VALUE</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--text)" }}>{fmt$(curPrice)}</div>
        </div>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--dim)", letterSpacing: 1, marginBottom: 2 }}>POSITION SIZE</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--text)" }}>{fmt$(currentValue)}</div>
        </div>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--dim)", letterSpacing: 1, marginBottom: 2 }}>P&L</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: pnlVal >= 0 ? "var(--green)" : "var(--red)" }}>
            {pnlVal >= 0 ? "+" : ""}{fmt$(pnlVal)}
          </div>
        </div>
      </div>

      <button className={styles.btnSell} onClick={onSell}>SELL</button>
    </div>
  );
}
