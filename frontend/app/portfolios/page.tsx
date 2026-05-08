import Link from 'next/link';
import { listPortfolios } from '../../lib/db';

export const dynamic = 'force-dynamic';

export default function PortfoliosPage() {
  const rows = listPortfolios();

  return (
    <div>
      <h1>Portfolios ({rows.length})</h1>
      <div className="panel">
        <p style={{ marginTop: 0, color: 'var(--muted)' }}>
          Each row is a multi-sleeve portfolio simulation: different symbols,
          different strategies, combined into one equity curve. Click a row for
          the detailed equity curve and sleeve breakdown.
        </p>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>TF</th>
              <th>Rebalance</th>
              <th>Period</th>
              <th className="num">Start</th>
              <th className="num">End</th>
              <th className="num">Return</th>
              <th className="num">MaxDD</th>
              <th className="num">Sharpe</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td className="num muted">
                  <Link href={`/portfolios/${r.id}`}>{r.id}</Link>
                </td>
                <td>
                  <Link href={`/portfolios/${r.id}`}>{r.name}</Link>
                </td>
                <td className="mono">{r.timeframe}</td>
                <td className="mono muted">
                  {r.rebalanceIntervalDays
                    ? `${r.rebalanceIntervalDays}d`
                    : '—'}
                </td>
                <td className="mono muted">
                  {new Date(r.startT).toISOString().slice(0, 10)} →{' '}
                  {new Date(r.endT).toISOString().slice(0, 10)}
                </td>
                <td className="num muted">
                  ${r.startingEquity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </td>
                <td className={r.endingEquity >= r.startingEquity ? 'num pos' : 'num neg'}>
                  ${r.endingEquity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </td>
                <td className={r.totalReturnPct >= 0 ? 'num pos' : 'num neg'}>
                  {r.totalReturnPct >= 0 ? '+' : ''}
                  {r.totalReturnPct.toFixed(2)}%
                </td>
                <td className="num muted">{r.maxDrawdownPct.toFixed(1)}%</td>
                <td className="num muted">
                  {r.sharpe !== null ? r.sharpe.toFixed(2) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
