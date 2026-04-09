import styles from "../page.module.css";

// Thresholds for the health diagnostic
const HEALTH_RULES = [
  {
    label: "Win rate",
    check: (s) => {
      const total = (s.wins || 0) + (s.losses || 0);
      if (total < 20) return { status: "wait", msg: `${total} trades — need 20+ for a meaningful sample` };
      const wr = s.wins / total;
      if (wr >= 0.38) return { status: "ok", msg: `${(wr * 100).toFixed(0)}% — healthy range` };
      if (wr >= 0.25) return { status: "warn", msg: `${(wr * 100).toFixed(0)}% — below target, monitor closely` };
      return { status: "bad", msg: `${(wr * 100).toFixed(0)}% — investigate strategy or market regime` };
    },
  },
  {
    label: "Trade frequency",
    check: (s) => {
      const total = (s.wins || 0) + (s.losses || 0);
      // Rough estimate: if we know start time vs now
      if (total === 0) return { status: "wait", msg: "No trades yet" };
      if (total > 30 && s._hoursRunning && s._hoursRunning < 24)
        return { status: "warn", msg: `${total} trades in ${s._hoursRunning.toFixed(0)}h — may be overtrading` };
      return { status: "ok", msg: `${total} trades — reasonable frequency` };
    },
  },
  {
    label: "Drawdown",
    check: (s) => {
      const pv = s.portfolioValue || 0;
      const sv = s.startValue || pv;
      if (sv === 0) return { status: "wait", msg: "No data" };
      const dd = ((pv - sv) / sv) * 100;
      if (dd >= -2) return { status: "ok", msg: `${dd >= 0 ? "+" : ""}${dd.toFixed(1)}% — within normal range` };
      if (dd >= -8) return { status: "warn", msg: `${dd.toFixed(1)}% — elevated but expected in volatile markets` };
      return { status: "bad", msg: `${dd.toFixed(1)}% — significant drawdown, review positions` };
    },
  },
  {
    label: "Position concentration",
    check: (s) => {
      const positions = Object.keys(s.positions || {}).length;
      if (positions === 0) return { status: "ok", msg: "No open positions" };
      if (positions <= 2) return { status: "ok", msg: `${positions} position(s) — well diversified` };
      return { status: "warn", msg: `${positions} positions — high concentration risk` };
    },
  },
];

const STATUS_ICON = { ok: "\u2713", warn: "\u25B2", bad: "\u2717", wait: "\u25CF" };
const STATUS_COLOR = { ok: "var(--green)", warn: "var(--yellow)", bad: "var(--red)", wait: "var(--dim)" };

