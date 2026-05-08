import Link from 'next/link';
import { notFound } from 'next/navigation';
import PortfolioChart from '../../../components/PortfolioChart';
import { getPortfolio } from '../../../lib/db';

const DAY_MS = 24 * 60 * 60 * 1000;

export const dynamic = 'force-dynamic';

export default function PortfolioDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const id = Number(params.id);
  const portfolio = getPortfolio(id);
  if (!portfolio) notFound();

  return (
    <div>
      <p style={{ marginBottom: 8 }}>
        <Link href="/portfolios">← All portfolios</Link>
      </p>
      <h1>Portfolio #{portfolio.id}: {portfolio.name}</h1>

      <div className="panel">
        <div className="summary-grid">
          <Stat label="Timeframe" value={portfolio.timeframe} />
          <Stat
            label="Period"
            value={`${iso(portfolio.startT)} → ${iso(portfolio.endT)}`}
          />
          <Stat
            label="Starting equity"
            value={`$${portfolio.startingEquity.toLocaleString()}`}
          />
          <Stat
            label="Ending equity"
            value={`$${portfolio.endingEquity.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
            tone={portfolio.endingEquity >= portfolio.startingEquity ? 'pos' : 'neg'}
          />
          <Stat
            label="Total return"
            value={fmtPct(portfolio.totalReturnPct)}
            tone={portfolio.totalReturnPct >= 0 ? 'pos' : 'neg'}
          />
          <Stat
            label="Max drawdown"
            value={`${portfolio.maxDrawdownPct.toFixed(2)}%`}
          />
          <Stat
            label="Sharpe"
            value={portfolio.sharpe !== null ? portfolio.sharpe.toFixed(2) : '—'}
          />
          <Stat
            label="Rebalance"
            value={
              portfolio.rebalanceIntervalDays
                ? `every ${portfolio.rebalanceIntervalDays} days`
                : 'none (sleeves compound independently)'
            }
          />
        </div>
      </div>

      <PortfolioChart
        curve={portfolio.equityCurve}
        startingEquity={portfolio.startingEquity}
        rebalanceIntervalMs={
          portfolio.rebalanceIntervalDays
            ? portfolio.rebalanceIntervalDays * DAY_MS
            : null
        }
      />

      <div className="panel">
        <h2>Sleeves</h2>
        {portfolio.sleeves.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No sleeve data recorded.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Strategy</th>
                <th className="num">Alloc</th>
                <th className="num">Start $</th>
                <th className="num">End $</th>
                <th className="num">Return</th>
                <th className="num">Trades</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.sleeves.map(s => (
                <tr key={`${s.symbol}-${s.strategy}`}>
                  <td className="mono">{s.symbol}</td>
                  <td>{s.strategy}</td>
                  <td className="num muted">{s.allocation}%</td>
                  <td className="num muted">
                    ${s.startingCash.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td className={s.endingEquity >= s.startingCash ? 'num pos' : 'num neg'}>
                    ${s.endingEquity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td className={s.returnPct >= 0 ? 'num pos' : 'num neg'}>
                    {s.returnPct >= 0 ? '+' : ''}{s.returnPct.toFixed(2)}%
                  </td>
                  <td className="num muted">{s.tradeCount}</td>
                  <td className="mono muted" style={{ fontSize: 11 }}>
                    {s.warnings && s.warnings.length > 0
                      ? s.warnings.join('; ')
                      : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Stat({
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

function fmtPct(v: number): string {
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
}
