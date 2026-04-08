import styles from "../page.module.css";
import { fmt$, fmtPct } from "./helpers";

export default function LiveTraderBanner({ liveTrader }) {
  if (!liveTrader) return null;

  const lt = liveTrader;
  const isActive = lt.enabled && lt.running;
  const mirror = lt.mirrorSource;
  const isMirroring = mirror && mirror.label && mirror.label !== 'Holding Cash';
  const evaluation = lt.evaluation;
  const positions = lt.positions || {};
  const posCount = Object.keys(positions).length;
  const pv = lt.portfolioValue || 0;

  // If not enabled, don't show anything
  if (!lt.enabled) return null;

  return (
    <div className={styles.liveTraderBanner} style={{
      background: isMirroring ? "rgba(0,255,136,0.06)" : "rgba(255,204,0,0.06)",
      borderColor: isMirroring ? "rgba(0,255,136,0.2)" : "rgba(255,204,0,0.2)",
    }}>
      {/* Status row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 16 }}>{isMirroring ? "\uD83D\uDFE2" : "\uD83D\uDFE1"}</span>
        <span style={{
          fontFamily: "var(--font-display)", fontSize: 16, letterSpacing: 2,
          color: isMirroring ? "var(--green)" : "var(--yellow)",
        }}>
          LIVE TRADER
        </span>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 11,
          padding: "2px 8px", borderRadius: 3,
          background: isActive ? (isMirroring ? "rgba(0,255,136,0.12)" : "rgba(255,204,0,0.12)") : "rgba(255,51,85,0.12)",
          color: isActive ? (isMirroring ? "var(--green)" : "var(--yellow)") : "var(--red)",
          border: `1px solid ${isActive ? (isMirroring ? "rgba(0,255,136,0.25)" : "rgba(255,204,0,0.25)") : "rgba(255,51,85,0.25)"}`,
        }}>
          {isActive ? (isMirroring ? "TRADING" : "HOLDING CASH") : "OFFLINE"}
        </span>
        {mirror && (
          <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--dim)" }}>
            {isMirroring
              ? `Mirroring ${mirror.label} (score ${mirror.score?.toFixed(1) || '\u2014'})`
              : (mirror.reason || "Waiting for experiments to qualify")
            }
          </span>
        )}
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--dim)", marginLeft: "auto" }}>
          {lt.mode?.toUpperCase()}
        </span>
      </div>

      {/* KPIs — only show when active */}
      {isActive && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginTop: 12 }}>
          <KPI label="PORTFOLIO" value={fmt$(pv)} />
          <KPI label="POSITIONS" value={posCount} color={posCount > 0 ? "var(--green)" : "var(--dim)"} />
          <KPI label="TRADES" value={lt.trades?.length || 0} />
          {isMirroring && mirror.switchedAt && (
            <KPI label="MIRRORING SINCE" value={new Date(mirror.switchedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} />
          )}
        </div>
      )}

      {/* Open positions */}
      {posCount > 0 && (
        <div style={{ marginTop: 10 }}>
          {Object.values(positions).map((pos) => {
            const curPrice = pos.livePrice || pos.entryPrice;
            const pnlPct = pos.entryPrice ? ((curPrice - pos.entryPrice) / pos.entryPrice * 100) : 0;
            const pnlVal = (pnlPct / 100) * (pos.notional || 0);
            return (
              <div key={pos.symbol} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "6px 0", borderTop: "1px solid rgba(255,255,255,0.04)",
                fontFamily: "var(--font-mono)", fontSize: 12,
              }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 16, letterSpacing: 2, color: "var(--text)", minWidth: 50 }}>
                  {pos.symbol?.replace("/USD", "")}
                </span>
                <span style={{ color: "var(--dim)" }}>@ {fmt$(pos.entryPrice)}</span>
                <span style={{ color: "var(--dim)" }}>{fmt$(pos.notional)}</span>
                <span style={{ color: pnlPct >= 0 ? "var(--green)" : "var(--red)", marginLeft: "auto", fontWeight: 600 }}>
                  {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}% ({pnlVal >= 0 ? "+" : ""}{fmt$(pnlVal)})
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Experiment qualification status */}
      {evaluation?.scores && (
        <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
          {[
            { key: "main", name: "Exp 1" },
            { key: "exp1", name: "Exp 2" },
            { key: "exp2", name: "Exp 3" },
          ].map(({ key, name }) => {
            const es = evaluation.scores[key];
            if (!es) return null;
            const isWinner = evaluation.winner === key;
            return (
              <span key={key} style={{
                fontFamily: "var(--font-mono)", fontSize: 10,
                padding: "3px 8px", borderRadius: 3,
                background: isWinner ? "rgba(0,255,136,0.1)" : "rgba(255,255,255,0.03)",
                color: isWinner ? "var(--green)" : "var(--dim)",
                border: `1px solid ${isWinner ? "rgba(0,255,136,0.2)" : "var(--border)"}`,
              }}>
                {name}: {es.eligible ? `${es.score.toFixed(1)} pts` : (es.reason || "not eligible")}
                {isWinner ? " \u2713" : ""}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KPI({ label, value, color }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: 2, color: "var(--dim)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: color || "var(--text)", lineHeight: 1 }}>{value}</div>
    </div>
  );
}
