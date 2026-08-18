'use client';

/* Apex Trader — mobile live view.

   What the bot is doing, right now, on a phone. Built for what actually runs:
   ONE grid, ONE symbol, ONE account. The prototype's Home screen is a
   multi-asset consumer portfolio — coin list, AI insights, Deposit — and none
   of that has anything behind it here, so this is composed from the same
   design system rather than ported from that screen.

   The ladder is the centrepiece because it is the one picture that answers
   "why is nothing happening": you can see spot sitting in a gap between the
   resting bid and the exit, which no stat tile conveys.

   Colour note, inherited from app/live/page.js: green and red separate by only
   ΔE 7.2 under deuteranopia, so nothing here relies on colour alone. Every
   signed number carries an explicit + or −, and every state carries a word. */

import { Icon, Badge, PriceChange } from '../../components/ds/index.js';
import { MetricRow, Panel, SubHead } from '../../components/ui/primitives.js';
import {
  useBotState,
  deriveStatus,
  money,
  signed,
  toneFor,
  POLL_MS,
} from '../../components/use-bot-state.js';

/** Alpaca reports crypto to 9dp; anything tighter than this is fee dust. */
const QTY_DP = 8;

function ago(iso) {
  if (!iso) return '';
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${Math.floor(secs)}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

/* ---- banners ----------------------------------------------------------- */

/**
 * States that must never be quiet.
 *
 * A halt needs a human, so it outranks everything. Rejections come next: a
 * grid refusing every order submits zero, which is indistinguishable from a
 * converged one unless it is said out loud. Idle-while-holding is third — it
 * is legitimate and self-healing, but it has lasted 58 unbroken days in
 * backtest, so it cannot render as silence either.
 */
function Banner({ tone, icon, title, body }) {
  const bg = { down: 'var(--down-soft)', warning: 'var(--warning-soft)', info: 'var(--info-soft)' }[tone];
  const fg = { down: 'var(--down-500)', warning: 'var(--warning-500)', info: 'var(--info-500)' }[tone];

  return (
    <div
      role="status"
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        margin: '0 16px 10px',
        padding: '11px 13px',
        background: bg,
        border: `1px solid ${fg}`,
        borderRadius: 'var(--radius-md)',
      }}
    >
      <span style={{ color: fg, flex: 'none', marginTop: 1 }}>
        <Icon name={icon} size={16} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ font: '600 13px var(--font-sans)', color: 'var(--text-900)' }}>{title}</div>
        {body && (
          <div style={{ font: '12px var(--font-sans)', color: 'var(--text-500)', marginTop: 2, lineHeight: 1.45 }}>
            {body}
          </div>
        )}
      </div>
    </div>
  );
}

function Alerts({ s, error }) {
  const out = [];

  if (error) {
    out.push(<Banner key="err" tone="down" icon="alert-triangle" title="Bot offline" body={error} />);
  }

  if (s?.status?.halted) {
    out.push(
      <Banner
        key="halt"
        tone="down"
        icon="lock"
        title={`Halted — ${s.status.halted.replace(/_/g, ' ')}`}
        body="Resting orders were cancelled and the position kept. The latch survives a restart — clear it with `npm run bot:resume`."
      />,
    );
  }

  if (s?.rejections?.length) {
    const reasons = [...new Set(s.rejections.map((r) => r.reason))];
    out.push(
      <Banner
        key="rej"
        tone="warning"
        icon="alert-triangle"
        title={`${s.rejections.length} order${s.rejections.length > 1 ? 's' : ''} rejected`}
        body={`${reasons[0]}${s.status ? ` · stall ${s.status.stalls}/${s.status.stallLimit}` : ''}`}
      />,
    );
  }

  if (s?.status?.idleHolding) {
    out.push(
      <Banner
        key="idle"
        tone={s.status.idleAlerting ? 'warning' : 'info'}
        icon="clock"
        title={`Idle while holding — ${ago(s.status.idleSince).replace(' ago', '')}`}
        body="Price is outside the band and inventory is open, so the band is frozen until that position closes. This recovers on its own when price re-enters."
      />,
    );
  }

  if (s?.status?.dryRun) {
    out.push(
      <Banner
        key="dry"
        tone="info"
        icon="eye"
        title="Dry run — nothing is being submitted"
        body="The book below is planned, not resting. Set DRY_RUN=false to trade."
      />,
    );
  }

  return out;
}

