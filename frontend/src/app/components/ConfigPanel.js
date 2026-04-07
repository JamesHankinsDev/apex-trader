import styles from "../page.module.css";

// ─── Strategy explainers (plain English for new traders) ─────

const STRATEGY_EXPLAINERS = {
  main: {
    bull: {
      title: "Momentum + Scalp",
      summary: "This bot runs two strategies at once. The swing strategy scores each coin every 30 seconds using RSI, volume, momentum, and trend direction. When a coin scores 65+ and the 1-hour trend confirms, it opens a position at 33% of your portfolio. Meanwhile, a parallel scalp loop watches for quick dips below the 20-bar average on 1-minute candles \u2014 buying small ($25) positions that exit as soon as price reverts to the mean, usually within minutes.",
      how: "Swing trades ride momentum for hours with a trailing stop that lets winners run. Scalps target tiny, high-probability mean-reversion plays \u2014 they win often but each win is small. Together, the swings capture big moves while scalps generate consistent activity between them.",
      risk: "Max 3 swing positions at 33% each. Each swing has a 5% stop loss and 24-hour time limit. Scalps have a tight 0.65% stop and 20-minute cap. A daily loss circuit breaker halts all new entries if the portfolio drops 5% in a day.",
    },
    bear: {
      title: "Range Trading + Bear Rally Scalps",
      summary: "When BTC drops below its 50-day average, this bot switches to defensive mode. It identifies support/resistance channels on each coin and buys near support when RSI confirms the coin is oversold. If a bear market rally is detected (BTC up 3%+ in 24h), it opens small scalp positions with a 1.5% take profit and 25-minute max hold.",
      how: "Range trades profit from predictable bounces within a descending channel. Bear rally scalps are speculative \u2014 they bet that altcoins will follow BTC's short-term bounce. Both use tight stops because bear markets can reverse sharply.",
      risk: "Range trades: 80% of channel width as TP, 3% below support as SL. Bear rally scalps: 25% of normal size, hard exit if BTC drops 3% from the rally high. All positions have an 8-hour cooldown after a stop loss to prevent revenge trading.",
    },
  },
  exp1: {
    bull: {
      title: "1-Minute Scalping",
      summary: "This bot is a pure scalper. Every 30 seconds, it checks if any watched coin has dipped at least 0.4% below its 20-bar moving average on 1-minute candles, with RSI below 45 confirming the dip. When conditions align, it buys a small $25 position and waits for price to snap back to the average.",
      how: "Mean reversion on short timeframes is one of the most reliable patterns in liquid markets. Price tends to oscillate around its average \u2014 the bot buys on the dips and sells on the revert. Most trades last 2\u201315 minutes. Exit triggers include price hitting the SMA (target), RSI climbing above 60 (momentum exhausted), volume fading for 3 candles, or a 20-minute hard cap.",
      risk: "Each position is only $25 with a 0.65% stop loss (about $0.16 max loss per trade). The bot can hold 2 scalps at once. Spread costs (~0.05% per side) are the biggest drag \u2014 the bot needs to win significantly more than it loses to be profitable after fees.",
    },
    bear: {
      title: "Dead Cat Bounce",
      summary: "In bear markets, this bot waits for extreme panic conditions \u2014 Fear & Greed below 15, hourly RSI below 25, price near support with 3+ red candles \u2014 then buys when a green reversal candle appears. These are the most violent bounces in crypto and can produce 10\u201315% gains in hours.",
      how: "Dead cat bounces happen when sellers exhaust themselves and bargain hunters rush in. The 5-condition entry filter ensures the bot only enters after genuine capitulation, not just a normal dip. It holds up to 36 hours with a 15% take profit target.",
      risk: "7% stop loss. This is a high-conviction, low-frequency strategy \u2014 it may go weeks without a trade. When it fires, the setup is strong, but the risk is that the \"bounce\" is actually a continuation of the selloff.",
    },
  },
  exp2: {
    bull: {
      title: "Breakout + Pre-Breakout Scalps",
      summary: "This bot watches for price breakouts above the 20-bar high on 4-hour candles. When a coin breaks out with volume confirmation and trend alignment, it goes all-in with 95% of available balance in a single concentrated position. Between breakouts, it runs a scalp loop on the same coins \u2014 buying small dips below the 1-minute SMA.",
      how: "Breakout trading captures the start of major moves. The bot uses a 15% trailing stop that ratchets up as price rises, letting winners run while protecting gains. LINK and AVAX are prioritized for scalps (most liquid); AAVE, DOT, and UNI require a stricter RSI < 40 to account for wider spreads.",
      risk: "Breakout positions are aggressive \u2014 95% of balance with a 20% hard stop means a failed breakout costs ~19% of the portfolio. This is offset by the 45% take profit target and trailing stop that can capture extended moves. Scalps are small ($25) and only fire when balance allows ($30+ available).",
    },
    bear: {
      title: "BTC DCA Accumulation + BTC Scalps",
      summary: "When the market turns bearish, this bot ignores altcoins and focuses on accumulating Bitcoin at lower prices. It deploys up to 4 tranches (22% of balance each) spaced 12 hours apart as BTC drops. Between tranches, it runs BTC scalps with half-size positions ($12.50) and tighter parameters.",
      how: "DCA (Dollar Cost Averaging) into BTC during a bear market is a long-term accumulation strategy. Each tranche buys BTC at progressively lower prices, reducing the average entry cost. BTC scalps during the 12-hour gaps generate small returns while waiting. All tranches exit when BTC crosses back above the 50-day SMA (bull signal returns).",
      risk: "Max 88% of balance deployed across 4 tranches. Emergency stop triggers if any single tranche is down 20%. BTC scalps use a tight 0.4% stop loss and 15-minute max hold \u2014 these are narrower than altcoin scalps because BTC has lower intraday volatility.",
    },
  },
};

