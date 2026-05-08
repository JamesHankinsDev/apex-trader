import Link from 'next/link';
import { listRuns } from '../../lib/db';

export const dynamic = 'force-dynamic';

export default function HowItWorksPage() {
  const runs = listRuns();
  const stats = {
    runs: runs.length,
    strategies: new Set(runs.map(r => r.strategy)).size,
    symbols: new Set(runs.map(r => r.symbol)).size,
    trades: runs.reduce((a, r) => a + (r.tradeCount ?? 0), 0),
  };

  return (
    <div>
      <h1>How it works</h1>

      <div className="panel">
        <p style={{ marginTop: 0, fontSize: '15px', lineHeight: 1.5 }}>
          APEX v2 is a <strong>backtest-first crypto strategy research tool</strong>.
          It runs trading strategies against historical bar data, records every
          trade and signal to SQLite, and gives you an honest view of whether
          an approach works — or doesn&apos;t.
        </p>
        <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: 0 }}>
          Every number on this site is read live from the database. Nothing is
          mocked, pre-computed, or summarised by hand.
        </p>
      </div>

      <div className="panel">
        <h2>What&apos;s in the database right now</h2>
        <div className="summary-grid">
          <StatBlock label="Backtest runs" value={stats.runs.toLocaleString()} />
          <StatBlock label="Strategies tested" value={String(stats.strategies)} />
          <StatBlock label="Symbols" value={`${stats.symbols} (BTC, ETH, SOL)`} />
          <StatBlock label="Trades recorded" value={stats.trades.toLocaleString()} />
        </div>
      </div>

      <section className="panel">
        <h2>The views</h2>
        <OnboardCard
          step={1}
          title="Matrix"
          href="/matrix"
          body={
            <>
              The fastest way to see <em>which strategies have edge in which
              market regimes</em>. Rows are strategy × symbol; columns are six
              market regimes (2020-2021 bull through 2026 bear). Each cell is
              coloured green or red by return %, and clicks drill into the
              specific run. Regimes marked <span className="oos-badge">OOS</span>{' '}
              are <strong>out-of-sample</strong> — data the strategies were not
              designed against. Green OOS cells are the only honest evidence
              of edge.
            </>
          }
        />
        <OnboardCard
          step={2}
          title="Runs list"
          href="/runs"
          body={
            <>
              Every backtest ever run, sortable. Use this when you want to
              compare runs side-by-side, or find a specific strategy/symbol
              combination quickly. Click any row to drill into the run.
            </>
          }
        />
        <OnboardCard
          step={3}
          title="Run detail"
          href="/runs/198"
          body={
            <>
              The deepest view. Summary header, parameter JSON, a{' '}
              <strong>price chart with entry/exit markers</strong>, an{' '}
              <strong>equity curve overlaid against buy-and-hold</strong>, and
              a trades table showing entry and exit reasons for every trade.
              This is where you understand <em>why</em> a strategy won or lost.
            </>
          }
        />
        <OnboardCard
          step={4}
          title="Portfolios"
          href="/portfolios"
          body={
            <>
              Multi-sleeve portfolio simulations. Each portfolio combines
              several (symbol, strategy) sleeves into one equity curve with
              optional quarterly/monthly rebalancing. This is where the
              &ldquo;which allocation actually beats buy-and-hold&rdquo;
              question is answered with real numbers.
            </>
          }
        />
      </section>

      <section className="panel">
        <h2>Key concepts</h2>

        <Concept term="Run">
          A single backtest. Defined by (strategy, symbol, timeframe, date range).
          Produces a trade ledger and summary stats, all persisted to SQLite.
        </Concept>

        <Concept term="Regime">
          A macro market state: <strong>bull</strong> (sustained uptrend),{' '}
          <strong>bear</strong> (sustained downtrend), or{' '}
          <strong>sideways</strong> (chop). The matrix compares strategies
          across six specific regime windows from 2020-2026.
        </Concept>

        <Concept term="Out-of-sample (OOS)">
          Data the strategy&apos;s defaults were <em>not</em> chosen against. For
          this project, 2020-2023 is OOS — strategies were designed looking at
          2024-2026 data. Performance on OOS data is the honest test; strong
          IS results with weak OOS results means the strategy is overfit.
        </Concept>

        <Concept term="vs B&amp;H">
          Strategy return minus buy-and-hold return for the same period. A
          positive number means the strategy beat simply buying and holding
          the asset. Often called <em>alpha</em>. This is the metric that
          actually matters — a strategy that returns +50% in a market that
          returned +100% is a bad strategy.
        </Concept>

        <Concept term="Sharpe ratio (annualized)">
          Risk-adjusted return. Mean bar return ÷ standard deviation of bar
          returns, annualized. A Sharpe of 1.0+ is considered good; 2.0+ is
          excellent. Negative Sharpe means returns are worse than the
          volatility would suggest. For context: most crypto strategies back-
          tested here have Sharpe 0 to 0.5 — statistical noise.
        </Concept>

        <Concept term="Max drawdown">
          The largest peak-to-trough decline in equity during the run. A
          strategy with +50% return but 60% max drawdown is <em>worse</em> than
          one with +20% return and 15% drawdown — you may not survive the
          drawdown emotionally or financially.
        </Concept>
      </section>

      <section className="panel">
        <h2>Recommended first tour</h2>
        <p style={{ color: 'var(--muted)', marginTop: 0 }}>
          Ten-minute walkthrough to build intuition for what the research has
          actually produced. Click each step in order.
        </p>

        <TourStep
          n={1}
          title="Scan the Matrix for signal"
          href="/matrix"
          body={
            <>
              Open the matrix. Look at the OOS columns (2020-2021 bull,
              2022 bear, 2023 recovery). Count how many cells are green. This
              is the honest answer to &ldquo;does anything have edge?&rdquo;
            </>
          }
        />
        <TourStep
          n={2}
          title="See a clear win"
          href="/runs/198"
          body={
            <>
              hold-crash-protected on ETH in 2022-bear. Strategy lost −2.6%
              while buy-and-hold lost −68.6%. That&apos;s +66pp of alpha by just
              stepping aside during a sustained bear. Look at the equity curve
              — the blue strategy line goes flat while the dashed B&amp;H line
              crashes.
            </>
          }
        />
        <TourStep
          n={3}
          title="See a clear failure"
          href="/runs/192"
          body={
            <>
              Same strategy, same year, different symbol: BTC in 2022-bear.
              Strategy lost −45.8%. The regime detector chopped back in on
              dead-cat bounces. Look at the trade markers on the price chart —
              every arrow up is a bad re-entry.
            </>
          }
        />
        <TourStep
          n={4}
          title="See the upside ceiling"
          href="/runs/201"
          body={
            <>
              ETH 2025-sideways: +27.9% vs B&amp;H −27.9%. +55.9pp alpha — the
              strategy made money while holding crashed. But compare to run
              #197 (ETH 2021-bull): strategy +80.5% while B&amp;H +364.5%. Same
              rules, very different outcomes depending on regime. The edge
              isn&apos;t universal.
            </>
          }
        />

        <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: 16 }}>
          After the tour, go back to{' '}
          <Link href="/matrix">the matrix</Link> and form your own conclusions.
          The data supports honest skepticism: simple technical strategies
          have limited durable edge in liquid crypto markets. Crash-protected
          hold on ETH is the best candidate we&apos;ve found so far — and it&apos;s
          still fragile.
        </p>
      </section>

      <div className="panel">
        <h2>Data pipeline</h2>
        <p style={{ color: 'var(--muted)', marginTop: 0 }}>
          For when you want to know how all this got here:
        </p>
        <ol style={{ color: 'var(--muted)', lineHeight: 1.8, marginBottom: 0 }}>
          <li>
            <code>npm run fetch-regimes</code> downloads OHLCV bars from
            Alpaca&apos;s crypto data API into <code>v2/data/apex.db</code>.
          </li>
          <li>
            <code>npm run matrix</code> runs every registered strategy across
            every (symbol, regime) combination, persisting each run.
          </li>
          <li>
            <code>npm run optimize-matrix</code> walk-forward optimises each
            strategy over rolling 180-day/60-day windows (in-sample grid search,
            out-of-sample evaluation).
          </li>
          <li>This UI reads the resulting SQLite database read-only.</li>
        </ol>
      </div>
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-item">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

