import Link from 'next/link';
import {
  listLiveTicks,
  listLiveTrades,
  listPortfolios,
  listRuns,
} from '../../lib/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Roadmap — APEX v2' };

export default function RoadmapPage() {
  const runs = listRuns();
  const portfolios = listPortfolios();
  const liveTicks = listLiveTicks(10);
  const liveTrades = listLiveTrades(10);
  const bestPortfolio = portfolios
    .slice()
    .sort((a, b) => b.totalReturnPct - a.totalReturnPct)[0];

  return (
    <div>
      <h1>What&apos;s next — v2 roadmap</h1>

      <div className="panel">
        <h2>Where we are today</h2>
        <p style={{ marginTop: 0, color: 'var(--muted)' }}>
          Research phase complete. The foundation backtester, walk-forward
          optimizer, regime detector, portfolio simulator, intrabar stop
          modeling, and UI are all built and working. We have data to support
          honest decisions going forward.
        </p>
        <div className="summary-grid" style={{ marginTop: 12 }}>
          <Stat label="Backtest runs" value={runs.length.toLocaleString()} />
          <Stat label="Portfolio simulations" value={portfolios.length.toLocaleString()} />
          <Stat
            label="Trades recorded"
            value={runs.reduce((a, r) => a + (r.tradeCount ?? 0), 0).toLocaleString()}
          />
          <Stat
            label="Best portfolio"
            value={
              bestPortfolio
                ? `+${bestPortfolio.totalReturnPct.toFixed(0)}% (5yr, backtest)`
                : '—'
            }
          />
        </div>
      </div>

      <div className="panel">
        <h2>Live status</h2>
        {liveTicks.length === 0 ? (
          <p style={{ color: 'var(--muted)', marginTop: 0 }}>
            No live ticks recorded yet. Run{' '}
            <code>npm run live-tick -- --mode paper</code> to trigger the first
            one. Phase 1 goes live once it runs on a daily cron with working
            paper credentials.
          </p>
        ) : (
          <div>
            <div className="summary-grid">
              <Stat
                label="Last tick"
                value={new Date(liveTicks[0]!.t).toLocaleString(undefined, {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              />
              <Stat label="Total ticks" value={String(liveTicks.length >= 10 ? '10+' : liveTicks.length)} />
              <Stat
                label="Account equity"
                value={
                  liveTicks[0]!.accountEquity !== null
                    ? `$${liveTicks[0]!.accountEquity!.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                    : '— (401 from Alpaca)'
                }
              />
              <Stat label="Live trades" value={String(liveTrades.length)} />
            </div>

            <h2 style={{ marginTop: 16 }}>Recent ticks</h2>
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Run</th>
                  <th>Mode</th>
                  <th>Signals</th>
                  <th>Orders</th>
                  <th>Errors</th>
                </tr>
              </thead>
              <tbody>
                {liveTicks.map(tick => (
                  <tr key={tick.id}>
                    <td className="mono muted">
                      {new Date(tick.t).toLocaleString(undefined, {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="mono">{tick.runName}</td>
                    <td className="mono muted">{tick.mode}</td>
                    <td className="mono" style={{ fontSize: 11.5 }}>
                      {tick.sleeveSignals
                        .map(s => `${s.symbol.split('/')[0]}:${s.action}`)
                        .join('  ')}
                    </td>
                    <td className="num muted">{tick.orders.length}</td>
                    <td className={tick.errors.length > 0 ? 'num neg' : 'num muted'}>
                      {tick.errors.length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {liveTrades.length > 0 && (
              <>
                <h2 style={{ marginTop: 16 }}>Recent live trades</h2>
                <table>
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Symbol</th>
                      <th>Strategy</th>
                      <th>Side</th>
                      <th className="num">Size</th>
                      <th>Status</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveTrades.slice(0, 10).map(t => (
                      <tr key={t.id}>
                        <td className="mono muted">
                          {new Date(t.t).toLocaleString(undefined, {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="mono">{t.symbol}</td>
                        <td>{t.strategy}</td>
                        <td className={t.side === 'buy' ? 'num pos' : 'num neg'}>
                          {t.side.toUpperCase()}
                        </td>
                        <td className="num muted">
                          {t.notional !== null
                            ? `$${t.notional.toFixed(2)}`
                            : t.qty !== null
                              ? t.qty.toFixed(4)
                              : '—'}
                        </td>
                        <td>
                          {t.submitted ? (
                            <span className="num pos">submitted</span>
                          ) : (
                            <span className="num muted">dry-run</span>
                          )}
                        </td>
                        <td className="mono muted" style={{ fontSize: 11.5 }}>
                          {t.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}
      </div>

      <Phase
        n={1}
        title="Paper deployment — now"
        status="in-progress"
        goal="Prove execution fidelity in a live environment."
        deliverables={[
          'Live runner for v2 (one-shot CLI, scheduled daily via cron)',
          'Config: 50/50 BTC/ETH, crash-protected hold, 1D timeframe, monthly rebalance',
          'Uses one Alpaca paper account; v1\'s three experiment bots keep running in parallel',
          'All live ticks + trades persisted to SQLite next to backtest data',
        ]}
        notes={
          'No v1 changes. No real money. The only thing we\'re testing is whether the strategy behaves live the way the backtest says it should.'
        }
      />

      <Phase
        n={2}
        title="Paper observation + ML pipeline — weeks 2-13"
        status="planned"
        goal="Accumulate 90 days of live data while preparing the ML filter."
        deliverables={[
          'Daily monitoring: live tick log, live trade log, divergence from backtest',
          'ML filter training pipeline: classifier over 5,235+ backtested trades',
          'Features: entry RSI, volatility percentile, regime, SMA distances, volume',
          'Target: trade was profitable (>0%)',
          'Trained but NOT yet deployed — validation happens in parallel with v2 paper',
        ]}
        notes={
          'ML here is a filter ("given strategy wants to enter, should I skip?"), not a new strategy. Training on existing backtest trade outputs, not trying to discover signal from scratch.'
        }
      />

      <Phase
        n={3}
        title="Evaluate + A/B ML — around week 13"
        status="planned"
        goal="Decide whether v2 is ready to replace v1; start ML A/B test."
        deliverables={[
          'Compare v2 paper return vs backtest expectation (±2-3%/month is acceptable)',
          'Diagnose any divergence before cutting v1',
          'If clean: shut down v1 experiment bots and v1 live trader',
          'Spin up second v2 instance on a different Alpaca paper key: v2-ml (same strategy + ML filter)',
          'Let v2 and v2-ml run 60-90 days in parallel',
        ]}
        notes={
          '30 days is not enough for a ~12-trades/year strategy — we need to see a real regime transition. 90 days minimum, ideally 180.'
        }
      />

      <Phase
        n={4}
        title="Real money, small — month 6+"
        status="planned"
        goal="Graduate to live capital with managed risk."
        deliverables={[
          'Start with 10% of intended capital (e.g. $1k of a $10k target)',
          'Daily monitoring + alerts on drawdown thresholds',
          'Scale to 50% after 3 months of positive-or-expected performance',
          'Full capital after a full year of live validation',
        ]}
        notes={
          'A 45% max drawdown is real — plan now for how you\'ll feel when your $10k drops to $5.5k. Behavioural tolerance is part of the strategy, not a side effect.'
        }
      />

      <div className="panel">
        <h2>Open experiments (unordered, no timeline)</h2>
        <p style={{ color: 'var(--muted)', marginTop: 0 }}>
          Things worth trying that aren&apos;t blocking Phase 1-4. Each would
          extend the research phase with a specific question.
        </p>
        <ul
          style={{
            color: 'var(--muted)',
            lineHeight: 1.7,
            paddingLeft: 20,
          }}
        >
          <li>
            <strong>Weighted portfolio by historical Sharpe</strong> — allocate
            more to sleeves that scored higher in backtest. Risks overfitting
            to past winners; worth testing.
          </li>
          <li>
            <strong>Alternative weight schemes</strong> — 70/30 BTC/ETH, 60/40,
            etc. Our 50/50 choice was arbitrary. One-day experiment.
          </li>
          <li>
            <strong>Multi-factor regime detector v3</strong> — add ATR
            percentile, RSI divergence, range-position alongside SMA crossover.
            Might fix the 2022 chop problem that hysteresis only partly
            addressed.
          </li>
          <li>
            <strong>Daily bar strategies for the active sleeve</strong> — retest
            breakout-momentum and sma-trend at 1D with intrabar stops. We saw
            positive signs but intrabar stops shifted the numbers; worth a
            fresh sweep.
          </li>
          <li>
            <strong>Pairs / basket strategies</strong> — trade BTC-ETH spread
            instead of each independently. Stat-arb territory. More complex.
          </li>
          <li>
            <strong>On-chain data integration</strong> — hash rate, active
            addresses, exchange netflows. Not available through Alpaca; would
            need a separate data source. Significant infrastructure addition.
          </li>
          <li>
            <strong>Walk-forward optimize the rebalance cadence</strong> —
            daily / weekly / monthly / quarterly / yearly. Low cost test.
          </li>
        </ul>
      </div>

      <div className="panel">
        <h2>Things we deliberately aren&apos;t doing</h2>
        <p style={{ color: 'var(--muted)', marginTop: 0 }}>
          Paths we&apos;ve already ruled out or deprioritized, so we don&apos;t
          forget why.
        </p>
        <ul
          style={{ color: 'var(--muted)', lineHeight: 1.7, paddingLeft: 20 }}
        >
          <li>
            <strong>Scalping / sub-1H timeframes</strong> — the meme-coin
            timeframe experiment (see <Link href="/runs">backtest runs</Link>)
            showed 15Min = -81% average return on volatile coins. Spread tax
            dominates any technical signal. Not viable at retail.
          </li>
          <li>
            <strong>Aggressive active trading on alts</strong> — 400+ trades
            per sleeve per 5 years on volatile alts cost 60-90% of principal
            in spread fees. Hold-protected or don&apos;t participate.
          </li>
          <li>
            <strong>DOGE-reliant portfolios</strong> — the +440% backtest
            result required being long DOGE through its 2021 and 2024 moves.
            We can&apos;t pick DOGE in advance. Treat alt outperformance as
            noise for planning purposes.
          </li>
          <li>
            <strong>Strategy optimization without validation</strong> —
            walk-forward showed parameter optimization did NOT improve OOS
            performance for most strategies. We stopped parameter-tuning
            in-sample and focused on architectural changes (rebalance,
            timeframe, regime detection).
          </li>
        </ul>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-item">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

function Phase({
  n,
  title,
  status,
  goal,
  deliverables,
  notes,
}: {
  n: number;
  title: string;
  status: 'in-progress' | 'planned' | 'done';
  goal: string;
  deliverables: string[];
  notes: string;
}) {
  const statusColor =
    status === 'in-progress'
      ? '#fbbf24'
      : status === 'done'
        ? '#4ade80'
        : '#8492a6';
  const statusLabel =
    status === 'in-progress'
      ? 'IN PROGRESS'
      : status === 'done'
        ? 'DONE'
        : 'PLANNED';
  return (
    <div
      className="panel"
      style={{ borderLeft: `3px solid ${statusColor}`, paddingLeft: 20 }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 6,
        }}
      >
        <div
          style={{
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            color: statusColor,
          }}
        >
          Phase {n} · {statusLabel}
        </div>
      </div>
      <h2 style={{ margin: '4px 0 8px 0', color: 'var(--text)' }}>{title}</h2>
      <div
        style={{
          fontSize: 13,
          color: 'var(--muted)',
          marginBottom: 10,
          fontStyle: 'italic',
        }}
      >
        Goal: {goal}
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
        DELIVERABLES
      </div>
      <ul style={{ lineHeight: 1.6, paddingLeft: 20, margin: '4px 0 12px' }}>
        {deliverables.map((d, i) => (
          <li key={i} style={{ fontSize: 13.5 }}>{d}</li>
        ))}
      </ul>
      <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
        <strong style={{ color: 'var(--text)' }}>Note:</strong> {notes}
      </div>
    </div>
  );
}
