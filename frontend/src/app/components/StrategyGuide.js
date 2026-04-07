import styles from "../page.module.css";

export default function StrategyGuide({ onClose }) {
  return (
    <div className={styles.guideOverlay} onClick={onClose}>
      <div className={styles.guidePanel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.guideHeader}>
          <span>STRATEGY GUIDE</span>
          <button className={styles.guideClose} onClick={onClose}>X</button>
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
            <p>Each asset receives a score every scan cycle. A score of <strong>70+</strong> triggers a buy signal. The score starts at 50 (neutral) and is adjusted by:</p>
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
            <p>The highest-scoring asset is then checked against the <strong>1-hour timeframe</strong> for trend confirmation. If the higher timeframe is bearish, the entry is skipped.</p>
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
              <div className={styles.guideRow}><span><strong>RSI</strong> (Relative Strength Index)</span><span>Momentum oscillator (0-100). Below 30 = oversold (buy signal), above 70 = overbought (sell signal).</span></div>
              <div className={styles.guideRow}><span><strong>SMA</strong> (Simple Moving Average)</span><span>Average price over N periods. SMA5 crossing above SMA20 signals a short-term uptrend.</span></div>
              <div className={styles.guideRow}><span><strong>Volume Ratio</strong></span><span>Current volume divided by average volume. Values above 1.5x indicate unusual activity.</span></div>
              <div className={styles.guideRow}><span><strong>Momentum</strong></span><span>Percentage price change over the last 10 bars. Positive = trending up.</span></div>
              <div className={styles.guideRow}><span><strong>ATR</strong> (Average True Range)</span><span>Measures volatility — the average range of price bars as a % of price.</span></div>
            </div>
          </section>

          <section className={styles.guideSection}>
            <h3>Performance Metrics</h3>
            <div className={styles.guideTable}>
              <div className={styles.guideRow}><span><strong>Sharpe Ratio</strong></span><span>Risk-adjusted return. Above 1.0 is good, above 2.0 is excellent.</span></div>
              <div className={styles.guideRow}><span><strong>Sortino Ratio</strong></span><span>Like Sharpe but only penalizes downside volatility. Above 1.5 is good, above 3.0 is excellent.</span></div>
              <div className={styles.guideRow}><span><strong>Max Drawdown</strong></span><span>Largest peak-to-trough decline. Above 20% is concerning.</span></div>
              <div className={styles.guideRow}><span><strong>Profit Factor</strong></span><span>Gross profits / gross losses. Above 1.5 is solid, above 2.0 is excellent.</span></div>
              <div className={styles.guideRow}><span><strong>Avg Win/Loss Ratio</strong></span><span>Average winning trade / average losing trade. Above 1.0 means wins are larger.</span></div>
            </div>
          </section>

          <section className={styles.guideSection}>
            <h3>Benchmarks</h3>
            <div className={styles.guideTable}>
              <div className={styles.guideRow}><span><strong>BTC Hold</strong></span><span>What you would have earned by simply holding Bitcoin.</span></div>
              <div className={styles.guideRow}><span><strong>Equal Weight</strong></span><span>Hypothetical portfolio invested equally across all watchlist assets.</span></div>
              <div className={styles.guideRow}><span><strong>Mcap Weight</strong></span><span>Portfolio weighted by market cap, like an index fund.</span></div>
              <div className={styles.guideRow}><span><strong>VS Benchmarks</strong></span><span>Positive = outperforming (alpha). Negative = underperforming.</span></div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
