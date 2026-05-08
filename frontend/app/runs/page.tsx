import Link from 'next/link';
import { listRuns } from '../../lib/db';

export const dynamic = 'force-dynamic';

export default function RunsPage() {
  const runs = listRuns();

  return (
    <div>
      <h1>All runs ({runs.length})</h1>
      <div className="panel">
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
              <th className="num">Win%</th>
              <th className="num">MaxDD</th>
              <th className="num">Sharpe</th>
            </tr>
          </thead>
          <tbody>
            {runs.map(r => {
              const pct = r.totalReturnPct;
              const bh = r.buyHoldReturnPct;
              const alpha = pct !== null && bh !== null ? pct - bh : null;
              return (
                <tr key={r.id}>
                  <td className="num muted">
                    <Link href={`/runs/${r.id}`}>{r.id}</Link>
                  </td>
                  <td><Link href={`/runs/${r.id}`}>{r.strategy}</Link></td>
                  <td>{r.symbol}</td>
                  <td className="mono muted">
                    {new Date(r.startT).toISOString().slice(0, 10)} →{' '}
                    {r.endT ? new Date(r.endT).toISOString().slice(0, 10) : '—'}
                  </td>
                  <td className={cls(pct)}>{fmtPct(pct)}</td>
                  <td className={cls(alpha)}>{fmtPct(alpha)}</td>
                  <td className="num muted">{r.tradeCount ?? '—'}</td>
                  <td className="num muted">{r.winRatePct != null ? `${r.winRatePct.toFixed(0)}%` : '—'}</td>
                  <td className="num muted">{r.maxDrawdownPct != null ? `${r.maxDrawdownPct.toFixed(1)}%` : '—'}</td>
                  <td className="num muted">{r.sharpe != null ? r.sharpe.toFixed(2) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
