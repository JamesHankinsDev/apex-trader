"use client";
import { useState } from "react";
import styles from "../page.module.css";
import { fmt$ } from "./helpers";
import Tooltip from "./Tooltip";

// ─── Plain-English signal summary generators ───────────��──────

function getMainBullSummary(s) {
  const parts = [];
  if (s.score >= 70) parts.push("Strong buy signal");
  else if (s.score >= 50) parts.push("Moderate signal");
  else parts.push("Weak signal");

  if (s.rsi < 35) parts.push("oversold");
  else if (s.rsi > 70) parts.push("overbought");

  if (s.volumeRatio > 2.0) parts.push("with heavy volume");
  else if (s.volumeRatio > 1.5) parts.push("with above-average volume");

  if (s.momentum > 2) parts.push("and strong upward momentum");
  else if (s.momentum > 0.5) parts.push("and rising momentum");
  else if (s.momentum < -3) parts.push("but falling sharply");

  return parts.join(" \u2014 ");
}

function getMainBearSummary(priceNearSupport, bearRsi, bearVol, channelInverted, supportBroken) {
  if (channelInverted) return "Channel inverted \u2014 support/resistance levels have crossed, unreliable for range trading.";
  if (supportBroken) return "Price has broken below support \u2014 the range trade thesis is invalidated.";
  if (priceNearSupport && bearRsi < 40 && bearVol > 1.5) return "Near support with oversold RSI and strong volume \u2014 all conditions met for a range trade entry.";
  if (priceNearSupport && bearRsi < 40) return "Near support and oversold, but volume is low \u2014 waiting for volume confirmation.";
  if (priceNearSupport) return "Price is near support but not yet oversold \u2014 watching for RSI to dip below 40.";
  return "Monitoring \u2014 waiting for price to approach the support level.";
}

function getExp1BullSummary(s) {
  if (s.signal === "buy") return `Dip detected \u2014 price is ${Math.abs(s.deviation || 0).toFixed(1)}% below the 24h average with ${s.consecutiveDips || 0} consecutive dips. Mean reversion entry.`;
  if (s.signal === "sell") return "Momentum exhaustion \u2014 price has reverted above average, exit conditions approaching.";
  if (s.deviation < -1) return `Trading ${Math.abs(s.deviation).toFixed(1)}% below average \u2014 watching for dip confirmation.`;
  return "Tracking deviation from 24-hour average \u2014 no actionable dip yet.";
}

function getExp2BullSummary(s) {
  const met = [s.conditions?.breakout, s.conditions?.volume, s.conditions?.trend, s.conditions?.rsi].filter(Boolean).length;
  if (s.signal === "buy") return `Breakout confirmed \u2014 price above 20-bar high with volume and trend confirmation. All ${met} conditions met.`;
  return `Watching for breakout \u2014 ${met}/4 conditions met. Needs price above 20-bar high with volume.`;
}

function getExp2BearSummary(acc, dropFromFlip, trancheCount, allMet) {
  if (!acc?.regimeFlipPrice) return "Waiting for regime flip data to initialize DCA strategy.";
  if (trancheCount >= (acc.maxTranches || 4)) return `All ${trancheCount} DCA tranches deployed \u2014 holding until BTC gate reopens or emergency stop triggers.`;
  if (allMet) return `DCA tranche ready \u2014 price has dropped ${dropFromFlip.toFixed(1)}% from regime flip with sufficient spacing.`;
  return `Accumulating BTC \u2014 ${trancheCount}/${acc.maxTranches || 4} tranches deployed. Waiting for next drop threshold.`;
}

