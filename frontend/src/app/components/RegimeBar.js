import { fmt$ } from "./helpers";
import Tooltip from "./Tooltip";
import styles from "../page.module.css";

const REGIME_COLORS = {
  BULL_TRENDING: "#00ff88", BULL_WEAKENING: "#88cc44", BULL_PULLBACK: "#ccaa00",
  BEAR_RALLY: "#ccaa00", BEAR_TRENDING: "#ff3355", BEAR_EXHAUSTED: "#ff6680",
  CAPITULATION: "#ff0033", FLAT: "#888",
};

const REGIME_EXPLAINERS = {
  BULL_TRENDING: "Strong uptrend \u2014 full position sizes active.",
  BULL_WEAKENING: "Uptrend losing steam \u2014 reduced sizes, tighter stops.",
  BULL_PULLBACK: "Short-term dip in a bull market \u2014 often the best entry point.",
  BEAR_RALLY: "Bounce in a bear market \u2014 could be recovery or bull trap.",
  BEAR_TRENDING: "Active downtrend \u2014 defensive strategies only.",
  BEAR_EXHAUSTED: "Downtrend running out of energy \u2014 potential bottom.",
  CAPITULATION: "Panic selling \u2014 historically where bottoms form.",
  FLAT: "No clear trend \u2014 sitting out, no edge.",
};

export default function RegimeBar({ gate, regime, activeTab }) {
  if (!gate) return null;
  const isBull = gate.open;
  const fg = regime?.fearGreed;
  const dr = regime?.detailed;
  const drColor = dr ? (REGIME_COLORS[dr.state] || "#888") : "#888";
  const explainer = dr ? REGIME_EXPLAINERS[dr.state] : null;

  return (
    <>
      {/* Desktop: full detail row */}
      <div className={styles.regimeBarDesktop} style={{
        background: isBull ? "rgba(0,255,136,0.03)" : "rgba(255,51,85,0.05)",
      }}>
        <span style={{ fontSize: 14 }}>{isBull ? "\uD83D\uDFE2" : "\uD83D\uDD34"}</span>
        <span style={{ color: isBull ? "#00ff88" : "#ff3355", fontWeight: 600 }}>
          BTC Gate {isBull ? "Open" : "Closed"}
        </span>
        {dr && (
          <span style={{
            color: drColor, fontWeight: 700,
            background: "rgba(0,0,0,0.3)", padding: "2px 8px", borderRadius: 4,
            border: `1px solid ${drColor}44`,
          }}>
            {dr.label}
          </span>
        )}
        {fg && (
          <Tooltip label="F&G">
            <span style={{ color: fg.value < 20 ? "#ff3355" : fg.value > 60 ? "#00ff88" : "var(--yellow)" }}>
              | F&G: {fg.value} ({fg.label})
            </span>
          </Tooltip>
        )}
        {dr?.signals && (
          <span style={{ color: "#999", fontSize: 11 }}>
            | <Tooltip label="ADX"><span>ADX {dr.signals.adx}</span></Tooltip>
            {" | "}<Tooltip label="RSI"><span>RSI {dr.signals.rsi}</span></Tooltip>
            {" | "}<Tooltip label="Gap"><span>Gap {dr.signals.gapPct}%</span></Tooltip>
          </span>
        )}
        {!isBull && regime?.current === "bear" && (
          <span style={{ color: "#ff3355", fontWeight: 700 }}>
            | {activeTab === "experiment2" ? "BTC Accumulation Active" : "Range Trading Active"}
          </span>
        )}
        <span style={{ color: "#666", marginLeft: "auto" }}>
          {(regime?.btcPrice || gate.btcPrice) > 0 ? `BTC ${fmt$(regime?.btcPrice || gate.btcPrice)} / 50-SMA ${fmt$(regime?.sma50 || gate.sma50)}` : "Loading..."}
        </span>
      </div>

      {/* Mobile: compact 2-line status */}
      <div className={styles.regimeBarMobile} style={{
        background: isBull ? "rgba(0,255,136,0.03)" : "rgba(255,51,85,0.05)",
      }}>
        <div className={styles.regimeBarMobileTop}>
          <span style={{ fontSize: 14 }}>{isBull ? "\uD83D\uDFE2" : "\uD83D\uDD34"}</span>
          {dr && <span style={{ color: drColor, fontWeight: 700, fontSize: 13 }}>{dr.label}</span>}
          {fg && (
            <span style={{ color: fg.value < 20 ? "#ff3355" : fg.value > 60 ? "#00ff88" : "var(--dim)", fontSize: 12 }}>
              F&G {fg.value}
            </span>
          )}
          <span style={{ color: "#666", marginLeft: "auto", fontSize: 11 }}>
            BTC {fmt$(regime?.btcPrice || gate.btcPrice)}
          </span>
        </div>
        {explainer && (
          <div className={styles.regimeBarMobileSub}>{explainer}</div>
        )}
      </div>
    </>
  );
}
