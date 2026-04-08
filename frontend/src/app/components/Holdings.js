import styles from "../page.module.css";
import { fmt$ } from "./helpers";

const BOT_META = {
  main: { label: "Exp 1", color: "#00ff88" },
  exp1: { label: "Exp 2", color: "#4488ff" },
  exp2: { label: "Exp 3", color: "#ff9900" },
};

function formatHold(entryTime) {
  if (!entryTime) return "\u2014";
  const ms = Date.now() - new Date(entryTime).getTime();
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min}m`;
  const hrs = (ms / 3600000).toFixed(1);
  if (hrs < 24) return `${hrs}h`;
  return `${(ms / 86400000).toFixed(1)}d`;
}

function positionType(pos) {
  if (pos.scalpMode && pos.btcScalp) return "BTC Scalp";
  if (pos.scalpMode) return "Scalp";
  if (pos.bearRally) return "Bear Rally";
  if (pos.bearMode) return "Bear";
  return "Swing";
}

export default function Holdings({ statuses }) {
  // Collect all positions across bots
  const allPositions = [];
  for (const { key, status } of statuses) {
    if (!status?.positions) continue;
    for (const pos of Object.values(status.positions)) {
      const curPrice = pos.livePrice || pos.entryPrice;
      const pnlPct = pos.entryPrice ? ((curPrice - pos.entryPrice) / pos.entryPrice) * 100 : 0;
      const pnlUsd = (pnlPct / 100) * (pos.notional || 0);
      allPositions.push({ ...pos, botKey: key, curPrice, pnlPct, pnlUsd });
    }
  }

  if (allPositions.length === 0) return null;

  // Group by coin for the summary
  const byCoin = {};
  for (const p of allPositions) {
    const coin = p.symbol?.replace("/USD", "");
    if (!byCoin[coin]) byCoin[coin] = { coin, positions: [], totalNotional: 0, totalPnl: 0 };
    byCoin[coin].positions.push(p);
    byCoin[coin].totalNotional += p.notional || 0;
    byCoin[coin].totalPnl += p.pnlUsd;
  }

  const totalInvested = allPositions.reduce((s, p) => s + (p.notional || 0), 0);
  const totalPnl = allPositions.reduce((s, p) => s + p.pnlUsd, 0);

  return (
    <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 12 }}>
        <span className={styles.chartLabel} style={{ marginBottom: 0 }}>CURRENT HOLDINGS</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--dim)" }}>
          {allPositions.length} position{allPositions.length !== 1 ? "s" : ""} {"\u00B7"} {fmt$(totalInvested)} invested {"\u00B7"}{" "}
          <span style={{ color: totalPnl >= 0 ? "var(--green)" : "var(--red)" }}>
            {totalPnl >= 0 ? "+" : ""}{fmt$(totalPnl)}
          </span>
        </span>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {allPositions.map((p) => {
          const coin = p.symbol?.replace("/USD", "");
          const bot = BOT_META[p.botKey];
          const type = positionType(p);
          return (
            <div key={`${p.botKey}-${p.symbol}`} style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr auto",
              gap: 12, alignItems: "center",
              padding: "10px 14px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid var(--border)",
              borderRadius: 6,
            }}>
              {/* Coin + bot badge */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 20, letterSpacing: 2, color: "var(--text)" }}>
                  {coin}
                </span>
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: 1,
                  padding: "2px 6px", borderRadius: 3,
                  background: `${bot.color}15`, color: bot.color,
                  border: `1px solid ${bot.color}30`,
                }}>
                  {bot.label}
                </span>
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: 1,
                  padding: "2px 6px", borderRadius: 3,
                  background: "rgba(255,255,255,0.04)", color: "var(--dim)",
                }}>
                  {type}
                </span>
              </div>

              {/* Price + details */}
              <div style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--dim)", lineHeight: 1.6 }}>
                <span>Entry {fmt$(p.entryPrice)} {">"} Now {fmt$(p.curPrice)}</span>
                <span style={{ marginLeft: 10 }}>{fmt$(p.notional)} | {formatHold(p.entryTime)}</span>
              </div>

              {/* P&L */}
              <div style={{ textAlign: "right" }}>
                <div style={{
                  fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 600,
                  color: p.pnlPct >= 0 ? "var(--green)" : "var(--red)",
                }}>
                  {p.pnlPct >= 0 ? "+" : ""}{p.pnlPct.toFixed(2)}%
                </div>
                <div style={{
                  fontFamily: "var(--font-mono)", fontSize: 11,
                  color: p.pnlUsd >= 0 ? "var(--green)" : "var(--red)",
                }}>
                  {p.pnlUsd >= 0 ? "+" : ""}{fmt$(p.pnlUsd)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