export default function ConfigPanel({ botType, botStatus, config, running, onStart, onStop, connecting }) {
  const regime = botStatus?.regime;
  const isBear = regime?.current === "bear";
  const bgTint = "rgba(255,255,255,0.02)";
  const borderTint = "var(--border)";

  const strategyConfig = getStrategyConfig(botType, isBear, config, botStatus);
  const explainer = STRATEGY_EXPLAINERS[botType]?.[isBear ? "bear" : "bull"];

  return (
    <>
      <div className={styles.panelTitle}>{"\u25B2"} {botType === "main" ? "CONFIGURATION" : botType === "exp1" ? "EXPERIMENT CONFIG" : "BREAKOUT CONFIG"}</div>

      {/* Strategy explainer */}
      {explainer && (
        <div className={styles.configSection} style={{ borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 12 }}>{isBear ? "\uD83D\uDD34" : "\uD83D\uDFE2"}</span>
            <span style={{ color: "var(--text)", fontWeight: 600, fontSize: 14, fontFamily: "var(--font-display)", letterSpacing: 2 }}>
              {explainer.title}
            </span>
          </div>
          <div style={{ fontFamily: "var(--font-body)", fontSize: 13, lineHeight: 1.7, color: "rgba(255,255,255,0.7)" }}>
            <p style={{ marginBottom: 10 }}>{explainer.summary}</p>
            <p style={{ marginBottom: 10 }}><strong style={{ color: "var(--text)" }}>How it works:</strong> {explainer.how}</p>
            <p style={{ marginBottom: 0 }}><strong style={{ color: "var(--text)" }}>Risk management:</strong> {explainer.risk}</p>
          </div>
        </div>
      )}

      {/* Active strategy rules */}
      <div className={styles.configSection} style={{ background: bgTint, border: `1px solid ${borderTint}`, borderRadius: 6, padding: "14px 16px", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ color: "var(--text)", fontWeight: 600, fontSize: 12, letterSpacing: 1, fontFamily: "var(--font-mono)" }}>
            {strategyConfig.modeLabel}
          </span>
        </div>

        <div className={styles.configLabel}>ENTRY CRITERIA</div>
        {strategyConfig.entryRows.map((s) => (
          <div key={s.label} className={styles.configRow}>
            <span className={styles.configRowLabel}>{s.label}</span>
            <span className={styles.configRowVal}>{s.value}</span>
          </div>
        ))}

        <div className={styles.configLabel} style={{ marginTop: 12 }}>EXIT CRITERIA</div>
        {strategyConfig.exitRows.map((s) => (
          <div key={s.label} className={styles.configRow}>
            <span className={styles.configRowLabel}>{s.label}</span>
            <span className={styles.configRowVal}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* General params */}
      <div className={styles.configSection}>
        <div className={styles.configLabel}>GENERAL PARAMETERS</div>
        {strategyConfig.generalRows.map((s) => (
          <div key={s.label} className={styles.configRow}>
            <span className={styles.configRowLabel}>{s.label}</span>
            <span className={styles.configRowVal}>{s.value}</span>
          </div>
        ))}
        <div className={styles.hint} style={{ marginTop: 12 }}>
          {botType === "main" ? "Set via environment variables. Restart bot to apply changes." : botType === "exp1" ? "Set via EXPERIMENT_* environment variables." : "Uses EXPERIMENT_* API credentials. Separate internal state."}
        </div>
      </div>

      {/* Start/Stop */}
      <div className={styles.configSection}>
        {!running ? (
          <button className={styles.btnStart} onClick={onStart} disabled={connecting}>
            {connecting ? "CONNECTING..." : botType === "main" ? "\u25B6 START BOT" : botType === "exp1" ? "\u25B6 START EXPERIMENT" : "\u25B6 START EXPERIMENT 2"}
          </button>
        ) : (
          <button className={styles.btnStop} onClick={onStop}>
            {"\u25A0"} {botType === "main" ? "STOP BOT" : botType === "exp1" ? "STOP EXPERIMENT" : "STOP EXPERIMENT 2"}
          </button>
        )}
      </div>
    </>
  );
}

function getStrategyConfig(botType, isBear, config, botStatus) {
  if (botType === "main") {
    return {
      modeLabel: isBear ? "BEAR MODE \u2014 Range Trading + Bear Rally Scalps" : "BULL MODE \u2014 Momentum Swings + 1-Min Scalps",
      entryRows: isBear ? [
        { label: "Range: Near Support", value: "\u2264 2% above support" },
        { label: "Range: RSI (1h)", value: "< 40 (oversold)" },
        { label: "Range: Volume", value: "> 1.5x average" },
        { label: "Rally Scalp: RSI", value: "45\u201365 (momentum range)" },
        { label: "Rally Scalp: Volume", value: "> 2x average" },
        { label: "Rally Scalp: Size", value: "25% of normal" },
      ] : [
        { label: "Swing: Score", value: `\u2265 ${config?.entryScoreThreshold || 65}` },
        { label: "Swing: HTF Confirm", value: "1h trend not bearish" },
        { label: "Scalp: SMA Dip", value: "Price < SMA20 - 0.4%" },
        { label: "Scalp: RSI", value: "< 45 on 1-min" },
        { label: "Scalp: Size", value: `$${config?.scalpTradeSize || 25}` },
      ],
      exitRows: isBear ? [
        { label: "Range: TP", value: "80% of channel width" },
        { label: "Range: SL", value: "3% below support" },
        { label: "Rally: TP", value: "1.5%" },
        { label: "Rally: SMA Exit", value: "Price >= 1-min SMA20" },
        { label: "Rally: BTC Stop", value: "BTC drops 3% from high" },
        { label: "Rally: Max Hold", value: "25 min" },
      ] : [
        { label: "Swing: SL", value: `-${config?.stopLoss || 5}%` },
        { label: "Swing: TP", value: `+${config?.takeProfit || 15}%` },
        { label: "Swing: Max Hold", value: `${config?.maxHoldHours || 24}h` },
        { label: "Scalp: Target", value: "Price >= SMA20" },
        { label: "Scalp: SL", value: "0.65%" },
        { label: "Scalp: Max Hold", value: "20 min" },
      ],
      generalRows: [
        { label: "Swing Size", value: `${config?.positionSize || 33}%` },
        { label: "Max Swing Positions", value: config?.maxPositions || 3 },
        { label: "Scalp Size", value: `$${config?.scalpTradeSize || 25}` },
        { label: "Scan Interval", value: `${config?.scanInterval || 30}s` },
      ],
    };
  }

  if (botType === "exp1") {
    const es = botStatus;
    return {
      modeLabel: isBear ? "BEAR MODE \u2014 Dead Cat Bounce" : "BULL MODE \u2014 1-Min Scalping",
      entryRows: isBear ? [
        { label: "Fear & Greed", value: "< 15 (extreme panic)" },
        { label: "RSI (1h)", value: "< 25 (deeply oversold)" },
        { label: "Price at Support", value: "Within 2% above" },
        { label: "Prior Candles", value: "3+ consecutive red" },
        { label: "Reversal Signal", value: "Green candle or wick" },
      ] : [
        { label: "SMA Dip", value: "Price < SMA20 - 0.4%" },
        { label: "RSI (1-min)", value: "< 45" },
        { label: "Size", value: `$${es?.config?.scalpTradeSize || 25}` },
      ],
      exitRows: isBear ? [
        { label: "Take Profit", value: "15%" },
        { label: "Stop Loss", value: "7%" },
        { label: "Max Hold", value: "36h" },
      ] : [
        { label: "Target", value: "Price >= SMA20" },
        { label: "RSI Exit", value: "RSI > 60 (momentum done)" },
        { label: "Volume Fade", value: "3 low-vol candles" },
        { label: "Stop Loss", value: "0.65%" },
        { label: "Max Hold", value: "20 min" },
      ],
      generalRows: [
        { label: "Scalp Size", value: `$${es?.config?.scalpTradeSize || 25}` },
        { label: "Max Positions", value: es?.config?.maxPositions || 2 },
        { label: "Scan Interval", value: `${es?.config?.scanInterval || 30}s` },
      ],
    };
  }

  // exp2
  const e2 = botStatus;
  return {
    modeLabel: isBear ? "BEAR MODE \u2014 BTC DCA + BTC Scalps" : "BULL MODE \u2014 Breakout + Pre-Breakout Scalps",
    entryRows: isBear ? [
      { label: "DCA: First Drop", value: "\u2265 5% below flip price" },
      { label: "DCA: Next Drop", value: "\u2265 4% below prev tranche" },
      { label: "DCA: Spacing", value: "\u2265 12h between" },
      { label: "DCA: Max Tranches", value: "4 (22% each)" },
      { label: "Scalp: SMA Dip", value: "BTC < SMA20 - 0.25%" },
      { label: "Scalp: RSI", value: "< 42" },
    ] : [
      { label: "Breakout: Price", value: "> 20-bar high" },
      { label: "Breakout: Volume", value: "> 1.5x average" },
      { label: "Breakout: Trend", value: "Above SMA50" },
      { label: "Breakout: RSI", value: "52\u201372" },
      { label: "Scalp: SMA Dip", value: "< SMA20 - 0.4%" },
      { label: "Scalp: RSI", value: "LINK/AVAX < 45, others < 40" },
    ],
    exitRows: isBear ? [
      { label: "DCA: Gate Reopen", value: "Sell all on bull flip" },
      { label: "DCA: Emergency", value: "Any tranche -20%" },
      { label: "BTC Scalp: Target", value: "Price >= SMA20" },
      { label: "BTC Scalp: SL", value: "0.4%" },
      { label: "BTC Scalp: Max Hold", value: "15 min" },
    ] : [
      { label: "Breakout: Trail Stop", value: `${(e2?.config?.trailingStopPct || 0.15) * 100}% from high` },
      { label: "Breakout: Hard Stop", value: `-${(e2?.config?.hardStopPct || 0.20) * 100}%` },
      { label: "Breakout: TP", value: `${(e2?.config?.takeProfitMultiple || 3)}x stop` },
      { label: "Scalp: Target", value: "Price >= SMA20" },
      { label: "Scalp: SL", value: "0.65%" },
      { label: "Scalp: Max Hold", value: "20 min" },
    ],
    generalRows: [
      { label: "Breakout Size", value: `${Math.round((e2?.config?.positionSize || 0.95) * 100)}%` },
      { label: "Scalp Size", value: `$${e2?.config?.scalpTradeSize || 25}` },
      { label: "Min Scalp Balance", value: `$${e2?.config?.minScalpBalance || 30}` },
      { label: "Scan Interval", value: `${e2?.config?.scanInterval || 30}s` },
    ],
  };
}
