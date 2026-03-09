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
function EquityChart({ data, startValue }) {
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

    const vals = data.map((d) => d.v);
    const minV = Math.min(...vals) * 0.998;
    const maxV = Math.max(...vals) * 1.002;
    const range = maxV - minV || 1;
    const toX = (i) => (i / (data.length - 1)) * W;
    const toY = (v) => H - ((v - minV) / range) * H;

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

    // Line
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
  }, [data, startValue]);

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
            />
          </div>

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