/* ---- the ladder -------------------------------------------------------- */

/**
 * Grid levels, high to low, with spot interleaved at its true position.
 *
 * `ladder` gives every level and whether it holds inventory; `book` gives what
 * should be resting at each. They are separate on purpose — a level can hold
 * inventory (no order) or carry an exit for a level below it, and merging them
 * upstream would lose that distinction.
 */
function Ladder({ s }) {
  const levels = s?.ladder ?? [];
  const price = s?.market?.price;

  if (!levels.length) {
    return (
      <Panel style={{ margin: '0 16px', padding: 16 }}>
        <div style={{ font: '13px var(--font-sans)', color: 'var(--text-500)' }}>
          No grid yet — the engine builds it on the first tick.
        </div>
      </Panel>
    );
  }

  const orderAt = new Map((s?.book ?? []).map((o) => [o.levelIndex, o]));
  const desc = [...levels].sort((a, b) => b.price - a.price);

  // Where does spot belong? Above every level and below every level are both
  // real states — that is exactly what "out of band" looks like.
  const rows = [];
  let placed = false;
  for (const lvl of desc) {
    if (!placed && Number.isFinite(price) && price >= lvl.price) {
      rows.push({ kind: 'spot' });
      placed = true;
    }
    rows.push({ kind: 'level', lvl });
  }
  if (!placed && Number.isFinite(price)) rows.push({ kind: 'spot' });

  return (
    <Panel style={{ margin: '0 16px', overflow: 'hidden' }}>
      {rows.map((row, i) => {
        if (row.kind === 'spot') {
          return (
            <div
              key="spot"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 14px',
                background: 'var(--brand-surface)',
                borderTop: i ? '1px solid var(--brand-border)' : 'none',
                borderBottom: '1px solid var(--brand-border)',
              }}
            >
              <span
                className="apex-pulse"
                style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand)', flex: 'none' }}
              />
              <span
                style={{
                  font: '600 10px var(--font-sans)',
                  letterSpacing: '.1em',
                  textTransform: 'uppercase',
                  color: 'var(--brand-text)',
                }}
              >
                Spot
              </span>
              <span
                className="apex-num"
                style={{ marginLeft: 'auto', font: '600 14px var(--font-mono)', color: 'var(--brand-text)' }}
              >
                ${money(price)}
              </span>
            </div>
          );
        }

        const { lvl } = row;
        const order = orderAt.get(lvl.index);
        const distPct = Number.isFinite(price) && price > 0 ? (lvl.price / price - 1) * 100 : null;

        return (
          <div
            key={`L${lvl.index}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              borderTop: i ? '1px solid var(--border-soft)' : 'none',
            }}
          >
            <span
              style={{
                font: '11px var(--font-mono)',
                color: 'var(--text-400)',
                width: 22,
                flex: 'none',
              }}
            >
              L{lvl.index}
            </span>

            <span className="apex-num" style={{ font: '14px var(--font-mono)', color: 'var(--text-900)' }}>
              ${money(lvl.price)}
            </span>

            {distPct !== null && (
              <span style={{ font: '11px var(--font-mono)', color: 'var(--text-400)' }}>
                {distPct >= 0 ? '+' : '−'}
                {Math.abs(distPct).toFixed(2)}%
              </span>
            )}

            <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
              {lvl.held && <Badge tone="brand">held</Badge>}
              {order && (
                <Badge tone={order.side === 'buy' ? 'up' : 'down'} dot>
                  {order.side}
                </Badge>
              )}
            </span>
          </div>
        );
      })}
    </Panel>
  );
}

/* ---- fills ------------------------------------------------------------- */

function Fills({ s }) {
  const fills = s?.fills ?? [];

  if (!fills.length) {
    return (
      <Panel style={{ margin: '0 16px', padding: 16 }}>
        <div style={{ font: '13px var(--font-sans)', color: 'var(--text-500)' }}>
          Nothing has filled yet.
        </div>
      </Panel>
    );
  }

  return (
    <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {fills.slice(0, 12).map((f, i) => (
        <div
          key={`${f.at ?? i}-${f.levelIndex}-${f.side}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '9px 12px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-soft)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: 7,
              flex: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: f.side === 'buy' ? 'var(--up-soft)' : 'var(--down-soft)',
              color: f.side === 'buy' ? 'var(--up-500)' : 'var(--down-500)',
            }}
          >
            <Icon name={f.side === 'buy' ? 'arrow-down-right' : 'arrow-up-right'} size={14} />
          </span>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ font: '13px var(--font-sans)', color: 'var(--text-900)' }}>
              {f.side === 'buy' ? 'Bought' : 'Sold'}{' '}
              <span className="apex-num" style={{ fontFamily: 'var(--font-mono)' }}>
                {Number(f.qty).toFixed(QTY_DP)}
              </span>
            </div>
            <div style={{ font: '11px var(--font-sans)', color: 'var(--text-400)' }}>
              L{f.levelIndex}
              {f.closedLevel !== undefined && ` · closed L${f.closedLevel}`}
              {f.at && ` · ${ago(f.at)}`}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div className="apex-num" style={{ font: '12px var(--font-mono)', color: 'var(--text-700)' }}>
              ${money(f.price)}
            </div>
            {f.realizedPnl !== undefined && (
              <div
                className="apex-num"
                style={{ font: '11px var(--font-mono)', color: toneFor(f.realizedPnl) }}
              >
                {signed(f.realizedPnl)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---- screen ------------------------------------------------------------ */

export default function MobileLive() {
  const { snapshot: s, error, waitedMs } = useBotState();
  const status = deriveStatus({ snapshot: s, error, waitedMs });

  const equity = s?.account?.equity;
  const daily = s?.account?.dailyPnl ?? 0;
  // Percent against the session OPEN, which is equity minus today's move —
  // not against equity itself, or a $5 gain on a $100 account reads as 5.0%
  // when it is really 5.26%.
  const openEquity = Number.isFinite(equity) ? equity - daily : null;
  const dailyPct = openEquity ? (daily / openEquity) * 100 : 0;

  const lossLimit = s?.account?.lossLimit ?? 0;
  const lossUsedPct = lossLimit ? Math.min(100, Math.max(0, (daily / lossLimit) * 100)) : 0;
  const ddLimit = s?.account?.drawdownLimit;
  const drawdown = s?.account?.drawdown ?? 0;

  return (
    <div style={{ paddingBottom: 12 }}>
      {/* top bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 16px 10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {/* public/logo-mark.svg, NOT the copy under public/prototype/ — the
              real app must not depend on the prototype directory surviving. */}
          <img src="/logo-mark.svg" width="26" height="26" alt="" />
          <span
            style={{
              font: '700 16px var(--font-sans)',
              color: 'var(--text-900)',
              letterSpacing: '-0.02em',
            }}
          >
            Apex
          </span>
        </div>

        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            className={status.ok ? 'apex-pulse' : undefined}
            style={{ width: 7, height: 7, borderRadius: '50%', background: status.tone, flex: 'none' }}
          />
          <span style={{ font: '12px var(--font-sans)', color: status.tone }}>{status.word}</span>
        </span>
      </div>

      <Alerts s={s} error={error} />

      {/* equity hero */}
      <div style={{ padding: '0 16px' }}>
        <div
          style={{
            border: '1px solid var(--brand-border)',
            background: 'linear-gradient(168deg, var(--violet-soft), transparent 58%), var(--bg-surface)',
            borderRadius: 'var(--radius-xl)',
            padding: 18,
            boxShadow: 'var(--glow-brand-soft)',
          }}
        >
          <div
            style={{
              font: '11px var(--font-sans)',
              fontWeight: 600,
              letterSpacing: '.1em',
              textTransform: 'uppercase',
              color: 'var(--text-400)',
            }}
          >
            Total equity
          </div>

          <div
            className="apex-num"
            style={{
              font: '700 32px var(--font-mono)',
              color: 'var(--text-900)',
              letterSpacing: '-0.02em',
              marginTop: 6,
            }}
          >
            {Number.isFinite(equity) ? `$${money(equity)}` : '—'}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <PriceChange value={+dailyPct.toFixed(2)} percent pill size="sm" />
            <span className="apex-num" style={{ font: '12px var(--font-mono)', color: toneFor(daily) }}>
              {signed(daily)} today
            </span>
          </div>

          {/* capital split — where the equity actually is */}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            {[
              ['cash', 'cash', s?.account?.cash],
              ['pending', 'resting bids', s?.account?.pendingValue],
              ['held', 'in BTC', s?.account?.heldValue],
            ].map(([key, hint, value]) => (
              <div key={key} style={{ flex: 1, minWidth: 0 }}>
                <div className="apex-num" style={{ font: '14px var(--font-mono)', color: 'var(--text-900)' }}>
                  ${money(value ?? 0)}
                </div>
                <div style={{ font: '10px var(--font-sans)', color: 'var(--text-400)', marginTop: 2 }}>
                  {hint}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* the grid */}
      <SubHead
        action={
          s?.grid ? (
            <span style={{ font: '12px var(--font-mono)', color: 'var(--text-500)' }}>
              {s.grid.levels} levels · {s.grid.anchorMode}
            </span>
          ) : null
        }
      >
        {s?.status?.symbol ?? 'Grid'}
      </SubHead>

      <Ladder s={s} />

      {s?.grid && (
        <div
          style={{
            padding: '8px 16px 0',
            font: '11px var(--font-sans)',
            color: 'var(--text-400)',
            lineHeight: 1.5,
          }}
        >
          Band ${money(s.grid.lowerBound)} – ${money(s.grid.upperBound)}
          {s.grid.stopPrice ? ` · price stop $${money(s.grid.stopPrice)}` : ' · no price stop'}
          {s?.market?.idle ? ' · OUT OF BAND, idling' : ''}
        </div>
      )}

      {/* position */}
      <SubHead>Position</SubHead>
      <Panel style={{ margin: '0 16px', padding: '2px 14px 12px' }}>
        <MetricRow
          label="Inventory"
          value={`${Number(s?.position?.inventory ?? 0).toFixed(QTY_DP)}`}
          hint={s?.position?.heldLevels?.length ? `${s.position.heldLevels.length} level(s) holding` : 'flat'}
        />
        <MetricRow
          label="Unrealized"
          value={signed(s?.position?.unrealizedPnl ?? 0)}
          color={toneFor(s?.position?.unrealizedPnl ?? 0)}
          hint="marked at the last tick's price"
        />
        <MetricRow
          label="Realized"
          value={signed(s?.position?.realizedPnl ?? 0)}
          color={toneFor(s?.position?.realizedPnl ?? 0)}
          hint="net of fees"
        />
        <MetricRow label="Round trips" value={s?.position?.roundTrips ?? 0} />
        <MetricRow
          label="Fees paid"
          value={`$${money(s?.position?.feesPaidQuote ?? 0)}`}
          hint={`+ ${Number(s?.position?.feesPaidBase ?? 0).toFixed(QTY_DP)} BTC taken from delivery`}
        />
      </Panel>

      {/* risk */}
      <SubHead>Risk</SubHead>
      <Panel style={{ margin: '0 16px', padding: '2px 14px 12px' }}>
        <MetricRow
          label="Daily loss limit"
          value={`${signed(daily)} / ${signed(lossLimit)}`}
          color={toneFor(daily)}
          hint={`${lossUsedPct.toFixed(0)}% used — halts at 100%`}
        />
        <MetricRow
          label="Drawdown"
          value={ddLimit ? `${(drawdown * 100).toFixed(2)}% / ${(ddLimit * 100).toFixed(0)}%` : 'stop disabled'}
          color={ddLimit && drawdown >= ddLimit * 0.75 ? 'var(--warning-500)' : undefined}
          hint={
            s?.account?.peakEquity ? `peak $${money(s.account.peakEquity)}` : 'against the equity high-water mark'
          }
        />
      </Panel>

      {/* fills */}
      <SubHead>Recent fills</SubHead>
      <Fills s={s} />

      <div
        style={{
          padding: '18px 16px 4px',
          font: '11px var(--font-mono)',
          color: 'var(--text-300)',
          textAlign: 'center',
        }}
      >
        {s?.status
          ? `tick ${s.status.ticks} · ${s.status.mode} · polling ${POLL_MS / 1000}s`
          : `polling ${POLL_MS / 1000}s`}
      </div>
    </div>
  );
}
