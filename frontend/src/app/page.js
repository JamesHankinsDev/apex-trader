"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./page.module.css";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// ─── HELPERS ──────────────────────────────────────────────────
const fmt$ = (v) => {
  if (v == null || !isFinite(v)) return "$—";
  return `$${Math.abs(v) < 0.01 ? v.toFixed(4) : v.toFixed(2)}`;
};
const fmtPct = (v) => {
  if (v == null || !isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
};
const fmtTime = (iso) =>
  iso ? new Date(iso).toLocaleTimeString("en-US", { hour12: false }) : "—";

// ─── EQUITY CHART ─────────────────────────────────────────────
function EquityChart({ data, startValue, equalHistory, mcapHistory, btcHistory }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data?.length) return;
    const container = canvas.parentElement;
    const W = container.clientWidth - 8;
    const H = Math.max(160, container.clientHeight - 50);
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, W, H);

    // Combine all values to compute shared Y-axis range
    const vals = data.map((d) => d.v);
    const eqVals = equalHistory?.map((d) => d.v) || [];
    const mcVals = mcapHistory?.map((d) => d.v) || [];
    const btcVals = btcHistory?.map((d) => d.v) || [];
    const allVals = [...vals, ...eqVals, ...mcVals, ...btcVals].filter((v) => v > 0);
    const minV = Math.min(...allVals) * 0.998;
    const maxV = Math.max(...allVals) * 1.002;
    const range = maxV - minV || 1;
    const toY = (v) => H - ((v - minV) / range) * H;

    // Helper to draw a line from a data array
    const drawLine = (arr, maxPts, color, lineWidth, dashed) => {
      if (!arr || arr.length < 2) return;
      const step = Math.max(1, Math.floor(arr.length / maxPts));
      const pts = arr.filter((_, i) => i % step === 0 || i === arr.length - 1);
      const toXLocal = (i) => (i / (pts.length - 1)) * W;
      if (dashed) ctx.setLineDash([6, 4]);
      else ctx.setLineDash([]);
      ctx.beginPath();
      pts.forEach((d, i) =>
        i === 0 ? ctx.moveTo(toXLocal(i), toY(d.v)) : ctx.lineTo(toXLocal(i), toY(d.v)),
      );
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
      ctx.setLineDash([]);
    };

    const toX = (i) => (i / (data.length - 1)) * W;

    // Grid
    ctx.strokeStyle = "rgba(26,26,46,0.8)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (i / 4) * H;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      ctx.fillStyle = "#444466";
      ctx.font = "10px Share Tech Mono, monospace";
      ctx.fillText(`$${(maxV - (i / 4) * range).toFixed(2)}`, 4, y + 12);
    }

    // Baseline
    if (startValue) {
      const baseY = toY(startValue);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "rgba(68,136,255,0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, baseY);
      ctx.lineTo(W, baseY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Benchmark lines (draw behind portfolio line)
    drawLine(equalHistory, data.length, "rgba(255,204,0,0.5)", 1.5, true);  // yellow dashed
    drawLine(mcapHistory, data.length, "rgba(168,85,247,0.5)", 1.5, true);  // purple dashed
    drawLine(btcHistory, data.length, "rgba(255,153,0,0.5)", 1.5, true);    // orange dashed

    const isUp = vals[vals.length - 1] >= vals[0];
    const color = isUp ? "#00ff88" : "#ff3355";

    // Fill
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, isUp ? "rgba(0,255,136,0.2)" : "rgba(255,51,85,0.2)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.beginPath();
    ctx.moveTo(toX(0), H);
    data.forEach((d, i) => ctx.lineTo(toX(i), toY(d.v)));
    ctx.lineTo(toX(data.length - 1), H);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Portfolio line
    ctx.beginPath();
    data.forEach((d, i) =>
      i === 0 ? ctx.moveTo(toX(i), toY(d.v)) : ctx.lineTo(toX(i), toY(d.v)),
    );
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Dot
    const lx = toX(data.length - 1),
      ly = toY(vals[vals.length - 1]);
    ctx.beginPath();
    ctx.arc(lx, ly, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(lx, ly, 8, 0, Math.PI * 2);
    ctx.strokeStyle = isUp ? "rgba(0,255,136,0.3)" : "rgba(255,51,85,0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Legend
    const legendY = 14;
    const legendItems = [
      { label: "Portfolio", color: color, dashed: false },
      { label: "BTC Hold", color: "rgba(255,153,0,0.8)", dashed: true },
      { label: "Equal Wt", color: "rgba(255,204,0,0.8)", dashed: true },
      { label: "Mcap Wt", color: "rgba(168,85,247,0.8)", dashed: true },
    ];
    let legendX = W - 340;
    ctx.font = "10px Share Tech Mono, monospace";
    for (const item of legendItems) {
      ctx.beginPath();
      if (item.dashed) ctx.setLineDash([4, 3]);
      else ctx.setLineDash([]);
      ctx.moveTo(legendX, legendY);
      ctx.lineTo(legendX + 18, legendY);
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = item.color;
      ctx.fillText(item.label, legendX + 22, legendY + 4);
      legendX += 85;
    }
  }, [data, startValue, equalHistory, mcapHistory, btcHistory]);

  return <canvas ref={canvasRef} style={{ display: "block", width: "100%" }} />;
}

// ─── WEEKLY PROGRESS CHART ────────────────────────────────────
function WeeklyChart({ snapshots }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !snapshots?.length) return;
    const container = canvas.parentElement;
    const W = container.clientWidth - 8;
    const H = 100;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, W, H);

    const bots = [
      { key: "main", color: "#00ff88", label: "Main" },
      { key: "exp1", color: "#4488ff", label: "Exp1" },
      { key: "exp2", color: "#ff9900", label: "Exp2" },
    ];

    // Collect all return values for Y range
    const allVals = [];
    for (const b of bots) {
      for (const s of snapshots) {
        if (s[b.key]?.totalReturnPct != null) allVals.push(s[b.key].totalReturnPct);
      }
    }
    if (allVals.length === 0) return;

    const minV = Math.min(0, ...allVals) - 1;
    const maxV = Math.max(0, ...allVals) + 1;
    const range = maxV - minV || 1;
    const toY = (v) => H - ((v - minV) / range) * H;
    const toX = (i) => snapshots.length > 1 ? (i / (snapshots.length - 1)) * W : W / 2;

    // Zero line
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, toY(0));
    ctx.lineTo(W, toY(0));
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw lines per bot
    for (const b of bots) {
      const pts = snapshots.map((s) => s[b.key]?.totalReturnPct ?? 0);
      ctx.beginPath();
      pts.forEach((v, i) => (i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v))));
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Dot at end
      if (pts.length > 0) {
        const lastI = pts.length - 1;
        ctx.beginPath();
        ctx.arc(toX(lastI), toY(pts[lastI]), 3, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.fill();
      }
    }

    // Legend
    let lx = 8;
    ctx.font = "10px Share Tech Mono, monospace";
    for (const b of bots) {
      ctx.beginPath();
      ctx.moveTo(lx, 10);
      ctx.lineTo(lx + 14, 10);
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = b.color;
      ctx.fillText(b.label, lx + 18, 14);
      lx += 60;
    }
  }, [snapshots]);

  return <canvas ref={canvasRef} style={{ display: "block", width: "100%" }} />;
}