// ─── Signal card for Main Bot ─────────────────────────────────
function MainSignalCard({ s, regime, showDetails }) {
  const isBear = regime?.current === "bear";
  const bc = regime?.bearChannels?.[s.symbol] || regime?.bearChannel;
  const bearRsi = bc?.rsi ?? s.rsi;
  const bearVol = bc?.volRatio ?? s.volumeRatio ?? 1;

  if (isBear) {
    const priceNearSupport = bc?.support ? s.price >= bc.support && s.price <= bc.support * 1.02 : false;
    const supportBroken = bc?.support ? s.price < bc.support : false;
    const channelInverted = bc?.support && bc?.resist ? bc.support > bc.resist : false;
    const aboveResistance = bc?.resist ? s.price > bc.resist : false;
    const channelOk = bc?.width >= 5 && !channelInverted;
    const channelTag = channelInverted ? " INVERTED" : bc?.width < 5 ? " TOO TIGHT" : " \u2713";
    const channelColor = channelInverted ? "var(--red)" : channelOk ? "var(--green)" : "var(--dim)";
    const cardClass = priceNearSupport && bearRsi < 40 && bearVol > 1.5 ? styles.hot : styles.cold;
    const scoreTagClass = priceNearSupport && bearRsi < 40 ? styles.scoreHigh : styles.scoreLow;
    const statusLabel = channelInverted ? "CHANNEL INVERTED" : supportBroken ? "SUPPORT BROKEN" : aboveResistance ? "ABOVE RESISTANCE" : priceNearSupport && bearRsi < 40 ? "NEAR SUPPORT" : "WATCHING";

    const summary = getMainBearSummary(priceNearSupport, bearRsi, bearVol, channelInverted, supportBroken);
    const summaryClass = priceNearSupport && bearRsi < 40 && bearVol > 1.5 ? styles.signalSummaryStrong : styles.signalSummaryBear;

    const metrics = [
      { l: "PRICE", v: s.price != null ? (s.price < 1 ? s.price.toFixed(4) : s.price.toFixed(2)) : "\u2014", prefix: s.price != null ? "$" : "" },
      { l: "SUP / RES", v: `${bc?.support ? "$" + bc.support.toFixed(2) : "\u2014"} / ${bc?.resist ? "$" + bc.resist.toFixed(2) : "\u2014"}`, color: supportBroken ? "var(--red)" : aboveResistance ? "var(--yellow)" : priceNearSupport ? "var(--green)" : "var(--dim)" },
      { l: "RSI (1h)", v: bearRsi != null ? Number(bearRsi).toFixed(1) : "\u2014", color: bearRsi < 40 ? "var(--green)" : "var(--dim)", tag: bearRsi < 40 ? " \u2713" : "" },
      { l: "VOL (1h)", v: `\u00D7${Number(bearVol).toFixed(2)}`, color: bearVol > 1.5 ? "var(--green)" : "var(--dim)", tag: bearVol > 1.5 ? " \u2713" : "" },
      { l: "CHANNEL", v: bc?.width ? `${bc.width}%` : "\u2014", color: channelColor, tag: bc?.width ? channelTag : "" },
    ];

    return (
      <div className={`${styles.signalCard} ${cardClass}`}>
        <div className={styles.signalHeader}>
          <span className={styles.ticker}>{s.symbol.replace("/USD", "")}</span>
          <span className={`${styles.scoreTag} ${scoreTagClass}`}>{statusLabel}</span>
        </div>
        <div className={`${styles.signalSummary} ${summaryClass}`}>{summary}</div>
        {showDetails && <MetricsGrid metrics={metrics} />}
        {showDetails && s.stale && <div className={styles.reasons} style={{ color: "var(--yellow)" }}>Bar data {s.barAgeMin}min stale</div>}
        {showDetails && s.reasons?.length > 0 && !s.stale && <div className={styles.reasons}>{s.reasons.slice(0, 2).join(" \u00B7 ")}</div>}
      </div>
    );
  }

  // Bull mode
  const cardClass = s.score >= 70 ? styles.hot : s.score >= 50 ? styles.warm : styles.cold;
  const scoreTagClass = s.score >= 70 ? styles.scoreHigh : s.score >= 50 ? styles.scoreMed : styles.scoreLow;
  const summary = getMainBullSummary(s);
  const summaryClass = s.score >= 70 ? styles.signalSummaryStrong : s.score >= 50 ? "" : styles.signalSummaryWeak;

  const metrics = [
    { l: "PRICE", v: s.price != null ? (s.price < 1 ? s.price.toFixed(4) : s.price.toFixed(2)) : "\u2014", prefix: s.price != null ? "$" : "" },
    { l: "RSI", v: s.rsi?.toFixed(1), color: s.rsi < 35 ? "var(--green)" : s.rsi > 70 ? "var(--red)" : "" },
    { l: "VOLUME", v: `\u00D7${s.volumeRatio?.toFixed(2)}`, color: s.volumeRatio > 1.8 ? "var(--green)" : "" },
    { l: "MOM", v: `${s.momentum >= 0 ? "+" : ""}${s.momentum?.toFixed(2)}%`, color: s.momentum > 0 ? "var(--green)" : "var(--red)" },
  ];

  return (
    <div className={`${styles.signalCard} ${cardClass}`}>
      <div className={styles.signalHeader}>
        <span className={styles.ticker}>{s.symbol.replace("/USD", "")}</span>
        <span className={`${styles.scoreTag} ${scoreTagClass}`}>SCORE {s.score}</span>
      </div>
      <div className={`${styles.signalSummary} ${summaryClass}`}>{summary}</div>
      {showDetails && <MetricsGrid metrics={metrics} />}
      {showDetails && s.stale && <div className={styles.reasons} style={{ color: "var(--yellow)" }}>Bar data {s.barAgeMin}min stale</div>}
      {showDetails && s.reasons?.length > 0 && !s.stale && <div className={styles.reasons}>{s.reasons.slice(0, 2).join(" \u00B7 ")}</div>}
    </div>
  );
}

