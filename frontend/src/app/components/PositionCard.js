import styles from "../page.module.css";
import { fmt$ } from "./helpers";

export default function PositionCard({ pos, botType, onSell }) {
  const curPrice = pos.livePrice || pos.entryPrice;
  const pnlPct = pos.entryPrice ? ((curPrice - pos.entryPrice) / pos.entryPrice) * 100 : 0;
  const pnlVal = (pnlPct / 100) * pos.notional;
  const holdHours = pos.entryTime ? Math.round((Date.now() - new Date(pos.entryTime).getTime()) / (1000 * 60 * 60)) : 0;
  const entryDate = pos.entryTime ? new Date(pos.entryTime).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }) : "\u2014";

  return (
    <div className={styles.posCard}>
      <div className={styles.posHeader}>
        <span className={styles.ticker}>{pos.symbol?.replace("/USD", "")}</span>
        <span className={styles.posEntry} style={{ color: pnlPct >= 0 ? "var(--green)" : "var(--red)" }}>
          {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}% ({pnlVal >= 0 ? "+" : ""}{fmt$(pnlVal)})
        </span>
      </div>
      <div className={styles.posDetails}>
        Entry {fmt$(pos.entryPrice)} \u00B7 Now {fmt$(curPrice)}
        {botType === "exp2" && !pos.bearMode && ` \u00B7 High ${fmt$(pos.highWaterMark)}`}
      </div>

      {pos.bearMode ? (
        <>
          <div className={styles.posDetails} style={{ color: "#ff6680" }}>
            {botType === "exp2"
              ? `Channel SL ${fmt$(pos.stopPrice || pos.hardStop)} \u00B7 Channel TP ${pos.takeProfit === "TRAILING" || pos.takeProfit === Infinity ? "Gate Reopen" : fmt$(pos.takeProfit)}`
              : `Channel SL ${fmt$(pos.stopPrice)} \u00B7 Channel TP ${fmt$(pos.targetPrice)}`
            }
          </div>
          <div className={styles.posDetails} style={{ color: "#ff6680" }}>
            {botType === "exp2" ? "DCA Accumulation" : botType === "exp1" ? "Max Hold 36h" : "Max Hold 48h"} \u00B7 {holdHours}h elapsed
          </div>
        </>
      ) : (
        <div className={styles.posDetails}>
          {botType === "exp2"
            ? `Trail SL ${fmt$(pos.trailingStop)} \u00B7 Hard SL ${fmt$(pos.hardStop)} \u00B7 TP ${fmt$(pos.takeProfit)}`
            : botType === "exp1"
              ? `24h Avg ${fmt$(pos.avg24h)} \u00B7 Dev ${pos.deviation?.toFixed(2)}% \u00B7 ${pos.trend === "rising" ? "Rising" : pos.trend === "falling" ? `Falling (${pos.consecutiveDips || 0} dips)` : "Flat"} \u00B7 RSI ${pos.rsi ?? "\u2014"}`
              : `SL ${fmt$(pos.stopPrice)} \u00B7 TP ${pos.targetPrice === "TRAILING" ? "\uD83D\uDE80 Chasing Gains" : fmt$(pos.targetPrice)}`
          }
        </div>
      )}

      <div className={styles.posDetails} style={{ marginTop: 2, color: "var(--dim)" }}>
        {entryDate} \u00B7 ${pos.notional?.toFixed(2)} invested
      </div>
      <button className={styles.btnSell} onClick={onSell}>SELL</button>
    </div>
  );
}
