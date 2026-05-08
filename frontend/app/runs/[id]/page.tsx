import Link from 'next/link';
import { notFound } from 'next/navigation';
import RunCharts from '../../../components/RunCharts';
import { getRun, getTrades } from '../../../lib/db';

export const dynamic = 'force-dynamic';

export default function RunDetailPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const run = getRun(id);
  if (!run) notFound();
  const trades = getTrades(id);
  const summary = run.summary as Record<string, number | null | undefined>;

  return (
    <div>
      <p style={{ marginBottom: 8 }}>
        <Link href="/runs">← All runs</Link>
      </p>
      <h1>
        Run #{run.id}: {run.strategy} on {run.symbol}
      </h1>

      <div className="panel">
        <div className="summary-grid">
          <SummaryItem label="Strategy" value={run.strategy} />
          <SummaryItem label="Symbol" value={`${run.symbol} ${run.timeframe}`} />
          <SummaryItem
            label="Period"
            value={`${iso(run.startT)} → ${run.endT ? iso(run.endT) : '—'}`}
          />
          <SummaryItem
            label="Starting equity"
            value={`$${run.startingEquity.toLocaleString()}`}
          />
          <SummaryItem
            label="Ending equity"
            value={run.endingEquity !== null ? `$${run.endingEquity.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}
          />
          <SummaryItem
            label="Total return"
            value={fmtPct(summary.totalReturnPct ?? null)}
            tone={tone(summary.totalReturnPct ?? null)}
          />
          <SummaryItem
            label="Buy & hold"
            value={fmtPct(summary.buyHoldReturnPct ?? null)}
            tone={tone(summary.buyHoldReturnPct ?? null)}
          />
          <SummaryItem
            label="vs B&H"
            value={fmtPct(
              summary.totalReturnPct !== null &&
                summary.totalReturnPct !== undefined &&
                summary.buyHoldReturnPct !== null &&
                summary.buyHoldReturnPct !== undefined
                ? summary.totalReturnPct - summary.buyHoldReturnPct
                : null,
            )}
            tone={tone(
              summary.totalReturnPct !== null &&
                summary.totalReturnPct !== undefined &&
                summary.buyHoldReturnPct !== null &&
                summary.buyHoldReturnPct !== undefined
                ? summary.totalReturnPct - summary.buyHoldReturnPct
                : null,
            )}
          />
          <SummaryItem
            label="Trades"
            value={`${summary.tradeCount ?? 0} (${summary.winCount ?? 0}W / ${summary.lossCount ?? 0}L)`}
          />
          <SummaryItem
            label="Win rate"
            value={summary.winRatePct !== null && summary.winRatePct !== undefined ? `${summary.winRatePct.toFixed(0)}%` : '—'}
          />
          <SummaryItem
            label="Max drawdown"
            value={summary.maxDrawdownPct !== null && summary.maxDrawdownPct !== undefined ? `${summary.maxDrawdownPct.toFixed(2)}%` : '—'}
          />
          <SummaryItem
            label="Sharpe"
            value={summary.sharpe !== null && summary.sharpe !== undefined ? summary.sharpe.toFixed(2) : '—'}
          />
        </div>
      </div>

      <div className="panel">
        <h2>Parameters</h2>
        <pre className="mono" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
          {JSON.stringify(run.params, null, 2)}
        </pre>
      </div>

      <RunCharts runId={run.id} startingEquity={run.startingEquity} />

      <div className="panel">
        <h2>Trades ({trades.length})</h2>
        {trades.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No trades taken in this run.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Entry</th>
                <th>Exit</th>
                <th>Hold</th>
                <th className="num">Entry $</th>
                <th className="num">Exit $</th>
                <th className="num">P&amp;L</th>
                <th>Entry reason</th>
                <th>Exit reason</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t, i) => (
                <tr key={t.id}>
                  <td className="num muted">{i + 1}</td>
                  <td className="mono muted">{isoT(t.entryT)}</td>
                  <td className="mono muted">{isoT(t.exitT)}</td>
                  <td className="mono muted">{fmtDuration(t.holdMs)}</td>
                  <td className="num">{t.entryPrice.toFixed(2)}</td>
                  <td className="num">{t.exitPrice.toFixed(2)}</td>
                  <td className={t.pnlPct >= 0 ? 'num pos' : 'num neg'}>
                    {t.pnlPct >= 0 ? '+' : ''}{t.pnlPct.toFixed(2)}%
                  </td>
                  <td className="mono" style={{ fontSize: '11.5px' }}>{t.entryReason ?? '—'}</td>
                  <td className="mono" style={{ fontSize: '11.5px' }}>{t.exitReason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function SummaryItem({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'pos' | 'neg';
}) {
  const toneClass = tone === 'pos' ? 'num pos' : tone === 'neg' ? 'num neg' : '';
  return (
    <div className="summary-item">
      <div className="label">{label}</div>
      <div className={`value ${toneClass}`}>{value}</div>
    </div>
  );
}

function iso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
function isoT(ms: number): string {
  return new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
}
function fmtPct(v: number | null): string {
  if (v === null || v === undefined) return '—';
  const s = v >= 0 ? '+' : '';
  return `${s}${v.toFixed(2)}%`;
}
function tone(v: number | null): 'pos' | 'neg' | undefined {
  if (v === null || v === undefined) return undefined;
  return v >= 0 ? 'pos' : 'neg';
}
function fmtDuration(ms: number): string {
  const h = Math.floor(ms / (60 * 60 * 1000));
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}