// ─── Signal card for Experiment 1 ─────────────────────────────
function Exp1SignalCard({ s, regime, showDetails }) {
  const isBear = regime?.current === "bear";
  const bc = regime?.bearChannels?.[s.symbol] || regime?.bearChannel;
  const bearRsi = bc?.rsi ?? s.rsi;
  const bearVol = bc?.volRatio ?? s.volRatio ?? s.volumeRatio ?? 1;

  if (isBear) {
    const priceNearSupport = bc?.support ? s.price >= bc.support && s.price <= bc.support * 1.02 : false;
    const supportBroken = bc?.support ? s.price < bc.support : false;
    const channelInverted = bc?.support && bc?.resist ? bc.support > bc.resist : false;
    const aboveResistance = bc?.resist ? s.price > bc.resist : false;
    const rsiOk = bearRsi < 40;
    const volOk = bearVol > 1.5;
    const channelOk = bc?.width >= 5 && !channelInverted;
    const channelTag = channelInverted ? " INVERTED" : bc?.width < 5 ? " TOO TIGHT" : " \u2713";
    const channelColor = channelInverted ? "var(--red)" : channelOk ? "var(--green)" : "var(--dim)";
    const allMet = priceNearSupport && rsiOk && volOk && channelOk;
    const statusLabel = channelInverted ? "CHANNEL INVERTED" : supportBroken ? "SUPPORT BROKEN" : aboveResistance ? "ABOVE RESISTANCE" : allMet ? "NEAR SUPPORT" : "WATCHING";

    const summary = getMainBearSummary(priceNearSupport, bearRsi, bearVol, channelInverted, supportBroken);
    const summaryClass = allMet ? styles.signalSummaryStrong : styles.signalSummaryBear;

    const metrics = [
      { l: "PRICE", v: `$${s.price < 1 ? s.price?.toFixed(4) : s.price?.toFixed(2)}` },
      { l: "SUP / RES", v: `${bc?.support ? "$" + bc.support.toFixed(2) : "\u2014"} / ${bc?.resist ? "$" + bc.resist.toFixed(2) : "\u2014"}`, color: supportBroken ? "var(--red)" : aboveResistance ? "var(--yellow)" : priceNearSupport ? "var(--green)" : "var(--dim)" },
      { l: "RSI (1h)", v: bearRsi != null ? Number(bearRsi).toFixed(1) : "\u2014", color: rsiOk ? "var(--green)" : "var(--dim)", tag: rsiOk ? " \u2713" : "" },
      { l: "VOL (1h)", v: `\u00D7${Number(bearVol).toFixed(2)}`, color: volOk ? "var(--green)" : "var(--dim)", tag: volOk ? " \u2713" : "" },
      { l: "CHANNEL", v: bc?.width ? `${bc.width}%` : "\u2014", color: channelColor, tag: bc?.width ? channelTag : "" },
    ];

    return (
      <div className={`${styles.signalCard} ${allMet ? styles.hot : styles.cold}`}>
        <div className={styles.signalHeader}>
          <span className={styles.ticker}>{s.symbol.replace("/USD", "")}</span>
          <span className={`${styles.scoreTag} ${allMet ? styles.scoreHigh : styles.scoreLow}`}>{statusLabel}</span>
        </div>
        <div className={`${styles.signalSummary} ${summaryClass}`}>{summary}</div>
        {showDetails && <MetricsGrid metrics={metrics} />}
        {showDetails && s.reasons?.length > 0 && <div className={styles.reasons}>{s.reasons.join(" \u00B7 ")}</div>}
      </div>
    );
  }

  // Bull mode — mean reversion
  const isBuy = s.signal === "buy";
  const isSell = s.signal === "sell";
  const summary = getExp1BullSummary(s);
  const summaryClass = isBuy ? styles.signalSummaryStrong : isSell ? styles.signalSummaryBear : styles.signalSummaryWeak;

  return (
    <div className={`${styles.signalCard} ${isBuy ? styles.hot : isSell ? styles.warm : styles.cold}`}>
      <div className={styles.signalHeader}>
        <span className={styles.ticker}>{s.symbol.replace("/USD", "")}</span>
        <span className={`${styles.scoreTag} ${isBuy ? styles.scoreHigh : isSell ? styles.scoreMed : styles.scoreLow}`}>
          {s.signal.toUpperCase()}
        </span>
      </div>
      <div className={`${styles.signalSummary} ${summaryClass}`}>{summary}</div>
      {showDetails && (
        <div className={styles.metrics}>
          <div className={styles.metric}><Tooltip label="PRICE"><span className={styles.metricLabel}>PRICE</span></Tooltip><span className={styles.metricVal}>${s.price < 1 ? s.price?.toFixed(4) : s.price?.toFixed(2)}</span></div>
          <div className={styles.metric}><Tooltip label="24H AVG"><span className={styles.metricLabel}>24H AVG</span></Tooltip><span className={styles.metricVal}>${s.avg24h < 1 ? s.avg24h?.toFixed(4) : s.avg24h?.toFixed(2)}</span></div>
          <div className={styles.metric}><Tooltip label="DEVIATION"><span className={styles.metricLabel}>DEVIATION</span></Tooltip><span className={styles.metricVal} style={{ color: s.deviation < 0 ? "var(--green)" : s.deviation > 0 ? "var(--red)" : "var(--text)" }}>{s.deviation >= 0 ? "+" : ""}{s.deviation?.toFixed(2)}%</span></div>
          <div className={styles.metric}><Tooltip label="TREND"><span className={styles.metricLabel}>TREND</span></Tooltip><span className={styles.metricVal} style={{ color: s.trend === "rising" ? "var(--green)" : s.trend === "falling" ? "var(--red)" : "var(--dim)" }}>{s.trend === "rising" ? "Rising" : s.trend === "falling" ? `${s.consecutiveDips || 0} dips` : "Flat"}</span></div>
          <div className={styles.metric}><Tooltip label="RSI"><span className={styles.metricLabel}>RSI</span></Tooltip><span className={styles.metricVal} style={{ color: s.rsi < 35 ? "var(--green)" : s.rsi > 70 ? "var(--red)" : "var(--text)" }}>{s.rsi ?? "\u2014"}</span></div>
          <div className={styles.metric}><Tooltip label="ROC"><span className={styles.metricLabel}>ROC</span></Tooltip><span className={styles.metricVal} style={{ color: s.minuteROC > 0 ? "var(--green)" : s.minuteROC < 0 ? "var(--red)" : "var(--dim)" }}>{s.minuteROC != null ? `${s.minuteROC > 0 ? "+" : ""}${s.minuteROC}%` : "\u2014"}</span></div>
        </div>
      )}
      {showDetails && (
        <div className={styles.deviationBar}>
          <div className={styles.deviationFill} style={{
            left: s.deviation < 0 ? `${50 + s.deviation * 5}%` : "50%",
            width: `${Math.min(Math.abs(s.deviation) * 5, 50)}%`,
            background: s.deviation < 0 ? "var(--green)" : "var(--red)",
          }} />
        </div>
      )}
      {showDetails && s.reasons?.length > 0 && <div className={styles.reasons}>{s.reasons.join(" \u00B7 ")}</div>}
    </div>
  );
}

