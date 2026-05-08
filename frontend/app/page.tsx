import Link from 'next/link';
import { listRuns } from '../lib/db';

export const dynamic = 'force-dynamic';

export default function Home() {
  const runs = listRuns();
  const recent = runs.slice(0, 10);
  const stats = {
    total: runs.length,
    strategies: new Set(runs.map(r => r.strategy)).size,
    symbols: new Set(runs.map(r => r.symbol)).size,
    trades: runs.reduce((a, r) => a + (r.tradeCount ?? 0), 0),
  };

  return (
    <div>
      <h1>APEX TRADER v2</h1>

      <div
        className="panel"
        style={{ borderLeft: '3px solid var(--blue)', paddingLeft: 20 }}
      >
        <div
          style={{
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            color: 'var(--blue)',
            marginBottom: 6,
          }}
        >
          New here?
        </div>
        <div style={{ fontSize: 15, marginBottom: 8 }}>
          Start with <Link href="/how-it-works">the walkthrough</Link> — it
          explains the data model, key concepts (regime, OOS, vs B&amp;H), and
          gives you a 4-step tour of the most important runs.
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          If you&apos;re just here to explore, the{' '}
          <Link href="/matrix">matrix view</Link> is the fastest way to see
          what works and what doesn&apos;t.
        </div>
      </div>

      <div className="panel">
        <h2>Database snapshot</h2>
        <div className="summary-grid">
          <Stat label="Total runs" value={stats.total.toLocaleString()} />
          <Stat label="Strategies" value={String(stats.strategies)} />
          <Stat label="Symbols" value={String(stats.symbols)} />
          <Stat label="Trades recorded" value={stats.trades.toLocaleString()} />
        </div>
        <p
          style={{
            fontSize: 12,
            color: 'var(--muted)',
            marginTop: 16,
            marginBottom: 0,
          }}
        >
          Everything below is read live from SQLite — no caching, no mocks.
          Numbers change when you rerun the backtester.
        </p>
      </div>

      <div className="panel">
        <h2>Most recent runs</h2>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Strategy</th>
              <th>Symbol</th>
              <th>Period</th>
              <th className="num">Return</th>
              <th className="num">vs B&amp;H</th>
              <th className="num">Trades</th>
            </tr>
          </thead>
          <tbody>
            {recent.map(r => {
              const pct = r.totalReturnPct;
              const bh = r.buyHoldReturnPct;
              const alpha = pct !== null && bh !== null ? pct - bh : null;
              return (
                <tr key={r.id}>
                  <td className="num muted">
                    <Link href={`/runs/${r.id}`}>{r.id}</Link>
                  </td>
                  <td>
                    <Link href={`/runs/${r.id}`}>{r.strategy}</Link>
                  </td>
                  <td>{r.symbol}</td>
                  <td className="mono muted">
                    {new Date(r.startT).toISOString().slice(0, 10)} →{' '}
                    {r.endT ? new Date(r.endT).toISOString().slice(0, 10) : '—'}
                  </td>
                  <td className={cls(pct)}>{fmtPct(pct)}</td>
                  <td className={cls(alpha)}>{fmtPct(alpha)}</td>
                  <td className="num muted">{r.tradeCount ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
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

function fmtPct(v: number | null): string {
  if (v === null || v === undefined) return '—';
  const s = v >= 0 ? '+' : '';
  return `${s}${v.toFixed(2)}%`;
}
function cls(v: number | null): string {
  if (v === null || v === undefined) return 'num muted';
  return v >= 0 ? 'num pos' : 'num neg';
}