// ─── MAIN PAGE ────────────────────────────────────────────────
export default function Dashboard() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [clock, setClock] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [mode, setMode] = useState("paper");
  const [showGuide, setShowGuide] = useState(false);
  const [config, setConfig] = useState(null);
  const [activeTab, setActiveTab] = useState("main");
  const [expStatus, setExpStatus] = useState(null);
  const [expConnecting, setExpConnecting] = useState(false);
  const [exp2Status, setExp2Status] = useState(null);
  const [exp2Connecting, setExp2Connecting] = useState(false);
  const [leaderboard, setLeaderboard] = useState(null);

  // Clock
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString("en-US", { hour12: false }) + " EST");
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Poll status every 5s
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/status`);
      console.log({ res });
      if (res.ok) setStatus(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 5000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  // Poll experiment status
  const fetchExpStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/experiment/status`);
      if (res.ok) setExpStatus(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    fetchExpStatus();
    const id = setInterval(fetchExpStatus, 5000);
    return () => clearInterval(id);
  }, [fetchExpStatus]);

  // Poll experiment 2 status
  const fetchExp2Status = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/bot2/status`);
      if (res.ok) setExp2Status(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    fetchExp2Status();
    const id = setInterval(fetchExp2Status, 5000);
    return () => clearInterval(id);
  }, [fetchExp2Status]);

  // Poll leaderboard every 60s
  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/leaderboard`);
      if (res.ok) setLeaderboard(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    fetchLeaderboard();
    const id = setInterval(fetchLeaderboard, 60000);
    return () => clearInterval(id);
  }, [fetchLeaderboard]);

  // Sync config from backend (read-only, set via env variables)
  useEffect(() => {
    if (status?.config) {
      setConfig({
        positionSize: Math.round(status.config.positionSize * 100),
        stopLoss: Math.round(status.config.stopLoss * 100),
        takeProfit: Math.round(status.config.takeProfit * 100),
        rsiBuy: status.config.rsiBuy,
        rsiSell: status.config.rsiSell,
        scanInterval: status.config.scanInterval,
        maxPositions: status.config.maxPositions,
        dailyLossLimit: Math.round(status.config.dailyLossLimit * 100),
        maxHoldHours: status.config.maxHoldHours,
        entryScoreThreshold: status.config.entryScoreThreshold,
        profitGiveback: Math.round(status.config.profitGiveback * 100),
      });
      setMode(status.mode);
    }
  }, [status]);

  const handleStart = async () => {
    setConnecting(true);
    try {
      await fetch(`${API}/api/start`, { method: "POST" });
      await fetchStatus();
    } finally {
      setConnecting(false);
    }
  };

  const handleStop = async () => {
    await fetch(`${API}/api/stop`, { method: "POST" });
    await fetchStatus();
  };

  const running = status?.running;
  const hasData = status?.portfolioValue > 0;
  const pv = status?.portfolioValue || 0;
  const sv = status?.startValue || pv;
  const tsv = status?.todayStartValue || pv;
  const todayPnl = hasData ? pv - tsv : 0;
  const totalPnl = hasData ? pv - sv : 0;
  const todayPct = hasData && tsv > 0 ? (todayPnl / tsv) * 100 : 0;

  // Compute biggest gain/loss from trades
  const trades = status?.trades || [];
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayTrades = trades.filter(
    (t) => t.pnl != null && new Date(t.time) >= todayStart,
  );
  const allClosedTrades = trades.filter((t) => t.pnl != null);

  const biggestGainToday = todayTrades.reduce(
    (max, t) => (t.pnl > max ? t.pnl : max),
    0,
  );
  const biggestLossToday = todayTrades.reduce(
    (min, t) => (t.pnl < min ? t.pnl : min),
    0,
  );
  const biggestGainAll = allClosedTrades.reduce(
    (max, t) => (t.pnl > max ? t.pnl : max),
    0,
  );
  const biggestLossAll = allClosedTrades.reduce(
    (min, t) => (t.pnl < min ? t.pnl : min),
    0,
  );

  return (
    <div style={{ position: "relative", zIndex: 1 }}>
      {/* HEADER */}
      <header className={styles.header}>
        <div className={styles.logo}>
          APEX<span>TRADER</span>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.pill}>
            <div
              className={`${styles.dot} ${running ? styles.dotGreen : styles.dotRed}`}
            />
            <span>{running ? "RUNNING" : "OFFLINE"}</span>
          </div>
          <div className={styles.pill}>
            <span style={{ color: "var(--dim)" }}>MODE:</span>&nbsp;
            <span
              style={{
                color: mode === "live" ? "var(--red)" : "var(--yellow)",
              }}
            >
              {mode.toUpperCase()}
            </span>
          </div>
          <div className={styles.modeToggle}>
            <button
              className={`${styles.modeBtn} ${mode === "paper" ? styles.modePaper : ""}`}
              onClick={() => !running && setMode("paper")}
            >
              PAPER
            </button>
            <button
              className={`${styles.modeBtn} ${mode === "live" ? styles.modeLive : ""}`}
              onClick={() => !running && setMode("live")}
            >
              LIVE
            </button>
          </div>
          <button
            className={styles.guideBtn}
            onClick={() => setShowGuide(true)}
          >
            ? STRATEGY GUIDE
          </button>
          <div
            className={styles.pill}
            style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}
          >
            {clock}
          </div>
        </div>
      </header>

      {/* LEADERBOARD */}
      {leaderboard && (() => {
        const lb = leaderboard;
        const bots = [
          { key: "main", name: "Main (Momentum)" },
          { key: "exp1", name: "Exp 1 (Mean Rev)" },
          { key: "exp2", name: "Exp 2 (Hybrid)" },
        ];
        return (
          <div style={{
            padding: "12px 20px",
            borderBottom: "1px solid var(--border)",
            background: "rgba(5,5,8,0.9)",
          }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 14, letterSpacing: 2, color: "var(--text)" }}>
                LEADERBOARD
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--dim)" }}>
                Paper trading — $100 per bot | Winner goes live
              </span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{
                width: "100%", borderCollapse: "collapse",
                fontFamily: "var(--font-mono)", fontSize: 11,
              }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--dim)" }}>
                    <th style={{ textAlign: "left", padding: "4px 8px" }}>Bot</th>
                    <th style={{ textAlign: "right", padding: "4px 8px" }}>Balance</th>
                    <th style={{ textAlign: "right", padding: "4px 8px" }}>Return</th>
                    <th style={{ textAlign: "right", padding: "4px 8px" }}>Win Rate</th>
                    <th style={{ textAlign: "right", padding: "4px 8px" }}>Sharpe</th>
                    <th style={{ textAlign: "right", padding: "4px 8px" }}>Bull P&L</th>
                    <th style={{ textAlign: "right", padding: "4px 8px" }}>Bear P&L</th>
                    <th style={{ textAlign: "right", padding: "4px 8px" }}>Trades</th>
                    <th style={{ textAlign: "center", padding: "4px 8px" }}>Leader</th>
                  </tr>
                </thead>
                <tbody>
                  {bots.map((b) => {
                    const s = lb.bots[b.key];
                    if (!s) return null;
                    const isLeader = lb.leader === b.key;
                    return (
                      <tr key={b.key} style={{
                        borderBottom: "1px solid var(--border)",
                        background: isLeader ? "rgba(0,255,136,0.06)" : "transparent",
                      }}>
                        <td style={{ padding: "6px 8px", color: "var(--text)", fontWeight: isLeader ? 600 : 400 }}>
                          {b.name}
                        </td>
                        <td style={{ textAlign: "right", padding: "6px 8px" }}>
                          {fmt$(s.currentBalance)}
                        </td>
                        <td style={{
                          textAlign: "right", padding: "6px 8px",
                          color: s.totalReturnPct >= 0 ? "var(--green)" : "var(--red)",
                        }}>
                          {fmtPct(s.totalReturnPct)}
                        </td>
                        <td style={{ textAlign: "right", padding: "6px 8px" }}>
                          {s.totalTrades > 0 ? `${s.winRate.toFixed(0)}%` : "—"}
                        </td>
                        <td style={{ textAlign: "right", padding: "6px 8px" }}>
                          {s.sharpeRatio != null ? s.sharpeRatio.toFixed(2) : "—"}
                        </td>
                        <td style={{
                          textAlign: "right", padding: "6px 8px",
                          color: s.bullReturnPct >= 0 ? "var(--green)" : "var(--red)",
                        }}>
                          {s.bullTrades > 0 ? fmtPct(s.bullReturnPct) : "—"}
                        </td>
                        <td style={{
                          textAlign: "right", padding: "6px 8px",
                          color: s.bearReturnPct >= 0 ? "var(--green)" : "var(--red)",
                        }}>
                          {s.bearTrades > 0 ? fmtPct(s.bearReturnPct) : "—"}
                        </td>
                        <td style={{ textAlign: "right", padding: "6px 8px" }}>
                          {s.totalTrades}
                        </td>
                        <td style={{ textAlign: "center", padding: "6px 8px" }}>
                          {isLeader ? "\uD83C\uDFC6" : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {lb.weeklySnapshots?.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--dim)", marginBottom: 4 }}>
                  WEEKLY PROGRESS (Total Return %)
                </div>
                <WeeklyChart snapshots={lb.weeklySnapshots} />
              </div>
            )}
          </div>
        );
      })()}

      {/* TABS */}
      <div className={styles.tabBar}>
        {(() => {
          const r = status?.regime || expStatus?.regime || exp2Status?.regime;
          const badge = r ? (r.current === "bear" ? " \uD83D\uDD34 BEAR" : " \uD83D\uDFE2 BULL") : "";
          return <>
            <button className={activeTab === "main" ? styles.tabActive : styles.tab} onClick={() => setActiveTab("main")}>
              Main Bot (Momentum){badge}
            </button>
            <button className={activeTab === "experiment" ? styles.tabActive : styles.tab} onClick={() => setActiveTab("experiment")}>
              Experiment 1 (Mean Reversion){badge}
            </button>
            <button className={activeTab === "experiment2" ? styles.tabActive : styles.tab} onClick={() => setActiveTab("experiment2")}>
              Experiment 2 (Hybrid){badge}
            </button>
          </>;
        })()}
      </div>

      {/* BTC MACRO GATE + REGIME INDICATOR */}
      {(() => {
        const gate = status?.btcGate || expStatus?.btcGate || exp2Status?.btcGate;
        const regime = status?.regime || expStatus?.regime || exp2Status?.regime;
        if (!gate) return null;
        const isBull = gate.open;
        const fg = regime?.fearGreed;
        return (
          <div style={{
            display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
            padding: "8px 20px",
            borderBottom: "1px solid var(--border)",
            background: isBull ? "rgba(0,255,136,0.05)" : "rgba(255,51,85,0.08)",
            fontFamily: "var(--font-mono)", fontSize: 12,
          }}>
            <span style={{ fontSize: 14 }}>{isBull ? "\uD83D\uDFE2" : "\uD83D\uDD34"}</span>
            <span style={{ color: isBull ? "#00ff88" : "#ff3355", fontWeight: 600 }}>
              BTC Gate {isBull ? "Open" : "Closed"}
            </span>
            {fg && (
              <span style={{ color: fg.value < 20 ? "#ff3355" : fg.value > 60 ? "#00ff88" : "var(--yellow)" }}>
                | Fear & Greed: {fg.value} ({fg.label})
              </span>
            )}
            {!isBull && regime?.current === "bear" && (
              <span style={{ color: "#ff3355", fontWeight: 700 }}>
                {"\u26A1"} Range Trading Active
              </span>
            )}
            {!isBull && regime?.bearChannel?.support && (
              <span style={{ color: "#ff6680", fontSize: 11 }}>
                | Bear Channel: {fmt$(regime.bearChannel.support)} → {fmt$(regime.bearChannel.resist)} | Width: {regime.bearChannel.width}%
              </span>
            )}
            <span style={{ color: "#666", marginLeft: "auto" }}>
              {(regime?.btcPrice || gate.btcPrice) > 0 ? `BTC ${fmt$(regime?.btcPrice || gate.btcPrice)} / 50-SMA ${fmt$(regime?.sma50 || gate.sma50)}` : "Loading BTC data..."}
            </span>
          </div>
        );
      })()}

      {/* ═══ MAIN TAB ═══ */}
      {activeTab === "main" && <>

      {/* STATS BAR */}
      <div className={styles.statsBar}>
        {[
          {
            label: "PORTFOLIO VALUE",
            val: fmt$(pv),
            sub: `${totalPnl >= 0 ? "+" : ""}${fmt$(totalPnl)} all time`,
            color: totalPnl >= 0 ? "var(--green)" : "var(--red)",
          },
          {
            label: "TODAY P&L",
            val: `${todayPnl >= 0 ? "+" : ""}${fmt$(todayPnl)}`,
            sub: fmtPct(todayPct),
            color: todayPnl >= 0 ? "var(--green)" : "var(--red)",
          },
          {
            label: "TOTAL TRADES",
            val: status?.totalTrades || 0,
            sub: `Win rate: ${status?.winRate != null ? status.winRate + "%" : "—"}`,
            color: "var(--blue)",
          },
          {
            label: "OPEN POSITIONS",
            val: Object.keys(status?.positions || {}).length,
            sub: `Last scan: ${fmtTime(status?.lastScan)}`,
            color: "var(--yellow)",
          },
        ].map((s) => (
          <div className={styles.statBlock} key={s.label}>
            <div className={styles.statLabel}>{s.label}</div>
            <div className={styles.statVal} style={{ color: s.color }}>
              {s.val}
            </div>
            <div className={styles.statSub}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* MOBILE KPIs */}
      <div className={styles.mobileKpis}>
        <div className={styles.mobileKpiRow}>
          <div className={styles.mobileKpiCard}>
            <div className={styles.mobileKpiLabel}>TODAY P&L</div>
            <div
              className={styles.mobileKpiVal}
              style={{ color: todayPnl >= 0 ? "var(--green)" : "var(--red)" }}
            >
              {todayPnl >= 0 ? "+" : ""}
              {fmt$(todayPnl)}
            </div>
            <div className={styles.mobileKpiSub}>{fmtPct(todayPct)}</div>
          </div>
          <div className={styles.mobileKpiCard}>
            <div className={styles.mobileKpiLabel}>ALL-TIME P&L</div>
            <div
              className={styles.mobileKpiVal}
              style={{ color: totalPnl >= 0 ? "var(--green)" : "var(--red)" }}
            >
              {totalPnl >= 0 ? "+" : ""}
              {fmt$(totalPnl)}
            </div>
            <div className={styles.mobileKpiSub}>
              {fmtPct((totalPnl / sv) * 100 || 0)}
            </div>
          </div>
        </div>
        <div className={styles.mobileKpiRow}>
          <div className={styles.mobileKpiCard}>
            <div className={styles.mobileKpiLabel}>BEST TODAY</div>
            <div
              className={styles.mobileKpiVal}
              style={{ color: biggestGainToday > 0 ? "var(--green)" : "var(--dim)" }}
            >
              {biggestGainToday > 0 ? `+${fmt$(biggestGainToday)}` : "—"}
            </div>
          </div>
          <div className={styles.mobileKpiCard}>
            <div className={styles.mobileKpiLabel}>WORST TODAY</div>
            <div
              className={styles.mobileKpiVal}
              style={{ color: biggestLossToday < 0 ? "var(--red)" : "var(--dim)" }}
            >
              {biggestLossToday < 0 ? `-${fmt$(Math.abs(biggestLossToday))}` : "—"}
            </div>
          </div>
        </div>
        <div className={styles.mobileKpiRow}>
          <div className={styles.mobileKpiCard}>
            <div className={styles.mobileKpiLabel}>BEST ALL-TIME</div>
            <div
              className={styles.mobileKpiVal}
              style={{ color: biggestGainAll > 0 ? "var(--green)" : "var(--dim)" }}
            >
              {biggestGainAll > 0 ? `+${fmt$(biggestGainAll)}` : "—"}
            </div>
          </div>
          <div className={styles.mobileKpiCard}>
            <div className={styles.mobileKpiLabel}>WORST ALL-TIME</div>
            <div
              className={styles.mobileKpiVal}
              style={{ color: biggestLossAll < 0 ? "var(--red)" : "var(--dim)" }}
            >
              {biggestLossAll < 0 ? `-${fmt$(Math.abs(biggestLossAll))}` : "—"}
            </div>
          </div>
        </div>
      </div>

      {/* MAIN GRID */}
      <div className={styles.grid}>
        {/* LEFT: Signals */}
        <div className={styles.panel}>
          <div className={styles.panelTitle}>▲ LIVE SIGNALS</div>
          {(status?.signals || []).length === 0 ? (
            <div className={styles.empty}>
              No signals yet — start bot to scan
            </div>
          ) : (
            status.signals.map((s) => (
              <div
                key={s.symbol}
                className={`${styles.signalCard} ${s.score >= 70 ? styles.hot : s.score >= 50 ? styles.warm : styles.cold}`}
              >
                <div className={styles.signalHeader}>
                  <span className={styles.ticker}>
                    {s.symbol.replace("/USD", "")}
                  </span>
                  <span
                    className={`${styles.scoreTag} ${s.score >= 70 ? styles.scoreHigh : s.score >= 50 ? styles.scoreMed : styles.scoreLow}`}
                  >
                    SCORE {s.score}
                  </span>
                </div>
                <div className={styles.metrics}>
                  {[
                    {
                      l: "PRICE",
                      v: s.price != null ? (s.price < 1 ? s.price.toFixed(4) : s.price.toFixed(2)) : "—",
                      prefix: s.price != null ? "$" : "",
                    },
                    {
                      l: "RSI",
                      v: s.rsi?.toFixed(1),
                      color:
                        s.rsi < 35
                          ? "var(--green)"
                          : s.rsi > 70
                            ? "var(--red)"
                            : "",
                    },
                    {
                      l: "VOLUME",
                      v: `×${s.volumeRatio?.toFixed(2)}`,
                      color: s.volumeRatio > 1.8 ? "var(--green)" : "",
                    },
                    {
                      l: "MOM",
                      v: `${s.momentum >= 0 ? "+" : ""}${s.momentum?.toFixed(2)}%`,
                      color: s.momentum > 0 ? "var(--green)" : "var(--red)",
                    },
                  ].map((m) => (
                    <div key={m.l} className={styles.metric}>
                      <span className={styles.metricLabel}>{m.l}</span>
                      <span
                        className={styles.metricVal}
                        style={{ color: m.color || "var(--text)" }}
                      >
                        {m.prefix || ""}
                        {m.v}
                      </span>
                    </div>
                  ))}
                </div>
                {s.stale && (
                  <div className={styles.reasons} style={{ color: "var(--yellow)" }}>
                    ⚠ Bar data {s.barAgeMin}min stale — indicators unreliable
                  </div>
                )}
                {s.reasons?.length > 0 && !s.stale && (
                  <div className={styles.reasons}>
                    {s.reasons.slice(0, 2).join(" · ")}
                  </div>
                )}
              </div>
            ))
          )}

          <div className={styles.panelTitle} style={{ marginTop: 8 }}>
            ▲ OPEN POSITIONS
          </div>
          {Object.keys(status?.positions || {}).length === 0 ? (
            <div className={styles.empty}>No open positions</div>
          ) : (
            Object.values(status.positions).map((pos) => {
              // Use live price (set during scan), fallback to signal bar close
              const sig = (status?.signals || []).find(
                (s) => s.symbol === pos.symbol,
              );
              const curPrice = pos.livePrice || sig?.price || pos.entryPrice;
              const pnlPct = pos.entryPrice
                ? ((curPrice - pos.entryPrice) / pos.entryPrice) * 100
                : 0;
              const pnlVal = (pnlPct / 100) * pos.notional;
              return (
                <div key={pos.symbol} className={styles.posCard}>
                  <div className={styles.posHeader}>
                    <span className={styles.ticker}>
                      {pos.symbol?.replace("/USD", "")}
                    </span>
                    <span
                      className={styles.posEntry}
                      style={{
                        color:
                          pnlPct >= 0 ? "var(--green)" : "var(--red)",
                      }}
                    >
                      {pnlPct >= 0 ? "+" : ""}
                      {pnlPct.toFixed(2)}% ({pnlVal >= 0 ? "+" : ""}
                      {fmt$(pnlVal)})
                    </span>
                  </div>
                  <div className={styles.posDetails}>
                    Entry {fmt$(pos.entryPrice)} · Now{" "}
                    {fmt$(curPrice)}
                  </div>
                  <div className={styles.posDetails}>
                    SL {fmt$(pos.stopPrice)} · TP {pos.targetPrice === "TRAILING" ? "🚀 Chasing Gains" : fmt$(pos.targetPrice)}
                  </div>
                  <div
                    className={styles.posDetails}
                    style={{ marginTop: 2, color: "var(--dim)" }}
                  >
                    {pos.entryTime ? new Date(pos.entryTime).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }) : "—"} · ${pos.notional?.toFixed(2)}{" "}
                    invested
                  </div>
                  <button
                    className={styles.btnSell}
                    onClick={async () => {
                      if (!confirm(`Sell ${pos.symbol?.replace("/USD", "")} now?`)) return;
                      try {
                        await fetch(`${API}/api/trade`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ symbol: pos.symbol, side: "sell" }),
                        });
                        fetchStatus();
                      } catch {}
                    }}
                  >
                    SELL
                  </button>
                </div>
              );
            })
          )}

          {/* Bear signal indicator */}
          {status?.regime?.current === "bear" && status?.lastBearSignal && (
            <div style={{ padding: "8px 12px", margin: "6px 0", background: "rgba(255,51,85,0.08)", border: "1px solid rgba(255,51,85,0.2)", borderRadius: 6, fontSize: 11, fontFamily: "var(--font-mono)", color: "#ff6680" }}>
              Last Range Trade: {status.lastBearSignal.coin?.replace("/USD", "")} | Entry: {fmt$(status.lastBearSignal.entryPrice)} | TP: {fmt$(status.lastBearSignal.tpPrice)} | {fmtTime(status.lastBearSignal.time)}
            </div>
          )}
        </div>

        {/* CENTER */}
        <div className={styles.center}>
          <div className={styles.chartArea}>
            <div className={styles.chartLabel}>PORTFOLIO EQUITY CURVE</div>
            <EquityChart
              data={status?.equityHistory || [{ t: Date.now(), v: 100 }]}
              startValue={sv}
              equalHistory={status?.benchmarks?.equalWeight?.history}
              mcapHistory={status?.benchmarks?.mcapWeight?.history}
              btcHistory={status?.benchmarks?.btcOnly?.history}
            />
          </div>

          {/* BENCHMARK COMPARISON */}
          {status?.benchmarks?.initialized && (
            <div className={styles.benchmarkBar}>
              {(() => {
                const bm = status.benchmarks;
                const portfolioPct = sv > 0 ? ((pv - sv) / sv) * 100 : 0;
                const btcPct = bm.btcOnly.pctReturn;
                const eqPct = bm.equalWeight.pctReturn;
                const mcPct = bm.mcapWeight.pctReturn;
                const vsBtc = portfolioPct - btcPct;
                const vsEqual = portfolioPct - eqPct;
                const vsMcap = portfolioPct - mcPct;
                return [
                  {
                    label: "PORTFOLIO",
                    val: fmtPct(portfolioPct),
                    sub: fmt$(pv),
                    color: portfolioPct >= 0 ? "var(--green)" : "var(--red)",
                  },
                  {
                    label: "BTC HOLD",
                    val: fmtPct(btcPct),
                    sub: fmt$(bm.btcOnly.value),
                    color: btcPct >= 0 ? "#ff9900" : "var(--red)",
                  },
                  {
                    label: "EQUAL WEIGHT",
                    val: fmtPct(eqPct),
                    sub: fmt$(bm.equalWeight.value),
                    color: eqPct >= 0 ? "var(--yellow)" : "var(--red)",
                  },
                  {
                    label: "MCAP WEIGHT",
                    val: fmtPct(mcPct),
                    sub: fmt$(bm.mcapWeight.value),
                    color: mcPct >= 0 ? "rgb(168,85,247)" : "var(--red)",
                  },
                  {
                    label: "VS BTC",
                    val: `${vsBtc >= 0 ? "+" : ""}${vsBtc.toFixed(2)}%`,
                    sub: vsBtc >= 0 ? "outperforming" : "underperforming",
                    color: vsBtc >= 0 ? "var(--green)" : "var(--red)",
                  },
                  {
                    label: "VS EQUAL",
                    val: `${vsEqual >= 0 ? "+" : ""}${vsEqual.toFixed(2)}%`,
                    sub: vsEqual >= 0 ? "outperforming" : "underperforming",
                    color: vsEqual >= 0 ? "var(--green)" : "var(--red)",
                  },
                  {
                    label: "VS MCAP",
                    val: `${vsMcap >= 0 ? "+" : ""}${vsMcap.toFixed(2)}%`,
                    sub: vsMcap >= 0 ? "outperforming" : "underperforming",
                    color: vsMcap >= 0 ? "var(--green)" : "var(--red)",
                  },
                ].map((s) => (
                  <div className={styles.benchmarkBlock} key={s.label}>
                    <div className={styles.benchmarkLabel}>{s.label}</div>
                    <div className={styles.benchmarkVal} style={{ color: s.color }}>
                      {s.val}
                    </div>
                    <div className={styles.benchmarkSub}>{s.sub}</div>
                  </div>
                ));
              })()}
            </div>
          )}

          {/* RISK METRICS */}
          {status?.riskMetrics && (status.wins + status.losses) > 0 && (
            <div className={styles.riskMetricsBar}>
              {(() => {
                const rm = status.riskMetrics;
                const sharpeColor = rm.sharpeRatio == null ? "var(--dim)" : rm.sharpeRatio >= 1 ? "var(--green)" : rm.sharpeRatio >= 0 ? "var(--yellow)" : "var(--red)";
                const sortinoColor = rm.sortinoRatio == null ? "var(--dim)" : rm.sortinoRatio >= 1.5 ? "var(--green)" : rm.sortinoRatio >= 0 ? "var(--yellow)" : "var(--red)";
                const pfColor = rm.profitFactor == null ? "var(--dim)" : rm.profitFactor >= 1.5 ? "var(--green)" : rm.profitFactor >= 1 ? "var(--yellow)" : "var(--red)";
                return [
                  { label: "SHARPE RATIO", val: rm.sharpeRatio != null ? rm.sharpeRatio.toFixed(2) : "—", sub: rm.sharpeRatio == null ? "need more trades" : rm.sharpeRatio >= 2 ? "excellent (≥2.0)" : rm.sharpeRatio >= 1 ? "good (target ≥2.0)" : rm.sharpeRatio >= 0 ? "fair (target ≥1.0)" : "poor (<0)", color: sharpeColor },
                  { label: "SORTINO RATIO", val: rm.sortinoRatio != null ? rm.sortinoRatio.toFixed(2) : "—", sub: rm.sortinoRatio == null ? "need more trades" : rm.sortinoRatio >= 3 ? "excellent (≥3.0)" : rm.sortinoRatio >= 1.5 ? "good (target ≥3.0)" : rm.sortinoRatio >= 0 ? "fair (target ≥1.5)" : "poor (<0)", color: sortinoColor },
                  { label: "MAX DRAWDOWN", val: `-${rm.maxDrawdownPct.toFixed(2)}%`, sub: fmt$(rm.maxDrawdown), color: rm.maxDrawdownPct > 10 ? "var(--red)" : "var(--yellow)" },
                  { label: "PROFIT FACTOR", val: rm.profitFactor != null ? rm.profitFactor.toFixed(2) : "—", sub: "wins / losses", color: pfColor },
                  { label: "AVG WIN/LOSS", val: rm.avgWinLossRatio != null ? `${rm.avgWinLossRatio.toFixed(2)}x` : "—", sub: `${fmt$(rm.avgWin)} / ${fmt$(rm.avgLoss)}`, color: rm.avgWinLossRatio >= 1.5 ? "var(--green)" : "var(--yellow)" },
                  { label: "STREAK", val: rm.currentStreak > 0 ? `${rm.currentStreak} ${rm.currentStreakType === "win" ? "W" : "L"}` : "—", sub: `Best: ${rm.maxWinStreak}W · Worst: ${rm.maxLossStreak}L`, color: rm.currentStreakType === "win" ? "var(--green)" : rm.currentStreakType === "loss" ? "var(--red)" : "var(--dim)" },
                ].map((s) => (
                  <div className={styles.riskBlock} key={s.label}>
                    <div className={styles.benchmarkLabel}>{s.label}</div>
                    <div className={styles.riskVal} style={{ color: s.color }}>{s.val}</div>
                    <div className={styles.benchmarkSub}>{s.sub}</div>
                  </div>
                ));
              })()}
            </div>
          )}

          {/* TRADE LOG */}
          <div className={styles.tradeLog}>
            <div className={`${styles.logRow} ${styles.logHeader}`}>
              <span>TIME</span>
              <span>PAIR</span>
              <span>SIDE</span>
              <span>QTY</span>
              <span>PRICE</span>
              <span>P&L</span>
            </div>
            {(status?.trades || []).length === 0 ? (
              <div className={styles.empty}>No trades yet</div>
            ) : (
              status.trades.slice(0, 20).map((t, i) => (
                <div key={i} className={styles.logRow}>
                  <span>{fmtTime(t.time)}</span>
                  <span>{t.symbol?.replace("/USD", "")}</span>
                  <span>
                    <span
                      className={`${styles.tag} ${t.side === "BUY" ? styles.tagBuy : styles.tagSell}`}
                    >
                      {t.side}
                    </span>
                  </span>
                  <span>{t.qty?.toFixed(4)}</span>
                  <span>{fmt$(t.price)}</span>
                  <span
                    style={{
                      color:
                        t.pnl == null
                          ? "inherit"
                          : t.pnl >= 0
                            ? "var(--green)"
                            : "var(--red)",
                    }}
                  >
                    {t.pnl == null
                      ? "—"
                      : `${t.pnl >= 0 ? "+" : ""}$${t.pnl.toFixed(2)}`}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT: Config */}
        <div className={`${styles.panel} ${styles.rightPanel}`}>
          <div className={styles.panelTitle}>▲ CONFIGURATION</div>

          {config && <div className={styles.configSection}>
            <div className={styles.configLabel}>STRATEGY PARAMETERS</div>
            {[
              { label: "Position Size", value: `${config.positionSize}%` },
              { label: "Stop Loss", value: `-${config.stopLoss}%` },
              { label: "Take Profit", value: `+${config.takeProfit}%` },
              { label: "RSI Buy Below", value: config.rsiBuy },
              { label: "RSI Sell Above", value: config.rsiSell },
              { label: "Scan Interval", value: `${config.scanInterval}s` },
            ].map((s) => (
              <div key={s.label} className={styles.configRow}>
                <span className={styles.configRowLabel}>{s.label}</span>
                <span className={styles.configRowVal}>{s.value}</span>
              </div>
            ))}

            <div className={styles.configLabel} style={{ marginTop: 16 }}>
              RISK MANAGEMENT
            </div>
            {[
              { label: "Max Positions", value: config.maxPositions },
              { label: "Entry Score Min", value: config.entryScoreThreshold },
              { label: "Daily Loss Limit", value: `-${config.dailyLossLimit}%` },
              { label: "Max Hold Time", value: `${config.maxHoldHours}h` },
              { label: "Profit Protect", value: `${config.profitGiveback}%` },
            ].map((s) => (
              <div key={s.label} className={styles.configRow}>
                <span className={styles.configRowLabel}>{s.label}</span>
                <span className={styles.configRowVal}>{s.value}</span>
              </div>
            ))}

            <div className={styles.hint} style={{ marginTop: 12 }}>
              Set via environment variables. Restart bot to apply changes.
            </div>
          </div>}

          <div className={styles.configSection}>
            {!running ? (
              <button
                className={styles.btnStart}
                onClick={handleStart}
                disabled={connecting}
              >
                {connecting ? "CONNECTING..." : "▶ START BOT"}
              </button>
            ) : (
              <button className={styles.btnStop} onClick={handleStop}>
                ■ STOP BOT
              </button>
            )}
          </div>

          <div className={styles.panelTitle}>▲ EVENT LOG</div>
          <div className={styles.eventLog}>
            {(status?.events || []).map((e, i) => (
              <div
                key={i}
                className={`${styles.event} ${styles["event_" + e.type]}`}
                style={{ animation: "slideIn 0.3s ease" }}
              >
                <span className={styles.eventTime}>{fmtTime(e.time)}</span>
                <span>{e.message}</span>
              </div>
            ))}
            {!status?.events?.length && (
              <div className={styles.empty}>Waiting for events...</div>
            )}
          </div>
        </div>
      </div>

      {/* STRATEGY GUIDE OVERLAY */}
      {showGuide && (
        <div className={styles.guideOverlay} onClick={() => setShowGuide(false)}>
          <div className={styles.guidePanel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.guideHeader}>
              <span>STRATEGY GUIDE</span>
              <button className={styles.guideClose} onClick={() => setShowGuide(false)}>X</button>
            </div>
            <div className={styles.guideContent}>
              <section className={styles.guideSection}>
                <h3>How the Bot Works</h3>
                <p>
                  Apex Trader is an automated crypto trading bot that scans your watchlist every 60 seconds,
                  evaluates technical indicators, and places trades when conditions align. It uses a
                  <strong> multi-timeframe momentum strategy</strong> — combining short-term signals (1-minute bars)
                  with longer-term trend confirmation (1-hour bars) to filter out noise.
                </p>
                <p>
                  The bot places <strong>market orders</strong> via the Alpaca API for fast execution.
                  Each position is protected by a stop loss and take profit target, with a trailing stop
                  that activates once a position is sufficiently profitable.
                </p>
              </section>

              <section className={styles.guideSection}>
                <h3>Signal Score (0–100)</h3>
                <p>
                  Each asset receives a score every scan cycle. A score of <strong>70+</strong> triggers a buy signal.
                  The score starts at 50 (neutral) and is adjusted by:
                </p>
                <div className={styles.guideTable}>
                  <div className={styles.guideRow}><span>RSI below buy threshold</span><span className={styles.guideGreen}>+25 pts</span></div>
                  <div className={styles.guideRow}><span>RSI slightly below buy threshold</span><span className={styles.guideGreen}>+10 pts</span></div>
                  <div className={styles.guideRow}><span>RSI above sell threshold</span><span className={styles.guideRed}>-30 pts</span></div>
                  <div className={styles.guideRow}><span>SMA5 above SMA20 (uptrend)</span><span className={styles.guideGreen}>+10 pts</span></div>
                  <div className={styles.guideRow}><span>SMA5 below SMA20 (downtrend)</span><span className={styles.guideRed}>-10 pts</span></div>
                  <div className={styles.guideRow}><span>Volume spike (&gt;2x average)</span><span className={styles.guideGreen}>+15 pts</span></div>
                  <div className={styles.guideRow}><span>Volume above average (1.5-2x)</span><span className={styles.guideGreen}>+8 pts</span></div>
                  <div className={styles.guideRow}><span>Strong momentum (&gt;2%)</span><span className={styles.guideGreen}>+12 pts</span></div>
                  <div className={styles.guideRow}><span>Moderate momentum (0.5-2%)</span><span className={styles.guideGreen}>+5 pts</span></div>
                  <div className={styles.guideRow}><span>Negative momentum (&lt;-3%)</span><span className={styles.guideRed}>-15 pts</span></div>
                  <div className={styles.guideRow}><span>High volatility (ATR &gt;2%)</span><span className={styles.guideGreen}>+5 pts</span></div>
                </div>
                <p>
                  The highest-scoring asset is then checked against the <strong>1-hour timeframe</strong> for trend
                  confirmation. If the higher timeframe is bearish, the entry is skipped.
                </p>
              </section>

              <section className={styles.guideSection}>
                <h3>Risk Management</h3>
                <ul>
                  <li><strong>Max 3 concurrent positions</strong> — limits exposure</li>
                  <li><strong>Stop Loss</strong> — closes position if price drops below threshold (default -8%)</li>
                  <li><strong>Take Profit</strong> — closes position at target gain (default +25%)</li>
                  <li><strong>Trailing Stop</strong> — activates after +3% gain, trails 4% behind the highest price. Replaces the fixed take profit to let winners run.</li>
                  <li><strong>Time Exit</strong> — forces close after 48 hours to avoid stale positions</li>
                  <li><strong>Daily Loss Limit</strong> — halts new entries if the portfolio is down 5% for the day</li>
                </ul>
              </section>

              <section className={styles.guideSection}>
                <h3>Indicator Glossary</h3>
                <div className={styles.guideTable}>
                  <div className={styles.guideRow}><span><strong>RSI</strong> (Relative Strength Index)</span><span>Momentum oscillator (0-100). Below 30 = oversold (buy signal), above 70 = overbought (sell signal). Measures the speed and magnitude of recent price changes.</span></div>
                  <div className={styles.guideRow}><span><strong>SMA</strong> (Simple Moving Average)</span><span>Average price over N periods. SMA5 crossing above SMA20 signals a short-term uptrend. Used to confirm the direction of the trend.</span></div>
                  <div className={styles.guideRow}><span><strong>Volume Ratio</strong></span><span>Current volume divided by average volume. Values above 1.5x indicate unusual activity — often precedes a price move. Higher volume adds conviction to signals.</span></div>
                  <div className={styles.guideRow}><span><strong>Momentum</strong></span><span>Percentage price change over the last 10 bars. Positive momentum means price is trending up. Strong momentum (&gt;2%) adds significant points to the signal score.</span></div>
                  <div className={styles.guideRow}><span><strong>ATR</strong> (Average True Range)</span><span>Measures volatility — the average range of price bars. Expressed as a % of price. Higher ATR means more volatile (more opportunity but more risk).</span></div>
                </div>
              </section>

              <section className={styles.guideSection}>
                <h3>Performance Metrics</h3>
                <div className={styles.guideTable}>
                  <div className={styles.guideRow}><span><strong>Sharpe Ratio</strong></span><span>Risk-adjusted return. Measures excess return per unit of total volatility. Above 1.0 is good, above 2.0 is excellent. Accounts for both up and down swings.</span></div>
                  <div className={styles.guideRow}><span><strong>Sortino Ratio</strong></span><span>Like Sharpe but only penalizes downside volatility. More relevant because upside volatility is desirable. Above 1.5 is good, above 3.0 is excellent.</span></div>
                  <div className={styles.guideRow}><span><strong>Max Drawdown</strong></span><span>The largest peak-to-trough decline in portfolio value. Shows the worst-case scenario you experienced. Lower is better — above 20% is concerning.</span></div>
                  <div className={styles.guideRow}><span><strong>Profit Factor</strong></span><span>Total gross profits divided by total gross losses. Above 1.0 = profitable, above 1.5 = solid, above 2.0 = excellent. Below 1.0 means losses exceed gains.</span></div>
                  <div className={styles.guideRow}><span><strong>Avg Win/Loss Ratio</strong></span><span>Average winning trade size divided by average losing trade size. Above 1.0 means wins are larger than losses on average — combined with win rate, this determines overall profitability.</span></div>
                </div>
              </section>

              <section className={styles.guideSection}>
                <h3>Benchmarks</h3>
                <div className={styles.guideTable}>
                  <div className={styles.guideRow}><span><strong>BTC Hold</strong></span><span>What you would have earned by simply buying and holding Bitcoin with your starting capital. If the bot cannot beat this, the added complexity is not justified.</span></div>
                  <div className={styles.guideRow}><span><strong>Equal Weight</strong></span><span>Hypothetical portfolio that invests equally across all watchlist assets. Tests whether your strategy beats naive diversification.</span></div>
                  <div className={styles.guideRow}><span><strong>Mcap Weight</strong></span><span>Hypothetical portfolio weighted by market capitalization (like an index fund). Dominated by BTC and ETH. Represents the passive &ldquo;buy the market&rdquo; approach.</span></div>
                  <div className={styles.guideRow}><span><strong>VS Benchmarks</strong></span><span>The difference between your portfolio return and each benchmark. Positive = outperforming (alpha). Negative = underperforming — the benchmark would have been better.</span></div>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      </>}

      {/* ═══ EXPERIMENT TAB ═══ */}
      {activeTab === "experiment" && (() => {
        const es = expStatus;
        const epv = es?.portfolioValue || 0;
        const esv = es?.startValue || epv;
        const etsv = es?.todayStartValue || epv;
        const eTodayPnl = epv > 0 ? epv - etsv : 0;
        const eTotalPnl = epv > 0 ? epv - esv : 0;
        const eTodayPct = etsv > 0 ? (eTodayPnl / etsv) * 100 : 0;

        return <>
          {/* EXPERIMENT STATS BAR */}
          <div className={styles.statsBar}>
            {[
              { label: "PORTFOLIO VALUE", val: fmt$(epv), sub: `${eTotalPnl >= 0 ? "+" : ""}${fmt$(eTotalPnl)} all time`, color: eTotalPnl >= 0 ? "var(--green)" : "var(--red)" },
              { label: "TODAY P&L", val: `${eTodayPnl >= 0 ? "+" : ""}${fmt$(eTodayPnl)}`, sub: fmtPct(eTodayPct), color: eTodayPnl >= 0 ? "var(--green)" : "var(--red)" },
              { label: "TOTAL TRADES", val: es?.totalTrades || 0, sub: `Win rate: ${es?.winRate != null ? es.winRate + "%" : "—"}`, color: "var(--blue)" },
              { label: "OPEN POSITIONS", val: Object.keys(es?.positions || {}).length, sub: `Last scan: ${fmtTime(es?.lastScan)}`, color: "var(--yellow)" },
            ].map((s) => (
              <div className={styles.statBlock} key={s.label}>
                <div className={styles.statLabel}>{s.label}</div>
                <div className={styles.statVal} style={{ color: s.color }}>{s.val}</div>
                <div className={styles.statSub}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* EXPERIMENT GRID */}
          <div className={styles.grid}>
            {/* LEFT: Signals */}
            <div className={styles.panel}>
              <div className={styles.panelTitle}>▲ HYBRID SIGNALS (Mean Reversion + Momentum)</div>
              {(es?.signals || []).length === 0 ? (
                <div className={styles.empty}>No signals yet — start experiment to scan</div>
              ) : (
                es.signals.map((s) => {
                  const isBuy = s.signal === "buy";
                  const isSell = s.signal === "sell";
                  return (
                    <div key={s.symbol} className={`${styles.signalCard} ${isBuy ? styles.hot : isSell ? styles.warm : styles.cold}`}>
                      <div className={styles.signalHeader}>
                        <span className={styles.ticker}>{s.symbol.replace("/USD", "")}</span>
                        <span className={`${styles.scoreTag} ${isBuy ? styles.scoreHigh : isSell ? styles.scoreMed : styles.scoreLow}`}>
                          {s.signal.toUpperCase()}
                        </span>
                      </div>
                      <div className={styles.metrics}>
                        <div className={styles.metric}>
                          <span className={styles.metricLabel}>PRICE</span>
                          <span className={styles.metricVal}>${s.price < 1 ? s.price?.toFixed(4) : s.price?.toFixed(2)}</span>
                        </div>
                        <div className={styles.metric}>
                          <span className={styles.metricLabel}>24H AVG</span>
                          <span className={styles.metricVal}>${s.avg24h < 1 ? s.avg24h?.toFixed(4) : s.avg24h?.toFixed(2)}</span>
                        </div>
                        <div className={styles.metric}>
                          <span className={styles.metricLabel}>DEVIATION</span>
                          <span className={styles.metricVal} style={{ color: s.deviation < 0 ? "var(--green)" : s.deviation > 0 ? "var(--red)" : "var(--text)" }}>
                            {s.deviation >= 0 ? "+" : ""}{s.deviation?.toFixed(2)}%
                          </span>
                        </div>
                        <div className={styles.metric}>
                          <span className={styles.metricLabel}>TREND</span>
                          <span className={styles.metricVal} style={{ color: s.trend === "rising" ? "var(--green)" : s.trend === "falling" ? "var(--red)" : "var(--dim)" }}>
                            {s.trend === "rising" ? "Rising" : s.trend === "falling" ? `${s.consecutiveDips || 0} dips` : "Flat"}
                          </span>
                        </div>
                        <div className={styles.metric}>
                          <span className={styles.metricLabel}>RSI</span>
                          <span className={styles.metricVal} style={{ color: s.rsi < 35 ? "var(--green)" : s.rsi > 70 ? "var(--red)" : "var(--text)" }}>
                            {s.rsi ?? "—"}
                          </span>
                        </div>
                        <div className={styles.metric}>
                          <span className={styles.metricLabel}>ROC</span>
                          <span className={styles.metricVal} style={{ color: s.minuteROC > 0 ? "var(--green)" : s.minuteROC < 0 ? "var(--red)" : "var(--dim)" }}>
                            {s.minuteROC != null ? `${s.minuteROC > 0 ? "+" : ""}${s.minuteROC}%` : "—"}
                          </span>
                        </div>
                      </div>
                      <div className={styles.deviationBar}>
                        <div className={styles.deviationFill} style={{
                          left: s.deviation < 0 ? `${50 + s.deviation * 5}%` : "50%",
                          width: `${Math.min(Math.abs(s.deviation) * 5, 50)}%`,
                          background: s.deviation < 0 ? "var(--green)" : "var(--red)",
                        }} />
                      </div>
                      {s.reasons?.length > 0 && (
                        <div className={styles.reasons}>{s.reasons.join(" · ")}</div>
                      )}
                    </div>
                  );
                })
              )}

              <div className={styles.panelTitle} style={{ marginTop: 8 }}>▲ OPEN POSITIONS</div>
              {Object.keys(es?.positions || {}).length === 0 ? (
                <div className={styles.empty}>No open positions</div>
              ) : (
                Object.values(es.positions).map((pos) => {
                  const curPrice = pos.livePrice || pos.entryPrice;
                  const pnlPct = pos.entryPrice ? ((curPrice - pos.entryPrice) / pos.entryPrice) * 100 : 0;
                  const pnlVal = (pnlPct / 100) * pos.notional;
                  return (
                    <div key={pos.symbol} className={styles.posCard}>
                      <div className={styles.posHeader}>
                        <span className={styles.ticker}>{pos.symbol?.replace("/USD", "")}</span>
                        <span className={styles.posEntry} style={{ color: pnlPct >= 0 ? "var(--green)" : "var(--red)" }}>
                          {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}% ({pnlVal >= 0 ? "+" : ""}{fmt$(pnlVal)})
                        </span>
                      </div>
                      <div className={styles.posDetails}>
                        Entry {fmt$(pos.entryPrice)} · Now {fmt$(curPrice)}
                      </div>
                      <div className={styles.posDetails}>
                        24h Avg {fmt$(pos.avg24h)} · Dev {pos.deviation?.toFixed(2)}% · {pos.trend === "rising" ? "Rising" : pos.trend === "falling" ? `Falling (${pos.consecutiveDips || 0} dips)` : "Flat"} · RSI {pos.rsi ?? "—"}
                      </div>
                      <div className={styles.posDetails} style={{ marginTop: 2, color: "var(--dim)" }}>
                        {pos.entryTime ? new Date(pos.entryTime).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }) : "—"} · ${pos.notional?.toFixed(2)} invested
                      </div>
                      <button className={styles.btnSell} onClick={async () => {
                        if (!confirm(`Sell ${pos.symbol?.replace("/USD", "")} now?`)) return;
                        try {
                          await fetch(`${API}/api/experiment/trade`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ symbol: pos.symbol, side: "sell" }),
                          });
                          fetchExpStatus();
                        } catch {}
                      }}>SELL</button>
                    </div>
                  );
                })
              )}

              {/* Bear signal indicator */}
              {es?.regime?.current === "bear" && es?.lastBearSignal && (
                <div style={{ padding: "8px 12px", margin: "6px 0", background: "rgba(255,51,85,0.08)", border: "1px solid rgba(255,51,85,0.2)", borderRadius: 6, fontSize: 11, fontFamily: "var(--font-mono)", color: "#ff6680" }}>
                  Last Range Trade: {es.lastBearSignal.coin?.replace("/USD", "")} | Entry: {fmt$(es.lastBearSignal.entryPrice)} | TP: {fmt$(es.lastBearSignal.tpPrice)} | {fmtTime(es.lastBearSignal.time)}
                </div>
              )}
            </div>

            {/* CENTER: Chart + Trade log */}
            <div className={styles.center}>
              <div className={styles.chartArea}>
                <div className={styles.chartLabel}>EXPERIMENT EQUITY CURVE</div>
                <EquityChart data={es?.equityHistory || [{ t: Date.now(), v: 100 }]} startValue={esv} />
              </div>

              <div className={styles.tradeLog}>
                <div className={`${styles.logRow} ${styles.logHeader}`}>
                  <span>TIME</span><span>PAIR</span><span>SIDE</span><span>QTY</span><span>PRICE</span><span>P&L</span>
                </div>
                {(es?.trades || []).length === 0 ? (
                  <div className={styles.empty}>No trades yet</div>
                ) : (
                  es.trades.slice(0, 20).map((t, i) => (
                    <div key={i} className={styles.logRow}>
                      <span>{fmtTime(t.time)}</span>
                      <span>{t.symbol?.replace("/USD", "")}</span>
                      <span><span className={`${styles.tag} ${t.side === "BUY" ? styles.tagBuy : styles.tagSell}`}>{t.side}</span></span>
                      <span>{t.qty?.toFixed(4)}</span>
                      <span>{fmt$(t.price)}</span>
                      <span style={{ color: t.pnl == null ? "inherit" : t.pnl >= 0 ? "var(--green)" : "var(--red)" }}>
                        {t.pnl == null ? "—" : `${t.pnl >= 0 ? "+" : ""}$${t.pnl.toFixed(2)}`}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* RIGHT: Config + Controls */}
            <div className={`${styles.panel} ${styles.rightPanel}`}>
              <div className={styles.panelTitle}>▲ EXPERIMENT CONFIG</div>
              <div className={styles.configSection}>
                <div className={styles.configLabel}>MEAN REVERSION</div>
                {[
                  { label: "Strategy", value: "Mean Reversion" },
                  { label: "Dip Threshold", value: `${((es?.config?.dipThreshold || 0.015) * 100).toFixed(1)}%` },
                  { label: "Position Size", value: `${Math.round((es?.config?.positionSize || 0.33) * 100)}%` },
                  { label: "Max Positions", value: es?.config?.maxPositions || 2 },
                  { label: "Scan Interval", value: `${es?.config?.scanInterval || 30}s` },
                  { label: "Max Hold Time", value: `${es?.config?.maxHoldHours || 4}h` },
                ].map((s) => (
                  <div key={s.label} className={styles.configRow}>
                    <span className={styles.configRowLabel}>{s.label}</span>
                    <span className={styles.configRowVal}>{s.value}</span>
                  </div>
                ))}
                <div className={styles.hint} style={{ marginTop: 12 }}>
                  Set via EXPERIMENT_* environment variables.
                </div>
              </div>

              <div className={styles.configSection}>
                {!es?.running ? (
                  <button className={styles.btnStart} onClick={async () => {
                    setExpConnecting(true);
                    try {
                      await fetch(`${API}/api/experiment/start`, { method: "POST" });
                      await fetchExpStatus();
                    } finally { setExpConnecting(false); }
                  }} disabled={expConnecting}>
                    {expConnecting ? "CONNECTING..." : "▶ START EXPERIMENT"}
                  </button>
                ) : (
                  <button className={styles.btnStop} onClick={async () => {
                    await fetch(`${API}/api/experiment/stop`, { method: "POST" });
                    await fetchExpStatus();
                  }}>■ STOP EXPERIMENT</button>
                )}
              </div>

              <div className={styles.panelTitle}>▲ EVENT LOG</div>
              <div className={styles.eventLog}>
                {(es?.events || []).map((e, i) => (
                  <div key={i} className={`${styles.event} ${styles["event_" + e.type]}`}>
                    <span className={styles.eventTime}>{fmtTime(e.time)}</span>
                    <span>{e.message}</span>
                  </div>
                ))}
                {!es?.events?.length && <div className={styles.empty}>Waiting for events...</div>}
              </div>
            </div>
          </div>
        </>;
      })()}

      {/* ═══ EXPERIMENT 2 TAB ═══ */}
      {activeTab === "experiment2" && (() => {
        const e2 = exp2Status;
        const e2pv = e2?.portfolioValue || 0;
        const e2sv = e2?.startValue || e2pv;
        const e2tsv = e2?.todayStartValue || e2pv;
        const e2TodayPnl = e2pv > 0 ? e2pv - e2tsv : 0;
        const e2TotalPnl = e2pv > 0 ? e2pv - e2sv : 0;
        const e2TodayPct = e2tsv > 0 ? (e2TodayPnl / e2tsv) * 100 : 0;

        return <>
          <div className={styles.statsBar}>
            {[
              { label: "PORTFOLIO VALUE", val: fmt$(e2pv), sub: `${e2TotalPnl >= 0 ? "+" : ""}${fmt$(e2TotalPnl)} all time`, color: e2TotalPnl >= 0 ? "var(--green)" : "var(--red)" },
              { label: "TODAY P&L", val: `${e2TodayPnl >= 0 ? "+" : ""}${fmt$(e2TodayPnl)}`, sub: fmtPct(e2TodayPct), color: e2TodayPnl >= 0 ? "var(--green)" : "var(--red)" },
              { label: "TOTAL TRADES", val: e2?.totalTrades || 0, sub: `Win rate: ${e2?.winRate != null ? e2.winRate + "%" : "—"}`, color: "var(--blue)" },
              { label: "OPEN POSITIONS", val: Object.keys(e2?.positions || {}).length, sub: `Last scan: ${fmtTime(e2?.lastScan)}`, color: "var(--yellow)" },
            ].map((s) => (
              <div className={styles.statBlock} key={s.label}>
                <div className={styles.statLabel}>{s.label}</div>
                <div className={styles.statVal} style={{ color: s.color }}>{s.val}</div>
                <div className={styles.statSub}>{s.sub}</div>
              </div>
            ))}
          </div>

          <div className={styles.grid}>
            {/* LEFT: Signals */}
            <div className={styles.panel}>
              <div className={styles.panelTitle}>▲ BREAKOUT SIGNALS (20-Bar Momentum)</div>
              {(e2?.signals || []).length === 0 ? (
                <div className={styles.empty}>No signals yet — start experiment 2 to scan</div>
              ) : (
                e2.signals.map((s) => {
                  const isBuy = s.signal === "buy";
                  const allMet = s.conditions?.breakout && s.conditions?.volume && s.conditions?.trend && s.conditions?.rsi;
                  return (
                    <div key={s.symbol} className={`${styles.signalCard} ${isBuy ? styles.hot : styles.cold}`}>
                      <div className={styles.signalHeader}>
                        <span className={styles.ticker}>{s.symbol.replace("/USD", "")}</span>
                        <span className={`${styles.scoreTag} ${isBuy ? styles.scoreHigh : styles.scoreLow}`}>
                          {isBuy ? "BREAKOUT" : "WAITING"}
                        </span>
                      </div>
                      <div className={styles.metrics}>
                        <div className={styles.metric}>
                          <span className={styles.metricLabel}>PRICE</span>
                          <span className={styles.metricVal}>${s.price < 1 ? s.price?.toFixed(4) : s.price?.toFixed(2)}</span>
                        </div>
                        <div className={styles.metric}>
                          <span className={styles.metricLabel}>20-BAR HIGH</span>
                          <span className={styles.metricVal} style={{ color: s.conditions?.breakout ? "var(--green)" : "var(--dim)" }}>
                            ${s.breakoutHigh < 1 ? s.breakoutHigh?.toFixed(4) : s.breakoutHigh?.toFixed(2)}
                            {s.conditions?.breakout ? " ✓" : ""}
                          </span>
                        </div>
                        <div className={styles.metric}>
                          <span className={styles.metricLabel}>VOLUME</span>
                          <span className={styles.metricVal} style={{ color: s.conditions?.volume ? "var(--green)" : "var(--dim)" }}>
                            {s.volumeRatio?.toFixed(1)}x{s.conditions?.volume ? " ✓" : ""}
                          </span>
                        </div>
                        <div className={styles.metric}>
                          <span className={styles.metricLabel}>TREND</span>
                          <span className={styles.metricVal} style={{ color: s.conditions?.trend ? "var(--green)" : "var(--dim)" }}>
                            {s.conditions?.trend ? "Above SMA50 ✓" : "Below SMA50"}
                          </span>
                        </div>
                        <div className={styles.metric}>
                          <span className={styles.metricLabel}>RSI</span>
                          <span className={styles.metricVal} style={{ color: s.conditions?.rsi ? "var(--green)" : s.rsi > 72 ? "var(--red)" : "var(--dim)" }}>
                            {s.rsi ?? "—"}{s.conditions?.rsi ? " ✓" : ""}
                          </span>
                        </div>
                      </div>
                      {s.reasons?.length > 0 && (
                        <div className={styles.reasons}>{s.reasons.join(" · ")}</div>
                      )}
                    </div>
                  );
                })
              )}

              <div className={styles.panelTitle} style={{ marginTop: 8 }}>▲ OPEN POSITIONS</div>
              {Object.keys(e2?.positions || {}).length === 0 ? (
                <div className={styles.empty}>No open positions</div>
              ) : (
                Object.values(e2.positions).map((pos) => {
                  const curPrice = pos.livePrice || pos.entryPrice;
                  const pnlPct = pos.entryPrice ? ((curPrice - pos.entryPrice) / pos.entryPrice) * 100 : 0;
                  const pnlVal = (pnlPct / 100) * pos.notional;
                  return (
                    <div key={pos.symbol} className={styles.posCard}>
                      <div className={styles.posHeader}>
                        <span className={styles.ticker}>{pos.symbol?.replace("/USD", "")}</span>
                        <span className={styles.posEntry} style={{ color: pnlPct >= 0 ? "var(--green)" : "var(--red)" }}>
                          {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}% ({pnlVal >= 0 ? "+" : ""}{fmt$(pnlVal)})
                        </span>
                      </div>
                      <div className={styles.posDetails}>
                        Entry {fmt$(pos.entryPrice)} · Now {fmt$(curPrice)} · High {fmt$(pos.highWaterMark)}
                      </div>
                      <div className={styles.posDetails}>
                        Trail SL {fmt$(pos.trailingStop)} · Hard SL {fmt$(pos.hardStop)} · TP {fmt$(pos.takeProfit)}
                      </div>
                      <div className={styles.posDetails} style={{ marginTop: 2, color: "var(--dim)" }}>
                        {pos.entryTime ? new Date(pos.entryTime).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }) : "—"} · ${pos.notional?.toFixed(2)} invested
                      </div>
                      <button className={styles.btnSell} onClick={async () => {
                        if (!confirm(`Sell ${pos.symbol?.replace("/USD", "")} now?`)) return;
                        try {
                          await fetch(`${API}/api/bot2/trade`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ symbol: pos.symbol, side: "sell" }),
                          });
                          fetchExp2Status();
                        } catch {}
                      }}>SELL</button>
                    </div>
                  );
                })
              )}

              {/* Bear signal indicator */}
              {e2?.regime?.current === "bear" && e2?.lastBearSignal && (
                <div style={{ padding: "8px 12px", margin: "6px 0", background: "rgba(255,51,85,0.08)", border: "1px solid rgba(255,51,85,0.2)", borderRadius: 6, fontSize: 11, fontFamily: "var(--font-mono)", color: "#ff6680" }}>
                  Last Range Trade: {e2.lastBearSignal.coin?.replace("/USD", "")} | Entry: {fmt$(e2.lastBearSignal.entryPrice)} | TP: {fmt$(e2.lastBearSignal.tpPrice)} | {fmtTime(e2.lastBearSignal.time)}
                </div>
              )}
            </div>

            {/* CENTER: Chart + Trade log */}
            <div className={styles.center}>
              <div className={styles.chartArea}>
                <div className={styles.chartLabel}>EXPERIMENT 2 EQUITY CURVE</div>
                <EquityChart data={e2?.equityHistory || [{ t: Date.now(), v: 100 }]} startValue={e2sv} />
              </div>

              <div className={styles.tradeLog}>
                <div className={`${styles.logRow} ${styles.logHeader}`}>
                  <span>TIME</span><span>PAIR</span><span>SIDE</span><span>QTY</span><span>PRICE</span><span>P&L</span>
                </div>
                {(e2?.trades || []).length === 0 ? (
                  <div className={styles.empty}>No trades yet</div>
                ) : (
                  e2.trades.slice(0, 20).map((t, i) => (
                    <div key={i} className={styles.logRow}>
                      <span>{fmtTime(t.time)}</span>
                      <span>{t.symbol?.replace("/USD", "")}</span>
                      <span><span className={`${styles.tag} ${t.side === "BUY" ? styles.tagBuy : styles.tagSell}`}>{t.side}</span></span>
                      <span>{t.qty?.toFixed(4)}</span>
                      <span>{fmt$(t.price)}</span>
                      <span style={{ color: t.pnl == null ? "inherit" : t.pnl >= 0 ? "var(--green)" : "var(--red)" }}>
                        {t.pnl == null ? "—" : `${t.pnl >= 0 ? "+" : ""}$${t.pnl.toFixed(2)}`}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* RIGHT: Config + Controls */}
            <div className={`${styles.panel} ${styles.rightPanel}`}>
              <div className={styles.panelTitle}>▲ BREAKOUT CONFIG</div>
              <div className={styles.configSection}>
                <div className={styles.configLabel}>MOMENTUM BREAKOUT</div>
                {[
                  { label: "Strategy", value: "20-Bar Breakout" },
                  { label: "Position Size", value: `${Math.round((e2?.config?.positionSize || 0.95) * 100)}%` },
                  { label: "Max Positions", value: e2?.config?.maxPositions || 1 },
                  { label: "Trailing Stop", value: `${(e2?.config?.trailingStopPct || 0.15) * 100}%` },
                  { label: "Hard Stop", value: `${(e2?.config?.hardStopPct || 0.20) * 100}%` },
                  { label: "Take Profit", value: `${(e2?.config?.takeProfitMultiple || 3)}x stop` },
                  { label: "Max Hold Time", value: `${e2?.config?.maxHoldHours || 72}h` },
                  { label: "Min Balance", value: `$${e2?.config?.minBalance || 15}` },
                  { label: "Cooldown", value: `${e2?.config?.cooldownCandles || 2} candles` },
                  { label: "Scan Interval", value: `${e2?.config?.scanInterval || 30}s` },
                ].map((s) => (
                  <div key={s.label} className={styles.configRow}>
                    <span className={styles.configRowLabel}>{s.label}</span>
                    <span className={styles.configRowVal}>{s.value}</span>
                  </div>
                ))}
                <div className={styles.hint} style={{ marginTop: 12 }}>
                  Uses EXPERIMENT_* API credentials. Separate internal state.
                </div>
              </div>

              <div className={styles.configSection}>
                {!e2?.running ? (
                  <button className={styles.btnStart} onClick={async () => {
                    setExp2Connecting(true);
                    try {
                      await fetch(`${API}/api/bot2/start`, { method: "POST" });
                      await fetchExp2Status();
                    } finally { setExp2Connecting(false); }
                  }} disabled={exp2Connecting}>
                    {exp2Connecting ? "CONNECTING..." : "▶ START EXPERIMENT 2"}
                  </button>
                ) : (
                  <button className={styles.btnStop} onClick={async () => {
                    await fetch(`${API}/api/bot2/stop`, { method: "POST" });
                    await fetchExp2Status();
                  }}>■ STOP EXPERIMENT 2</button>
                )}
              </div>

              <div className={styles.panelTitle}>▲ EVENT LOG</div>
              <div className={styles.eventLog}>
                {(e2?.events || []).map((e, i) => (
                  <div key={i} className={`${styles.event} ${styles["event_" + e.type]}`}>
                    <span className={styles.eventTime}>{fmtTime(e.time)}</span>
                    <span>{e.message}</span>
                  </div>
                ))}
                {!e2?.events?.length && <div className={styles.empty}>Waiting for events...</div>}
              </div>
            </div>
          </div>
        </>;
      })()}

      {/* DISCLAIMER */}
      <div className={styles.disclaimer}>
        ⚠{" "}
        <span
          style={{
            animation: "blink 1s steps(1) infinite",
            display: "inline-block",
          }}
        >
          RISK WARNING:
        </span>{" "}
        Automated trading involves substantial risk. Only trade capital you can
        afford to lose entirely.
      </div>

      {connecting && (
        <div className={styles.overlay}>
          <div className={styles.spinner} />
          <div className={styles.connectText}>CONNECTING TO ALPACA...</div>
        </div>
      )}
    </div>
  );
}
