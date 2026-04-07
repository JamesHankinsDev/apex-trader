import styles from "../page.module.css";
import { fmt$, fmtTime } from "./helpers";

function formatHoldDuration(buyTime, sellTime) {
  if (!buyTime || !sellTime) return null;
  const ms = new Date(sellTime).getTime() - new Date(buyTime).getTime();
  if (ms < 0) return null;
  const hours = ms / (1000 * 60 * 60);
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

export default function TradeLog({ trades }) {
  // Pair buy/sell trades to compute hold duration
  const enriched = (trades || []).slice(0, 20).map((t, i, arr) => {
    if (t.side === "SELL" && t.pnl != null) {
      // Find matching buy for this symbol (most recent before this sell)
      const matchingBuy = arr.slice(i + 1).find(b => b.side === "BUY" && b.symbol === t.symbol);
      const holdDuration = matchingBuy ? formatHoldDuration(matchingBuy.time, t.time) : null;
      return { ...t, holdDuration };
    }
    return t;
  });

  return (
    <div className={styles.tradeLog}>
      <div className={`${styles.logRow} ${styles.logHeader}`}>
        <span>TIME</span><span>PAIR</span><span>SIDE</span><span>QTY</span><span>PRICE</span><span>P&L</span>
      </div>
      {enriched.length === 0 ? (
        <div className={styles.empty}>No trades yet</div>
      ) : (
        enriched.map((t, i) => (
          <div key={i} className={styles.logRow}>
            <span>{fmtTime(t.time)}</span>
            <span>{t.symbol?.replace("/USD", "")}</span>
            <span>
              <span className={`${styles.tag} ${t.side === "BUY" ? styles.tagBuy : styles.tagSell}`}>
                {t.side}
              </span>
            </span>
            <span>{t.qty?.toFixed(4)}</span>
            <span>{fmt$(t.price)}</span>
            <span>
              {t.pnl == null ? (
                t.side === "BUY" ? <span style={{ color: "var(--dim)", fontSize: 10 }}>open</span> : "\u2014"
              ) : (
                <span className={styles.tradeOutcome}>
                  <span className={`${styles.outcomeBadge} ${t.pnl >= 0 ? styles.outcomeWin : styles.outcomeLoss}`}>
                    {t.pnl >= 0 ? "WIN" : "LOSS"}
                  </span>
                  <span style={{ color: t.pnl >= 0 ? "var(--green)" : "var(--red)" }}>
                    {t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}
                  </span>
                  {t.holdDuration && (
                    <span className={styles.outcomeHold}>{t.holdDuration}</span>
                  )}
                </span>
              )}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
