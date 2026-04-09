"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import styles from "./page.module.css";

// ─── Components ──────────────────────────────────────────────
import { API, PERIODS, filterByPeriod, fmt$, fmtTime } from "./components/helpers";
import Header from "./components/Header";
import Leaderboard from "./components/Leaderboard";
import TabBar from "./components/TabBar";
import RegimeBar from "./components/RegimeBar";
import StatsBar from "./components/StatsBar";
import MobileKPIs from "./components/MobileKPIs";
import EquityChart from "./components/EquityChart";
import BenchmarkBar from "./components/BenchmarkBar";
import RiskMetrics from "./components/RiskMetrics";
import TradeLog from "./components/TradeLog";
import SignalPanel from "./components/SignalPanel";
import PositionCard from "./components/PositionCard";
import ConfigPanel from "./components/ConfigPanel";
import EventLog from "./components/EventLog";
import StrategyGuide from "./components/StrategyGuide";
import BottomNav from "./components/BottomNav";
import OnboardingHint from "./components/OnboardingHint";
import Drawer from "./components/Drawer";
import OverlayChart from "./components/OverlayChart";
import ScalpBreakdown from "./components/ScalpBreakdown";
import Holdings from "./components/Holdings";
import PnlDistribution from "./components/PnlDistribution";
import TradeHeatmap from "./components/TradeHeatmap";
import LiveTraderBanner from "./components/LiveTraderBanner";
import useTradeNotifications from "./components/useTradeNotifications";
import Expectations from "./components/Expectations";

// ─── Quiet mode: detect if anything actionable is happening ──
function useQuietMode(botStatus) {
  return useMemo(() => {
    if (!botStatus) return true;
    const signals = botStatus.signals || [];
    const positions = botStatus.positions || {};
    const hasHotSignal = signals.some(s => s.score >= 70 || s.signal === "buy");
    const hasOpenPositions = Object.keys(positions).length > 0;
    const recentEvents = (botStatus.events || []).filter(e => {
      const age = Date.now() - new Date(e.time).getTime();
      return age < 120000 && (e.type === "success" || e.type === "danger");
    });
    return !hasHotSignal && !hasOpenPositions && recentEvents.length === 0;
  }, [botStatus]);
}