function HealthCheck({ statuses }) {
  // Combine stats from all bots
  const combined = statuses.reduce(
    (acc, { status: s }) => {
      if (!s) return acc;
      acc.wins += s.wins || 0;
      acc.losses += s.losses || 0;
      acc.portfolioValue += s.portfolioValue || 0;
      acc.startValue += s.startValue || s.portfolioValue || 0;
      const pos = s.positions || {};
      Object.keys(pos).forEach((k) => (acc.positions[k] = true));
      return acc;
    },
    { wins: 0, losses: 0, portfolioValue: 0, startValue: 0, positions: {} }
  );

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 2,
        color: "var(--dim)", marginBottom: 10, textTransform: "uppercase",
      }}>
        System Health
      </div>
      {HEALTH_RULES.map((rule) => {
        const result = rule.check(combined);
        return (
          <div key={rule.label} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "8px 0", borderBottom: "1px solid var(--border)",
          }}>
            <span style={{
              color: STATUS_COLOR[result.status], fontFamily: "var(--font-mono)",
              fontSize: 14, width: 18, textAlign: "center",
            }}>
              {STATUS_ICON[result.status]}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)" }}>
                {rule.label}
              </div>
              <div style={{ fontSize: 12, color: "var(--dim)", marginTop: 2 }}>
                {result.msg}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Expectations({ onClose, statuses }) {
  return (
    <div className={styles.guideOverlay} onClick={onClose}>
      <div className={styles.guidePanel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.guideHeader}>
          <span>REALISTIC EXPECTATIONS</span>
          <button className={styles.guideClose} onClick={onClose}>X</button>
        </div>
        <div className={styles.guideContent}>

          <section className={styles.guideSection}>
            <h3>What to Expect</h3>
            <p>
              Automated crypto trading is a <strong>long game</strong>. Even well-tuned strategies
              experience losing streaks, drawdowns, and flat periods. The goal is not to win every trade
              — it is to have a positive expected value over hundreds of trades.
            </p>
            <div className={styles.guideTable}>
              <div className={styles.guideRow}><span>Realistic win rate</span><span>35-55%</span></div>
              <div className={styles.guideRow}><span>Avg winner vs avg loser</span><span>Winners should be 1.5-3x larger</span></div>
              <div className={styles.guideRow}><span>Normal drawdown</span><span>5-15% from peak</span></div>
              <div className={styles.guideRow}><span>Break-even timeline</span><span>1-4 weeks of tuning</span></div>
              <div className={styles.guideRow}><span>Minimum sample size</span><span>50+ trades before judging</span></div>
            </div>
          </section>

          <section className={styles.guideSection}>
            <h3>Patience vs. Problem</h3>
            <p>
              Not every bad run means something is broken. Use these guidelines to decide whether
              to <strong>wait it out</strong> or <strong>investigate</strong>:
            </p>

            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12,
            }}>
              <div style={{
                background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.12)",
                borderRadius: 6, padding: 14,
              }}>
                <div style={{
                  fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 2,
                  color: "var(--green)", marginBottom: 8,
                }}>
                  BE PATIENT WHEN...
                </div>
                <ul style={{ paddingLeft: 16, fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
                  <li style={{ marginBottom: 6 }}>Fewer than 50 trades completed</li>
                  <li style={{ marginBottom: 6 }}>Win rate is 30-45% with winners larger than losers</li>
                  <li style={{ marginBottom: 6 }}>Drawdown is under 10% from starting value</li>
                  <li style={{ marginBottom: 6 }}>Market is choppy/ranging (low ADX)</li>
                  <li style={{ marginBottom: 6 }}>Bot has been running less than 1 week</li>
                  <li style={{ marginBottom: 6 }}>Losses are small and controlled (stops working)</li>
                </ul>
              </div>

              <div style={{
                background: "rgba(255,51,85,0.04)", border: "1px solid rgba(255,51,85,0.12)",
                borderRadius: 6, padding: 14,
              }}>
                <div style={{
                  fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 2,
                  color: "var(--red)", marginBottom: 8,
                }}>
                  INVESTIGATE WHEN...
                </div>
                <ul style={{ paddingLeft: 16, fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
                  <li style={{ marginBottom: 6 }}>Win rate below 25% after 50+ trades</li>
                  <li style={{ marginBottom: 6 }}>Average loss is larger than average win</li>
                  <li style={{ marginBottom: 6 }}>Drawdown exceeds 15% from starting value</li>
                  <li style={{ marginBottom: 6 }}>Dozens of trades per day (overtrading)</li>
                  <li style={{ marginBottom: 6 }}>Most losses are stop-outs within minutes</li>
                  <li style={{ marginBottom: 6 }}>Bot trades against the trend repeatedly</li>
                </ul>
              </div>
            </div>
          </section>

          <section className={styles.guideSection}>
            <h3>Key Metrics That Matter</h3>
            <div className={styles.guideTable}>
              <div className={styles.guideRow}>
                <span>Profit Factor</span>
                <span>Gross profit / gross loss. Target: <strong style={{ color: "var(--green)" }}>&gt;1.3</strong></span>
              </div>
              <div className={styles.guideRow}>
                <span>Avg Win / Avg Loss ratio</span>
                <span>How much you make vs lose per trade. Target: <strong style={{ color: "var(--green)" }}>&gt;1.5</strong></span>
              </div>
              <div className={styles.guideRow}>
                <span>Max Drawdown</span>
                <span>Worst peak-to-trough drop. Acceptable: <strong style={{ color: "var(--yellow)" }}>5-15%</strong></span>
              </div>
              <div className={styles.guideRow}>
                <span>Expectancy</span>
                <span>(Win% x Avg Win) - (Loss% x Avg Loss). Must be <strong style={{ color: "var(--green)" }}>positive</strong></span>
              </div>
              <div className={styles.guideRow}>
                <span>Sharpe Ratio</span>
                <span>Risk-adjusted return. Target: <strong style={{ color: "var(--green)" }}>&gt;1.0</strong></span>
              </div>
            </div>
          </section>

          <section className={styles.guideSection}>
            <h3>The First 7 Days</h3>
            <p>Here is what a <strong>normal</strong> first week looks like — even for a profitable strategy:</p>
            <div className={styles.guideTable}>
              <div className={styles.guideRow}><span>Day 1-2</span><span>Initial trades fire. Expect mixed results. Losses are normal.</span></div>
              <div className={styles.guideRow}><span>Day 3-4</span><span>Enough data to see patterns. Win rate may still be low (30-40%).</span></div>
              <div className={styles.guideRow}><span>Day 5-7</span><span>50+ trades completed. Win rate and profit factor become meaningful.</span></div>
            </div>
            <p style={{ marginTop: 12, fontStyle: "italic", color: "var(--dim)" }}>
              A strategy that is profitable over 200 trades can easily lose 10 in a row.
              That is statistics, not a bug.
            </p>
          </section>

          <section className={styles.guideSection}>
            <h3>Common Pitfalls</h3>
            <ul>
              <li><strong>Changing strategy too early</strong> — give it at least 50 trades and 5 days before tweaking parameters</li>
              <li><strong>Judging by individual trades</strong> — one loss or one win means nothing statistically</li>
              <li><strong>Ignoring market conditions</strong> — no strategy works in all markets. Bear markets will underperform.</li>
              <li><strong>Overtrading</strong> — more trades does not mean more profit. Quality over quantity.</li>
              <li><strong>Emotional intervention</strong> — manually selling during a dip defeats the stop-loss system</li>
            </ul>
          </section>

          <HealthCheck statuses={statuses} />

        </div>
      </div>
    </div>
  );
}
