import Link from 'next/link';
import { listRuns, type RunListRow } from '../../lib/db';
import { REGIMES, regimeForRun } from '../../lib/regimes';

export const dynamic = 'force-dynamic';

// Best-run-per-(strategy, symbol, regime) — if a combo was backtested multiple
// times (e.g. across iterations) show the most recent one so the matrix
// reflects the current state of the research.
export default function MatrixPage() {
  const runs = listRuns();

  // runs are ordered DESC by createdAt in listRuns; a Map.set call wins for
  // the FIRST insertion only if we invert order, so we iterate oldest→newest
  // to let recent runs overwrite older ones.
  const latest = new Map<string, RunListRow>();
  for (const r of [...runs].reverse()) {
    const regime = regimeForRun(r.startT, r.endT);
    if (!regime) continue;
    const key = `${r.strategy}|${r.symbol}|${regime.name}`;
    latest.set(key, r);
  }

  const strategies = Array.from(new Set(runs.map(r => r.strategy))).sort();
  const symbols = Array.from(new Set(runs.map(r => r.symbol))).sort();

  return (
    <div>
      <h1>Matrix view</h1>
      <div className="panel">
        <p style={{ marginTop: 0, color: 'var(--muted)' }}>
          Each cell = total return for the most recent run of that combination.
          Green dominates = strategy had edge in that regime. Click a cell to
          see trades + equity curve.{' '}
          <span className="oos-badge">OOS</span> marks regimes strategies were
          not designed against (out-of-sample).
        </p>

        <table>
          <thead>
            <tr>
              <th style={{ minWidth: 200 }}>Strategy</th>
              <th>Symbol</th>
              {REGIMES.map(r => (
                <th key={r.name} className="num" style={{ minWidth: 90 }}>
                  {r.name}
                  {r.oos && <span className="oos-badge">OOS</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {strategies.flatMap(strategy =>
              symbols.map(symbol => (
                <tr key={`${strategy}|${symbol}`}>
                  <td>{strategy}</td>
                  <td className="mono">{symbol}</td>
                  {REGIMES.map(regime => {
                    const run = latest.get(`${strategy}|${symbol}|${regime.name}`);
                    return (
                      <td key={regime.name} className="num">
                        {run ? <CellLink run={run} /> : <span className="muted">—</span>}
                      </td>
                    );
                  })}
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h2>Aggregates</h2>
        <p style={{ color: 'var(--muted)', marginTop: 0 }}>
          Average return across the 18 runs per strategy. OOS rows are the
          honest test.
        </p>
        <StrategyAggregates latest={latest} strategies={strategies} />
      </div>
    </div>
  );
}

function CellLink({ run }: { run: RunListRow }) {
  const pct = run.totalReturnPct;
  const cls =
    pct === null
      ? 'num muted'
      : pct >= 0
        ? 'num pos'
        : 'num neg';
  const bg =
    pct === null
      ? ''
      : pct >= 0
        ? `rgba(74, 222, 128, ${Math.min(0.4, Math.abs(pct) / 100)})`
        : `rgba(248, 113, 113, ${Math.min(0.4, Math.abs(pct) / 100)})`;
  return (
    <Link
      href={`/runs/${run.id}`}
      className="matrix-cell"
      style={{ background: bg, color: 'inherit', textDecoration: 'none' }}
    >
      <span className={cls}>
        {pct === null
          ? '—'
          : `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`}
      </span>
    </Link>
  );
}

function StrategyAggregates({
  latest,
  strategies,
}: {
  latest: Map<string, RunListRow>;
  strategies: string[];
}) {
  const rows = strategies.map(strategy => {
    const all = [...latest.values()].filter(r => r.strategy === strategy);
    const oos = all.filter(r => {
      const reg = regimeForRun(r.startT, r.endT);
      return reg?.oos ?? false;
    });
    const inSample = all.filter(r => {
      const reg = regimeForRun(r.startT, r.endT);
      return !(reg?.oos ?? false);
    });
    return {
      strategy,
      all: stats(all),
      oos: stats(oos),
      inSample: stats(inSample),
    };
  });
  return (
    <table>
      <thead>
        <tr>
          <th>Strategy</th>
          <th className="num">All runs</th>
          <th className="num">Profitable</th>
          <th className="num">OOS avg</th>
          <th className="num">OOS profitable</th>
          <th className="num">In-sample avg</th>
          <th className="num">In-sample profitable</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.strategy}>
            <td>{r.strategy}</td>
            <td className={toneCls(r.all.avg)}>
              {fmtPct(r.all.avg)}{' '}
              <span className="muted">({r.all.count})</span>
            </td>
            <td className="num muted">
              {r.all.profitable}/{r.all.count}
            </td>
            <td className={toneCls(r.oos.avg)}>{fmtPct(r.oos.avg)}</td>
            <td className="num muted">
              {r.oos.profitable}/{r.oos.count}
            </td>
            <td className={toneCls(r.inSample.avg)}>{fmtPct(r.inSample.avg)}</td>
            <td className="num muted">
              {r.inSample.profitable}/{r.inSample.count}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function stats(rows: RunListRow[]): {
  avg: number | null;
  count: number;
  profitable: number;
} {
  const withPct = rows.filter(
    (r): r is RunListRow & { totalReturnPct: number } => r.totalReturnPct !== null,
  );
  if (withPct.length === 0) return { avg: null, count: 0, profitable: 0 };
  const avg = withPct.reduce((a, r) => a + r.totalReturnPct, 0) / withPct.length;
  const profitable = withPct.filter(r => r.totalReturnPct > 0).length;
  return { avg, count: withPct.length, profitable };
}

function fmtPct(v: number | null): string {
  if (v === null) return '—';
  const s = v >= 0 ? '+' : '';
  return `${s}${v.toFixed(2)}%`;
}
function toneCls(v: number | null): string {
  if (v === null) return 'num muted';
  return v >= 0 ? 'num pos' : 'num neg';
}