// ─── BotTabContent — 2-column layout: signals | chart+trades ─
function BotTabContent({ botType, botStatus, config, running, connecting, onStart, onStop, chartPeriod, setChartPeriod, onSell, mobileSection }) {
  const bs = botStatus;
  const pv = bs?.portfolioValue || 0;
  const sv = bs?.startValue || pv;
  const regime = bs?.regime;
  const quiet = useQuietMode(bs);

  const signalTitle = botType === "main"
    ? (regime?.current === "bear" ? "LIVE SIGNALS (Range Trading)" : "LIVE SIGNALS (Momentum)")
    : botType === "exp1"
      ? (regime?.current === "bear" ? "SIGNALS (Range Trading)" : "HYBRID SIGNALS (Mean Reversion + Momentum)")
      : (regime?.current === "bear" ? "SIGNALS (BTC Accumulation)" : "BREAKOUT SIGNALS (20-Bar Momentum)");

  const chartLabel = botType === "main" ? "EXP 1 EQUITY" : botType === "exp1" ? "EXP 2 EQUITY" : "EXP 3 EQUITY";

  const pCfg = PERIODS[chartPeriod] || PERIODS["1D"];
  const bm = bs?.benchmarks;
  const eqH = pCfg.useDaily
    ? (pCfg.ms === Infinity ? bm?.equalWeight?.dailyHistory : filterByPeriod(bm?.equalWeight?.dailyHistory, pCfg.ms))
    : filterByPeriod(bm?.equalWeight?.history, pCfg.ms);
  const mcH = pCfg.useDaily
    ? (pCfg.ms === Infinity ? bm?.mcapWeight?.dailyHistory : filterByPeriod(bm?.mcapWeight?.dailyHistory, pCfg.ms))
    : filterByPeriod(bm?.mcapWeight?.history, pCfg.ms);
  const btH = pCfg.useDaily
    ? (pCfg.ms === Infinity ? bm?.btcOnly?.dailyHistory : filterByPeriod(bm?.btcOnly?.dailyHistory, pCfg.ms))
    : filterByPeriod(bm?.btcOnly?.history, pCfg.ms);
  const filteredEquity = filterByPeriod(bs?.equityHistory, pCfg.ms);

  const bearSignal = regime?.current === "bear" && bs?.lastBearSignal;

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  const showDashboard = !isMobile || mobileSection === "dashboard";
  const showSignals = !isMobile || mobileSection === "signals";
  const showTrades = !isMobile || mobileSection === "trades";
  const showSettings = !isMobile || mobileSection === "settings";

  return (
    <div className={`${quiet ? styles.quietMode : styles.activeMode}`}>
      {showDashboard && (
        <StatsBar
          portfolioValue={pv} startValue={sv} todayStartValue={bs?.todayStartValue}
          totalTrades={bs?.totalTrades} winRate={bs?.winRate}
          positions={bs?.positions} lastScan={bs?.lastScan}
        />
      )}

      {showDashboard && (
        <MobileKPIs portfolioValue={pv} startValue={sv} todayStartValue={bs?.todayStartValue} running={running} />
      )}

      <div className={styles.grid}>
        {showSignals && (
          <div className={styles.panel}>
            <OnboardingHint hintKey="signals" />
            <SignalPanel signals={bs?.signals} regime={regime} botType={botType} botStatus={bs} title={signalTitle} />

            <OnboardingHint hintKey="positions" />
            <div className={styles.panelTitle} style={{ marginTop: 8 }}>{"\u25B2"} OPEN POSITIONS</div>
            {Object.keys(bs?.positions || {}).length === 0 ? (
              <div className={styles.empty}>No open positions</div>
            ) : (
              Object.values(bs.positions).map((pos) => (
                <PositionCard
                  key={pos.symbol}
                  pos={pos}
                  botType={botType}
                  onSell={() => onSell(pos.symbol)}
                />
              ))
            )}

            {bearSignal && (
              <div style={{ padding: "10px 14px", margin: "8px 0", background: "rgba(255,51,85,0.06)", border: "1px solid rgba(255,51,85,0.15)", borderRadius: 6, fontSize: 12, fontFamily: "var(--font-mono)", color: "#ff6680" }}>
                {botType === "exp2"
                  ? `Last BTC Tranche: ${bs.lastBearSignal.coin?.replace("/USD", "")} | Entry: ${fmt$(bs.lastBearSignal.entryPrice)} | ${fmtTime(bs.lastBearSignal.time)}`
                  : `Last Range Trade: ${bs.lastBearSignal.coin?.replace("/USD", "")} | Entry: ${fmt$(bs.lastBearSignal.entryPrice)} | TP: ${fmt$(bs.lastBearSignal.tpPrice)} | ${fmtTime(bs.lastBearSignal.time)}`
                }
              </div>
            )}
          </div>
        )}

        {(showDashboard || showTrades) && (
          <div className={styles.center}>
            {showDashboard && (
              <>
                <OnboardingHint hintKey="chart" />
                <div className={styles.chartArea}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div className={styles.chartLabel} style={{ marginBottom: 0 }}>{chartLabel} · BENCHMARKS (50-day return)</div>
                    <div style={{ display: "flex", gap: 4 }}>
                      {Object.keys(PERIODS).map(p => (
                        <button key={p} onClick={() => setChartPeriod(p)} style={{
                          padding: "3px 10px", fontSize: 10, fontFamily: "var(--font-mono)",
                          letterSpacing: 1, border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer",
                          background: chartPeriod === p ? "rgba(68,136,255,0.2)" : "transparent",
                          color: chartPeriod === p ? "#4488ff" : "var(--dim)",
                        }}>{p}</button>
                      ))}
                    </div>
                  </div>
                  <EquityChart
                    data={filteredEquity.length > 0 ? filteredEquity : [{ t: Date.now(), v: sv || 100 }]}
                    startValue={sv}
                    equalHistory={eqH}
                    mcapHistory={mcH}
                    btcHistory={btH}
                    period={chartPeriod}
                  />
                </div>

                <BenchmarkBar benchmarks={bm} portfolioValue={pv} startValue={sv} />

                <RiskMetrics riskMetrics={bs?.riskMetrics} wins={bs?.wins || 0} losses={bs?.losses || 0} />
              </>
            )}

            {showTrades && (
              <>
                <OnboardingHint hintKey="trades" />
                <TradeLog trades={bs?.trades} />
              </>
            )}
          </div>
        )}

        {showSettings && isMobile && (
          <div className={styles.panel}>
            <ConfigPanel
              botType={botType}
              botStatus={bs}
              config={botType === "main" ? config : null}
              running={running}
              onStart={onStart}
              onStop={onStop}
              connecting={connecting}
            />
            <EventLog events={bs?.events} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MAIN PAGE ───────────────────────────────────────────────
export default function Dashboard() {
  // ── State ─────────────────────────────────────────────────
  const [status, setStatus] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [clock, setClock] = useState("");
  const [mode, setMode] = useState("paper");
  const [showGuide, setShowGuide] = useState(false);
  const [showExpectations, setShowExpectations] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [config, setConfig] = useState(null);
  const [activeTab, setActiveTab] = useState("main");
  const [expStatus, setExpStatus] = useState(null);
  const [expConnecting, setExpConnecting] = useState(false);
  const [exp2Status, setExp2Status] = useState(null);
  const [exp2Connecting, setExp2Connecting] = useState(false);
  const [leaderboard, setLeaderboard] = useState(null);
  const [chartPeriod, setChartPeriod] = useState("1D");
  const [mobileSection, setMobileSection] = useState("dashboard");
  const [scalpLog, setScalpLog] = useState(null);
  const [liveTrader, setLiveTrader] = useState(null);

  // ── Trade notifications ───────────────────────────────────
  const notifStatuses = useMemo(() => [
    { key: "main", status },
    { key: "exp1", status: expStatus },
    { key: "exp2", status: exp2Status },
  ], [status, expStatus, exp2Status]);
  useTradeNotifications(notifStatuses);

  // ── Clock ─────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("en-US", { hour12: false }) + " EST");
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Polling ───────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    try { const r = await fetch(`${API}/api/status`); if (r.ok) setStatus(await r.json()); } catch {}
  }, []);
  const fetchExpStatus = useCallback(async () => {
    try { const r = await fetch(`${API}/api/experiment/status`); if (r.ok) setExpStatus(await r.json()); } catch {}
  }, []);
  const fetchExp2Status = useCallback(async () => {
    try { const r = await fetch(`${API}/api/bot2/status`); if (r.ok) setExp2Status(await r.json()); } catch {}
  }, []);
  const fetchLeaderboard = useCallback(async () => {
    try { const r = await fetch(`${API}/api/leaderboard`); if (r.ok) setLeaderboard(await r.json()); } catch {}
  }, []);
  const fetchScalpLog = useCallback(async () => {
    try { const r = await fetch(`${API}/api/scalp-log`); if (r.ok) setScalpLog(await r.json()); } catch {}
  }, []);
  const fetchLiveTrader = useCallback(async () => {
    try { const r = await fetch(`${API}/api/live-trader/status`); if (r.ok) setLiveTrader(await r.json()); } catch {}
  }, []);

  useEffect(() => { fetchStatus(); const id = setInterval(fetchStatus, 5000); return () => clearInterval(id); }, [fetchStatus]);
  useEffect(() => { fetchExpStatus(); const id = setInterval(fetchExpStatus, 5000); return () => clearInterval(id); }, [fetchExpStatus]);
  useEffect(() => { fetchExp2Status(); const id = setInterval(fetchExp2Status, 5000); return () => clearInterval(id); }, [fetchExp2Status]);
  useEffect(() => { fetchLeaderboard(); const id = setInterval(fetchLeaderboard, 60000); return () => clearInterval(id); }, [fetchLeaderboard]);
  useEffect(() => { fetchScalpLog(); const id = setInterval(fetchScalpLog, 30000); return () => clearInterval(id); }, [fetchScalpLog]);
  useEffect(() => { fetchLiveTrader(); const id = setInterval(fetchLiveTrader, 10000); return () => clearInterval(id); }, [fetchLiveTrader]);

  // ── Sync config from backend ──────────────────────────────
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

  // ── Actions ───────────────────────────────────────────────
  const handleStart = async () => {
    setConnecting(true);
    try { await fetch(`${API}/api/start`, { method: "POST" }); await fetchStatus(); } finally { setConnecting(false); }
  };
  const handleStop = async () => { await fetch(`${API}/api/stop`, { method: "POST" }); await fetchStatus(); };
  const handleExpStart = async () => {
    setExpConnecting(true);
    try { await fetch(`${API}/api/experiment/start`, { method: "POST" }); await fetchExpStatus(); } finally { setExpConnecting(false); }
  };
  const handleExpStop = async () => { await fetch(`${API}/api/experiment/stop`, { method: "POST" }); await fetchExpStatus(); };
  const handleExp2Start = async () => {
    setExp2Connecting(true);
    try { await fetch(`${API}/api/bot2/start`, { method: "POST" }); await fetchExp2Status(); } finally { setExp2Connecting(false); }
  };
  const handleExp2Stop = async () => { await fetch(`${API}/api/bot2/stop`, { method: "POST" }); await fetchExp2Status(); };

  const sellPosition = async (apiPath, symbol, refreshFn) => {
    if (!confirm(`Sell ${symbol.replace("/USD", "")} now?`)) return;
    try {
      await fetch(`${API}${apiPath}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, side: "sell" }),
      });
      refreshFn();
    } catch {}
  };

  // ── Derived data ──────────────────────────────────────────
  const running = status?.running;
  const regime = status?.regime || expStatus?.regime || exp2Status?.regime;
  const gate = status?.btcGate || expStatus?.btcGate || exp2Status?.btcGate;

  // Per-tab props
  const tabProps = {
    main: { botType: "main", botStatus: status, config, running: status?.running, connecting, onStart: handleStart, onStop: handleStop, chartPeriod, setChartPeriod, onSell: (sym) => sellPosition("/api/trade", sym, fetchStatus) },
    experiment: { botType: "exp1", botStatus: expStatus, running: expStatus?.running, connecting: expConnecting, onStart: handleExpStart, onStop: handleExpStop, chartPeriod, setChartPeriod, onSell: (sym) => sellPosition("/api/experiment/trade", sym, fetchExpStatus) },
    experiment2: { botType: "exp2", botStatus: exp2Status, running: exp2Status?.running, connecting: exp2Connecting, onStart: handleExp2Start, onStop: handleExp2Stop, chartPeriod, setChartPeriod, onSell: (sym) => sellPosition("/api/bot2/trade", sym, fetchExp2Status) },
  };
  const active = tabProps[activeTab];

  return (
    <div style={{ position: "relative", zIndex: 1, paddingBottom: 90 }}>
      <Header running={running} mode={mode} setMode={setMode} clock={clock} onShowGuide={() => setShowGuide(true)} onShowDrawer={() => setShowDrawer(true)} onShowExpectations={() => setShowExpectations(true)} />
      <LiveTraderBanner liveTrader={liveTrader} />
      <Leaderboard leaderboard={leaderboard} statuses={[
        { key: "main", status },
        { key: "exp1", status: expStatus },
        { key: "exp2", status: exp2Status },
      ]} />

      {/* Cross-bot comparison: overlay chart + scalp breakdown */}
      {(status?.equityHistory?.length > 1 || expStatus?.equityHistory?.length > 1 || exp2Status?.equityHistory?.length > 1) && (
        <OverlayChart
          bots={[
            { key: "main", equityHistory: status?.equityHistory, startValue: status?.startValue },
            { key: "exp1", equityHistory: expStatus?.equityHistory, startValue: expStatus?.startValue },
            { key: "exp2", equityHistory: exp2Status?.equityHistory, startValue: exp2Status?.startValue },
          ]}
          period={chartPeriod}
          setPeriod={setChartPeriod}
        />
      )}
      <ScalpBreakdown scalpLog={scalpLog} leaderboard={leaderboard} />
      <Holdings statuses={[
        { key: "main", status },
        { key: "exp1", status: expStatus },
        { key: "exp2", status: exp2Status },
      ]} />
      <PnlDistribution scalpLog={scalpLog} />
      <TradeHeatmap scalpLog={scalpLog} />

      <TabBar activeTab={activeTab} setActiveTab={setActiveTab} regime={regime} />
      <RegimeBar gate={gate} regime={regime} activeTab={activeTab} />
      <OnboardingHint hintKey="regime" />

      <BotTabContent {...active} mobileSection={mobileSection} />

      {/* Settings drawer (replaces right column) */}
      <Drawer open={showDrawer} onClose={() => setShowDrawer(false)} title="SETTINGS & EVENTS">
        <ConfigPanel
          botType={active.botType}
          botStatus={active.botStatus}
          config={activeTab === "main" ? config : null}
          running={active.running}
          onStart={active.onStart}
          onStop={active.onStop}
          connecting={active.connecting}
        />
        <EventLog events={active.botStatus?.events} />
      </Drawer>

      {showGuide && <StrategyGuide onClose={() => setShowGuide(false)} />}
      {showExpectations && (
        <Expectations
          onClose={() => setShowExpectations(false)}
          statuses={[
            { key: "main", status },
            { key: "exp1", status: expStatus },
            { key: "exp2", status: exp2Status },
          ]}
        />
      )}

      <div className={styles.disclaimer}>
        {"\u26A0"}{" "}
        <span style={{ animation: "blink 1s steps(1) infinite", display: "inline-block" }}>
          RISK WARNING:
        </span>{" "}
        Automated trading involves substantial risk. Only trade capital you can afford to lose entirely.
      </div>

      {connecting && (
        <div className={styles.overlay}>
          <div className={styles.spinner} />
          <div className={styles.connectText}>CONNECTING TO ALPACA...</div>
        </div>
      )}

      <BottomNav activeSection={mobileSection} setActiveSection={setMobileSection} activeBot={activeTab} setActiveBot={setActiveTab} />
    </div>
  );
}