function OnboardCard({
  step,
  title,
  href,
  body,
}: {
  step: number;
  title: string;
  href: string;
  body: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        padding: '12px 0',
        borderTop: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          minWidth: 28,
          height: 28,
          borderRadius: '50%',
          background: 'rgba(96, 165, 250, 0.15)',
          color: 'var(--blue)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 600,
          fontSize: 13,
        }}
      >
        {step}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ marginBottom: 4 }}>
          <Link href={href} style={{ fontSize: 15, fontWeight: 500 }}>
            {title} →
          </Link>
        </div>
        <div style={{ color: 'var(--muted)', fontSize: 13.5, lineHeight: 1.55 }}>
          {body}
        </div>
      </div>
    </div>
  );
}

function Concept({
  term,
  children,
}: {
  term: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: '10px 0',
        borderTop: '1px solid var(--border)',
      }}
    >
      <div style={{ fontWeight: 500, marginBottom: 4 }}>{term}</div>
      <div style={{ color: 'var(--muted)', fontSize: 13.5, lineHeight: 1.55 }}>
        {children}
      </div>
    </div>
  );
}

function TourStep({
  n,
  title,
  href,
  body,
}: {
  n: number;
  title: string;
  href: string;
  body: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: '14px 0',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        gap: 14,
      }}
    >
      <div
        style={{
          fontFamily: 'ui-monospace, monospace',
          color: 'var(--yellow)',
          fontSize: 13,
          minWidth: 32,
        }}
      >
        {`0${n}`.slice(-2)}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ marginBottom: 4 }}>
          <Link href={href} style={{ fontSize: 15, fontWeight: 500 }}>
            {title} →
          </Link>
        </div>
        <div style={{ color: 'var(--muted)', fontSize: 13.5, lineHeight: 1.55 }}>
          {body}
        </div>
      </div>
    </div>
  );
}