// ─── Signal card for Experiment 2 ─────────────────────────────
function Exp2SignalCard({ s, regime, botStatus, showDetails }) {
  const isBear = regime?.current === "bear";

  if (isBear) {
    const acc = botStatus?.btcAccumulation || {};
    const flipPrice = acc.regimeFlipPrice || 0;
    const dropFromFlip = flipPrice > 0 ? ((flipPrice - s.price) / flipPrice * 100) : 0;
    const lastTranche = acc.trancheDetails?.length > 0 ? acc.trancheDetails[acc.trancheDetails.length - 1] : null;
    const dropFromLast = lastTranche ? ((lastTranche.entryPrice - s.price) / lastTranche.entryPrice * 100) : 0;
    const timeSinceLast = lastTranche ? ((Date.now() - new Date(lastTranche.timestamp).getTime()) / (1000 * 60 * 60)) : Infinity;
    const trancheCount = acc.tranches || 0;
    const maxTranches = acc.maxTranches || 4;
    const dropOk = trancheCount === 0 ? dropFromFlip >= 5 : dropFromLast >= 4;
    const spacingOk = timeSinceLast >= 12;
    const tranchesAvail = trancheCount < maxTranches;
    const allMet = dropOk && spacingOk && tranchesAvail;
    const statusLabel = !tranchesAvail ? "MAX TRANCHES" : allMet ? "READY" : "WAITING";

    const summary = getExp2BearSummary(acc, dropFromFlip, trancheCount, allMet);
    const summaryClass = allMet ? styles.signalSummaryStrong : styles.signalSummaryBear;

    const metrics = [
      { l: "PRICE", v: `$${s.price < 1 ? s.price?.toFixed(4) : s.price?.toFixed(2)}` },
      { l: "FLIP PRICE", v: flipPrice > 0 ? `$${flipPrice.toFixed(2)}` : "\u2014", color: "var(--dim)" },
      { l: "DROP", v: `${dropFromFlip.toFixed(1)}%`, color: (trancheCount === 0 ? dropFromFlip >= 5 : dropFromLast >= 4) ? "var(--green)" : "var(--dim)", tag: (trancheCount === 0 ? dropFromFlip >= 5 : dropFromLast >= 4) ? " \u2713" : ` (need ${trancheCount === 0 ? "5" : "4"}%)` },
      { l: "TRANCHES", v: `${trancheCount} / ${maxTranches}`, color: tranchesAvail ? "var(--green)" : "var(--yellow)", tag: !tranchesAvail ? " FULL" : "" },
      { l: "SPACING", v: timeSinceLast === Infinity ? "\u2014" : `${timeSinceLast.toFixed(1)}h`, color: spacingOk ? "var(--green)" : "var(--dim)", tag: spacingOk ? " \u2713" : " (need 12h)" },
      ...(acc.avgEntry ? [{ l: "AVG ENTRY", v: `$${acc.avgEntry.toFixed(2)}`, color: s.price >= acc.avgEntry ? "var(--green)" : "var(--red)" }] : []),
    ];

    return (
      <div className={`${styles.signalCard} ${allMet ? styles.hot : styles.cold}`}>
        <div className={styles.signalHeader}>
          <span className={styles.ticker}>{s.symbol.replace("/USD", "")}</span>
          <span className={`${styles.scoreTag} ${allMet ? styles.scoreHigh : !tranchesAvail ? styles.scoreHigh : styles.scoreLow}`} style={!tranchesAvail ? { background: "rgba(255,255,255,0.08)" } : undefined}>
            {statusLabel}
          </span>
        </div>
        <div className={`${styles.signalSummary} ${summaryClass}`}>{summary}</div>
        {showDetails && <MetricsGrid metrics={metrics} />}
      </div>
    );
  }

  // Bull mode — breakout
  const isBuy = s.signal === "buy";
  const summary = getExp2BullSummary(s);
  const summaryClass = isBuy ? styles.signalSummaryStrong : styles.signalSummaryWeak;

  return (
    <div className={`${styles.signalCard} ${isBuy ? styles.hot : styles.cold}`}>
      <div className={styles.signalHeader}>
        <span className={styles.ticker}>{s.symbol.replace("/USD", "")}</span>
        <span className={`${styles.scoreTag} ${isBuy ? styles.scoreHigh : styles.scoreLow}`}>
          {isBuy ? "BREAKOUT" : "WAITING"}
        </span>
      </div>
      <div className={`${styles.signalSummary} ${summaryClass}`}>{summary}</div>
      {showDetails && (
        <div className={styles.metrics}>
          <div className={styles.metric}><Tooltip label="PRICE"><span className={styles.metricLabel}>PRICE</span></Tooltip><span className={styles.metricVal}>${s.price < 1 ? s.price?.toFixed(4) : s.price?.toFixed(2)}</span></div>
          <div className={styles.metric}><Tooltip label="20-BAR HIGH"><span className={styles.metricLabel}>20-BAR HIGH</span></Tooltip><span className={styles.metricVal} style={{ color: s.conditions?.breakout ? "var(--green)" : "var(--dim)" }}>${s.breakoutHigh < 1 ? s.breakoutHigh?.toFixed(4) : s.breakoutHigh?.toFixed(2)}{s.conditions?.breakout ? " \u2713" : ""}</span></div>
          <div className={styles.metric}><Tooltip label="VOLUME"><span className={styles.metricLabel}>VOLUME</span></Tooltip><span className={styles.metricVal} style={{ color: s.conditions?.volume ? "var(--green)" : "var(--dim)" }}>{s.volumeRatio?.toFixed(1)}x{s.conditions?.volume ? " \u2713" : ""}</span></div>
          <div className={styles.metric}><span className={styles.metricLabel}>TREND</span><span className={styles.metricVal} style={{ color: s.conditions?.trend ? "var(--green)" : "var(--dim)" }}>{s.conditions?.trend ? "Above SMA50 \u2713" : "Below SMA50"}</span></div>
          <div className={styles.metric}><Tooltip label="RSI"><span className={styles.metricLabel}>RSI</span></Tooltip><span className={styles.metricVal} style={{ color: s.conditions?.rsi ? "var(--green)" : s.rsi > 72 ? "var(--red)" : "var(--dim)" }}>{s.rsi ?? "\u2014"}{s.conditions?.rsi ? " \u2713" : ""}</span></div>
        </div>
      )}
      {showDetails && s.reasons?.length > 0 && <div className={styles.reasons}>{s.reasons.join(" \u00B7 ")}</div>}
    </div>
  );
}

