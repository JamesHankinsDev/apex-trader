"use client";
import { useState } from "react";
import styles from "../page.module.css";

// Metric explanation database
const EXPLANATIONS = {
  // Bull mode metrics
  "RSI": "Relative Strength Index (0-100). Below 30 means oversold (potential buy). Above 70 means overbought (potential sell).",
  "VOLUME": "Current trading volume vs the 20-bar average. Above 1.5x suggests strong interest and adds conviction to signals.",
  "MOM": "Price change over the last 10 bars. Positive means price is trending up. Strong momentum (>2%) is a bullish signal.",
  "PRICE": "Current market price from Alpaca.",
  "SCORE": "Composite score (0-100) combining RSI, volume, momentum, and trend signals. 70+ triggers a buy.",

  // Bear mode metrics
  "SUP / RES": "Support is the price floor where buyers tend to step in. Resistance is the ceiling where sellers appear. The bot buys near support.",
  "RSI (1h)": "Hourly RSI — below 40 means oversold on the 1-hour timeframe, which is the entry trigger for range trades.",
  "VOL (1h)": "Hourly volume ratio. Above 1.5x average confirms genuine buying interest, not just thin price movement.",
  "CHANNEL": "The width between support and resistance as a %. Wider channels (>5%) give more room for profitable trades.",

  // Exp1 metrics
  "24H AVG": "The average price over the last 24 hours. The bot buys when price dips below this average by the threshold amount.",
  "DEVIATION": "How far price has moved from the 24-hour average. Negative = below average (potential buy). Positive = above (potential sell).",
  "TREND": "Whether recent price bars are consistently rising or falling. Consecutive dips help confirm a dip-buying opportunity.",
  "ROC": "Rate of Change — the minute-by-minute price momentum. Shows very short-term direction.",

  // Exp2 metrics
  "20-BAR HIGH": "The highest price in the last 20 candles. A breakout occurs when price exceeds this level with volume confirmation.",
  "FLIP PRICE": "The BTC price when the market flipped from bull to bear. DCA tranches are measured as drops from this price.",
  "DROP": "How far the price has fallen from the reference point. Each DCA tranche requires a minimum drop before deploying.",
  "TRANCHES": "How many of the available DCA buy slots have been used. Each tranche is ~22% of balance.",
  "SPACING": "Time since the last tranche was deployed. Minimum 12 hours between tranches to avoid buying into a freefall.",
  "AVG ENTRY": "The average price across all deployed DCA tranches. Green if current price is above (in profit).",

  // Regime signals
  "ADX": "Average Directional Index — measures trend strength (not direction). Above 25 = strong trend. Below 20 = choppy/ranging.",
  "Gap": "How far BTC is from its 50-day moving average. Negative = below (bearish). Positive = above (bullish).",
  "F&G": "Fear & Greed Index (0-100). Below 20 = extreme fear (historically good buying zones). Above 80 = extreme greed.",

  // Risk metrics
  "SHARPE RATIO": "Risk-adjusted return — how much return you get per unit of risk. Above 1.0 is good, above 2.0 is excellent.",
  "SORTINO RATIO": "Like Sharpe but only counts downside risk. Above 1.5 is good, above 3.0 is excellent.",
  "MAX DRAWDOWN": "The largest peak-to-trough drop in portfolio value. Shows your worst-case experienced loss.",
  "PROFIT FACTOR": "Total money won divided by total money lost. Above 1.0 = profitable. Above 1.5 = solid.",
  "AVG WIN/LOSS": "Average winning trade size divided by average losing trade size. Above 1.0 means wins are bigger than losses.",
};

export default function Tooltip({ label, children }) {
  const [show, setShow] = useState(false);
  const explanation = EXPLANATIONS[label];
  if (!explanation) return children;

  return (
    <span
      className={styles.tooltipWrap}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onClick={(e) => { e.stopPropagation(); setShow(!show); }}
    >
      {children}
      <span className={styles.tooltipIcon}>?</span>
      {show && (
        <span className={styles.tooltipPopup}>
          <span className={styles.tooltipTitle}>{label}</span>
          <span className={styles.tooltipText}>{explanation}</span>
        </span>
      )}
    </span>
  );
}

// Export explanations for use in other components
export { EXPLANATIONS };
