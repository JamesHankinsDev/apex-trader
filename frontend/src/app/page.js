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
  const [config, setConfig] = useState({
    positionSize: 80,
    stopLoss: 8,
    takeProfit: 25,
    rsiBuy: 35,
    rsiSell: 70,
    scanInterval: 60,
  });

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

  // Sync config from status
  useEffect(() => {
    if (status?.config) {
      setConfig({
        positionSize: Math.round(status.config.positionSize * 100),
        stopLoss: Math.round(status.config.stopLoss * 100),
        takeProfit: Math.round(status.config.takeProfit * 100),
        rsiBuy: status.config.rsiBuy,
        rsiSell: status.config.rsiSell,
        scanInterval: status.config.scanInterval,
      });
      setMode(status.mode);
    }
  }, [status?.running]);

  const handleStart = async () => {
    setConnecting(true);
    try {
      const res = await fetch(`${API}/api/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: apiKey || undefined,
          secretKey: secretKey || undefined,
          mode,
        }),
      });
      await fetchStatus();
    } finally {
      setConnecting(false);
    }
  };

  const handleStop = async () => {
    await fetch(`${API}/api/stop`, { method: "POST" });
    await fetchStatus();
  };

  const handleConfigUpdate = async () => {
    await fetch(`${API}/api/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        positionSize: config.positionSize / 100,
        stopLoss: config.stopLoss / 100,
        takeProfit: config.takeProfit / 100,
        rsiBuy: config.rsiBuy,
        rsiSell: config.rsiSell,
        scanInterval: config.scanInterval,
      }),
    });
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
                {s.reasons?.length > 0 && (
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
              // Find current price from signals for this symbol
              const sig = (status?.signals || []).find(
                (s) => s.symbol === pos.symbol,
              );
              const curPrice = sig?.price || pos.entryPrice;
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
                    SL {fmt$(pos.stopPrice)} · TP {pos.targetPrice === Infinity || !isFinite(pos.targetPrice) ? "TRAILING" : fmt$(pos.targetPrice)}
                  </div>
                  <div
                    className={styles.posDetails}
                    style={{ marginTop: 2, color: "var(--dim)" }}
                  >
                    {fmtTime(pos.entryTime)} · ${pos.notional?.toFixed(2)}{" "}
                    invested
                  </div>
                </div>
              );
            })
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
                  { label: "SHARPE RATIO", val: rm.sharpeRatio != null ? rm.sharpeRatio.toFixed(2) : "—", sub: "risk-adj. return", color: sharpeColor },
                  { label: "SORTINO RATIO", val: rm.sortinoRatio != null ? rm.sortinoRatio.toFixed(2) : "—", sub: "downside-adj.", color: sortinoColor },
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

          <div className={styles.configSection}>
            <div className={styles.configLabel}>ALPACA CREDENTIALS</div>
            <input
              className={styles.apiInput}
              type="text"
              placeholder="API KEY ID"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={running}
            />
            <input
              className={styles.apiInput}
              type="password"
              placeholder="SECRET KEY"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              disabled={running}
            />
            <div className={styles.hint}>
              Paper: paper-api.alpaca.markets
              <br />
              Live: api.alpaca.markets
            </div>
          </div>

          <div className={styles.configSection}>
            <div className={styles.configLabel}>STRATEGY PARAMETERS</div>
            {[
              {
                key: "positionSize",
                label: "Position Size",
                min: 10,
                max: 95,
                suffix: "%",
              },
              {
                key: "stopLoss",
                label: "Stop Loss",
                min: 2,
                max: 25,
                suffix: "%",
                prefix: "-",
              },
              {
                key: "takeProfit",
                label: "Take Profit",
                min: 5,
                max: 100,
                suffix: "%",
                prefix: "+",
              },
              {
                key: "rsiBuy",
                label: "RSI Buy Below",
                min: 20,
                max: 50,
                suffix: "",
              },
              {
                key: "rsiSell",
                label: "RSI Sell Above",
                min: 55,
                max: 85,
                suffix: "",
              },
              {
                key: "scanInterval",
                label: "Scan Interval",
                min: 15,
                max: 300,
                step: 15,
                suffix: "s",
              },
            ].map((s) => (
              <div key={s.key}>
                <div className={styles.sliderRow}>
                  <span className={styles.sliderLabel}>{s.label}</span>
                  <span className={styles.sliderVal}>
                    {s.prefix || ""}
                    {config[s.key]}
                    {s.suffix}
                  </span>
                </div>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={s.step || 1}
                  value={config[s.key]}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      [s.key]: parseInt(e.target.value),
                    }))
                  }
                />
              </div>
            ))}
            <button className={styles.btnApply} onClick={handleConfigUpdate}>
              APPLY CONFIG
            </button>
          </div>

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