// ─── Shared metrics grid with tooltips ────────────────────────
function MetricsGrid({ metrics }) {
  return (
    <div className={styles.metrics}>
      {metrics.map((m) => (
        <div key={m.l} className={styles.metric}>
          <Tooltip label={m.l}><span className={styles.metricLabel}>{m.l}</span></Tooltip>
          <span className={styles.metricVal} style={{ color: m.color || "var(--text)" }}>
            {m.prefix || ""}{m.v}{m.tag || ""}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────
export default function SignalPanel({ signals, regime, botType, botStatus, title }) {
  const [showDetails, setShowDetails] = useState(false);
  const panelTitle = title || (regime?.current === "bear" ? "LIVE SIGNALS (Range Trading)" : "LIVE SIGNALS");

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 14px" }}>
        <div className={styles.panelTitle} style={{ padding: "10px 0 7px", border: "none" }}>{"\u25B2"} {panelTitle}</div>
        <button className={styles.detailToggle} onClick={() => setShowDetails(!showDetails)}>
          {showDetails ? "Simple" : "Details"}
          <span className={styles.detailToggleChevron} style={{ transform: showDetails ? "rotate(180deg)" : "rotate(0deg)" }}>{"\u25BC"}</span>
        </button>
      </div>
      {(!signals || signals.length === 0) ? (
        <div className={styles.empty}>No signals yet — start bot to scan</div>
      ) : (
        signals.map((s) => {
          if (botType === "exp1") return <Exp1SignalCard key={s.symbol} s={s} regime={regime} showDetails={showDetails} />;
          if (botType === "exp2") return <Exp2SignalCard key={s.symbol} s={s} regime={regime} botStatus={botStatus} showDetails={showDetails} />;
          return <MainSignalCard key={s.symbol} s={s} regime={regime} showDetails={showDetails} />;
        })
      )}
    </>
  );
}
