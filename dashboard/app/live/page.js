'use client';

/* Live bot monitor.

   Reads the bot's in-memory snapshot through the server-side proxy every 2s.

   Colour note: green/red separate by only ΔE 7.2 under deuteranopia, so no
   figure here relies on colour alone — every signed value carries an explicit
   + or − and every state carries a word. Colour is reinforcement, not the
   channel. Stat tiles are hero numbers rather than charts: the job is "what
   is it right now", which a number answers better than a plot. */

import { useState } from 'react';
import {
  useBotState,
  deriveStatus,
  money,
  signed,
  toneFor,
  POLL_MS,
} from '../components/use-bot-state.js';

function Tile({ label, value, sub, tone, footer }) {
  return (
    <div
      style={{
        padding: '14px 16px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        background: 'var(--bg-surface)',
        boxShadow: 'var(--inset-top)',
        minWidth: 0,
      }}
    >
      <div
        style={{
          font: '11px var(--font-sans)',
          fontWeight: 600,
          letterSpacing: 'var(--tracking-caps)',
          textTransform: 'uppercase',
          color: 'var(--text-400)',
        }}
      >
        {label}
      </div>
      <div
        className="apex-num"
        style={{
          font: '600 24px var(--font-mono)',
          color: tone ?? 'var(--text-900)',
          marginTop: 6,
          letterSpacing: '-0.02em',
          overflowWrap: 'anywhere',
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ font: '12px var(--font-sans)', color: 'var(--text-500)', marginTop: 4 }}>{sub}</div>
      )}
      {footer}
    </div>
  );
}

const CAPITAL = [
  { key: 'cash', label: 'cash', hint: 'spendable now', color: 'var(--violet-200)' },
  { key: 'pendingValue', label: 'pending', hint: 'reserved by resting buys', color: 'var(--violet-400)' },
  { key: 'heldValue', label: 'held', hint: 'BTC you own', color: 'var(--violet-600)' },
];

/** What each slice is actually made of, for the hover detail. */
function capitalDetail(key, snapshot) {
  const price = snapshot?.market?.price ?? 0;

  if (key === 'pendingValue') {
    const buys = (snapshot?.book ?? []).filter((o) => o.side === 'buy');
    if (!buys.length) return { rows: [], note: 'No buy orders resting.' };
    return {
      note: `${buys.length} resting bid${buys.length > 1 ? 's' : ''} — cash is held until each fills or is cancelled.`,
      rows: buys
        .sort((a, b) => b.price - a.price)
        .map((o) => ({
          left: `L${o.levelIndex}`,
          mid: `$${money(o.price)}`,
          right: `$${money(o.qty * o.price)}`,
          note: `${(((o.price / price) - 1) * 100).toFixed(2)}% from spot`,
        })),
    };
  }

  if (key === 'heldValue') {
    const lots = snapshot?.position?.heldLevels ?? [];
    if (!lots.length) return { rows: [], note: 'Holding nothing — all capital is in cash.' };
    return {
      note: `${lots.length} lot${lots.length > 1 ? 's' : ''} — each exits one level above its entry.`,
      rows: lots
        .sort((a, b) => b.price - a.price)
        .map((h) => {
          const now = h.qty * price;
          const cost = h.qty * h.price;
          return {
            left: `L${h.levelIndex}`,
            mid: `entry $${money(h.price)}`,
            right: `$${money(now)}`,
            note: `${now >= cost ? '+' : '−'}$${money(Math.abs(now - cost), 4)} unrealised`,
          };
        }),
    };
  }

  return { rows: [], note: 'Uncommitted. This is what the next buy order can draw on.' };
}

/**
 * Equity is NOT cash + holdings. Alpaca reports `cash` net of order
 * reservations while equity includes them, so the two never reconcile on
 * their own — which is exactly the question this answers.
 *
 * Sequential ramp, not categorical: the three parts are ORDERED by how
 * committed the capital is, so lightness carries the meaning and colour-vision
 * deficiency cannot scramble it. Every segment is labelled with its own value,
 * so colour is reinforcement only.
 */
function CapitalSplit({ snapshot }) {
  const account = snapshot?.account;
  const [active, setActive] = useState(null);
  if (!account) return null;

  const total = CAPITAL.reduce((sum, p) => sum + Number(account[p.key] ?? 0), 0);
  if (!(total > 0)) return null;

  const shown = CAPITAL.find((p) => p.key === active);
  const detail = shown ? capitalDetail(shown.key, snapshot) : null;

  // Hover AND focus, so the detail is reachable without a mouse.
  const bind = (key) => ({
    tabIndex: 0,
    onMouseEnter: () => setActive(key),
    onMouseLeave: () => setActive((k) => (k === key ? null : k)),
    onFocus: () => setActive(key),
    onBlur: () => setActive((k) => (k === key ? null : k)),
  });

  return (
    <div style={{ marginTop: 10, position: 'relative' }}>
      <div
        role="img"
        aria-label={CAPITAL.map((p) => `${p.label} $${money(account[p.key] ?? 0)}`).join(', ')}
        style={{ display: 'flex', gap: 2, height: 6, marginBottom: 8 }}
      >
        {CAPITAL.map((p) => {
          const v = Number(account[p.key] ?? 0);
          if (v <= 0) return null;
          return (
            <div
              key={p.key}
              {...bind(p.key)}
              aria-label={`${p.label} $${money(v)}`}
              style={{
                width: `${(v / total) * 100}%`,
                background: p.color,
                borderRadius: 'var(--radius-pill)',
                cursor: 'help',
                // The bar is 6px; pad the hit target out to a usable size.
                boxShadow: active === p.key ? '0 0 0 2px var(--brand-border)' : 'none',
              }}
            />
          );
        })}
      </div>

      <dl style={{ margin: 0, display: 'grid', gap: 3 }}>
        {CAPITAL.map((p) => (
          <div
            key={p.key}
            {...bind(p.key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              cursor: 'help',
              borderRadius: 4,
              padding: '1px 3px',
              margin: '0 -3px',
              background: active === p.key ? 'var(--bg-raised)' : 'transparent',
            }}
          >
            <span
              aria-hidden="true"
              style={{ width: 8, height: 8, flex: 'none', borderRadius: 2, background: p.color }}
            />
            <dt style={{ font: '12px var(--font-sans)', color: 'var(--text-500)' }}>{p.label}</dt>
            <dd
              className="apex-num"
              style={{ margin: '0 0 0 auto', font: '12px var(--font-mono)', color: 'var(--text-700)' }}
            >
              ${money(account[p.key] ?? 0)}
            </dd>
          </div>
        ))}
      </dl>

      {shown && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 8,
            zIndex: 20,
            minWidth: 260,
            padding: '10px 12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-strong)',
            background: 'var(--bg-elevated)',
            boxShadow: 'var(--shadow-pop)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
            <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 2, background: shown.color }} />
            <span style={{ font: '600 12px var(--font-sans)', color: 'var(--text-900)' }}>
              {shown.label} · ${money(account[shown.key] ?? 0)}
            </span>
          </div>
          <div style={{ font: '11px var(--font-sans)', color: 'var(--text-500)', marginBottom: detail.rows.length ? 8 : 0 }}>
            {detail.note}
          </div>
          {detail.rows.map((r) => (
            <div
              key={r.left + r.mid}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
                font: '12px var(--font-mono)',
                color: 'var(--text-700)',
                padding: '3px 0',
                borderTop: '1px solid var(--border-soft)',
              }}
            >
              <span style={{ color: 'var(--text-400)', minWidth: 22 }}>{r.left}</span>
              <span>{r.mid}</span>
              <span style={{ marginLeft: 'auto' }}>{r.right}</span>
            </div>
          ))}
          {detail.rows.length > 0 && (
            <div style={{ font: '11px var(--font-sans)', color: 'var(--text-400)', marginTop: 6 }}>
              {detail.rows.map((r) => r.note).join(' · ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The bot's state in one pill.
 *
 * The ladder that decides what to say lives in components/use-bot-state.js so
 * this page and the mobile one cannot disagree about what "running" means.
 * This renders the fuller `word — detail` form; the mobile chip shows `word`.
 */
function StatusPill({ snapshot, error, waitedMs }) {
  const { word, detail, tone } = deriveStatus({ snapshot, error, waitedMs });

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        borderRadius: 'var(--radius-pill)',
        border: `1px solid ${tone}`,
        background: 'var(--bg-raised)',
        font: '600 12px var(--font-sans)',
        color: tone,
      }}
    >
      <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: tone }} />
      {detail ? `${word} — ${detail}` : word}
    </span>
  );
}

function Ladder({ snapshot }) {
  const ladder = snapshot?.ladder ?? [];
  const book = snapshot?.book ?? [];
  const price = snapshot?.market?.price;
  if (!ladder.length) return null;

  const byLevel = new Map(book.map((o) => [o.levelIndex, o]));
  const rows = [...ladder].reverse();

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', font: '13px var(--font-mono)', minWidth: 420 }}>
        <caption
          style={{
            captionSide: 'top',
            textAlign: 'left',
            font: '600 15px var(--font-sans)',
            color: 'var(--text-900)',
            paddingBottom: 10,
          }}
        >
          Grid ladder
        </caption>
        <thead>
          <tr style={{ font: '11px var(--font-sans)', color: 'var(--text-400)', textAlign: 'left' }}>
            <th style={{ padding: '6px 8px', fontWeight: 600 }}>Lvl</th>
            <th style={{ padding: '6px 8px', fontWeight: 600 }}>Price</th>
            <th style={{ padding: '6px 8px', fontWeight: 600 }}>Resting</th>
            <th style={{ padding: '6px 8px', fontWeight: 600 }}>Size</th>
            <th style={{ padding: '6px 8px', fontWeight: 600 }}>Held</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((lvl) => {
            const order = byLevel.get(lvl.index);
            // `a - b ?? 0` parses as `(a - b) ?? 0`, and ?? does not catch NaN,
            // so a single-row ladder made this NaN and nothing ever highlighted.
            const gap = rows.length > 1 ? Math.abs(rows[0].price - rows[1].price) : Infinity;
            const isNearPrice = price != null && Math.abs(lvl.price - price) < gap / 2;
            return (
              <tr
                key={lvl.index}
                style={{
                  borderTop: '1px solid var(--border-soft)',
                  background: isNearPrice ? 'var(--brand-surface)' : 'transparent',
                }}
              >
                <td style={{ padding: '6px 8px', color: 'var(--text-400)' }}>{lvl.index}</td>
                <td style={{ padding: '6px 8px', color: 'var(--text-900)' }}>${money(lvl.price)}</td>
                <td style={{ padding: '6px 8px', color: order ? 'var(--text-700)' : 'var(--text-300)' }}>
                  {order ? order.side.toUpperCase() : '—'}
                </td>
                <td style={{ padding: '6px 8px', color: 'var(--text-500)' }}>{order ? order.qty : '—'}</td>
                <td style={{ padding: '6px 8px', color: lvl.held ? 'var(--brand-text)' : 'var(--text-300)' }}>
                  {lvl.held ? 'yes' : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Fills({ snapshot }) {
  const fills = snapshot?.fills ?? [];

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', font: '13px var(--font-mono)', minWidth: 420 }}>
        <caption
          style={{
            captionSide: 'top',
            textAlign: 'left',
            font: '600 15px var(--font-sans)',
            color: 'var(--text-900)',
            paddingBottom: 10,
          }}
        >
          Recent fills
        </caption>
        <thead>
          <tr style={{ font: '11px var(--font-sans)', color: 'var(--text-400)', textAlign: 'left' }}>
            <th style={{ padding: '6px 8px', fontWeight: 600 }}>Lvl</th>
            <th style={{ padding: '6px 8px', fontWeight: 600 }}>Side</th>
            <th style={{ padding: '6px 8px', fontWeight: 600 }}>Qty</th>
            <th style={{ padding: '6px 8px', fontWeight: 600 }}>Price</th>
            <th style={{ padding: '6px 8px', fontWeight: 600 }}>Realized</th>
          </tr>
        </thead>
        <tbody>
          {fills.length === 0 && (
            <tr>
              <td colSpan={5} style={{ padding: '14px 8px', color: 'var(--text-400)', font: '13px var(--font-sans)' }}>
                No fills yet.
              </td>
            </tr>
          )}
          {fills.map((f, i) => (
            <tr key={`${f.levelIndex}-${f.at ?? i}`} style={{ borderTop: '1px solid var(--border-soft)' }}>
              <td style={{ padding: '6px 8px', color: 'var(--text-400)' }}>{f.levelIndex}</td>
              <td style={{ padding: '6px 8px', color: 'var(--text-700)' }}>{f.side.toUpperCase()}</td>
              <td style={{ padding: '6px 8px', color: 'var(--text-500)' }}>{f.qty}</td>
              <td style={{ padding: '6px 8px', color: 'var(--text-900)' }}>${money(f.price)}</td>
              <td style={{ padding: '6px 8px', color: f.realizedPnl != null ? toneFor(f.realizedPnl) : 'var(--text-300)' }}>
                {f.realizedPnl != null ? signed(f.realizedPnl) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Live() {
  const { snapshot, error, waitedMs } = useBotState();

  const s = snapshot;
  const daily = s?.account?.dailyPnl ?? 0;
  const limit = s?.account?.lossLimit ?? 0;
  const usedPct = limit ? Math.min(100, Math.max(0, (daily / limit) * 100)) : 0;

  return (
    <main style={{ minHeight: '100vh', padding: '28px 20px 64px' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
            marginBottom: 22,
          }}
        >
          <div>
            <div
              style={{
                font: '11px var(--font-sans)',
                fontWeight: 600,
                letterSpacing: 'var(--tracking-caps)',
                textTransform: 'uppercase',
                color: 'var(--text-400)',
              }}
            >
              Apex Trader · {s?.status?.symbol ?? '—'}
            </div>
            <h1 style={{ font: '700 30px var(--font-sans)', letterSpacing: '-0.03em', marginTop: 4 }}>Live</h1>
          </div>
          <StatusPill snapshot={s} error={error} waitedMs={waitedMs} />
        </header>

        {error && (
          <div
            role="status"
            style={{
              padding: '12px 14px',
              marginBottom: 20,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--down-500)',
              background: 'var(--down-soft)',
              font: '13px var(--font-sans)',
              color: 'var(--text-900)',
            }}
          >
            <strong>{error}</strong>
            <div style={{ font: '12px var(--font-sans)', color: 'var(--text-500)', marginTop: 6 }}>
              The dashboard proxies to <code style={{ fontFamily: 'var(--font-mono)' }}>BOT_API_URL</code> and
              attaches <code style={{ fontFamily: 'var(--font-mono)' }}>BOT_API_TOKEN</code>, both server-side.
              On Vercel, adding env vars does not affect the running deployment — you must redeploy.
            </div>
          </div>
        )}

        {/* Rejections sit above everything — they are the loudest failure the
            bot can have while still appearing to run normally. */}
        {s?.rejections?.length > 0 && (
          <div
            role="alert"
            style={{
              padding: '14px 16px',
              marginBottom: 20,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--warning-500)',
              background: 'var(--warning-soft)',
            }}
          >
            <div style={{ font: '600 13px var(--font-sans)', color: 'var(--text-900)' }}>
              ⚠ The exchange rejected {s.rejections.length} order(s) — the grid is not resting what it intends to.
            </div>
            <div style={{ font: '12px var(--font-sans)', color: 'var(--text-500)', marginTop: 4 }}>
              Stall {s.status.stalls}/{s.status.stallLimit} — the loop halts at {s.status.stallLimit} consecutive.
            </div>
            <ul style={{ margin: '10px 0 0', paddingLeft: 18, font: '12px var(--font-mono)', color: 'var(--text-700)' }}>
              {[...new Set(s.rejections.map((r) => r.reason))].map((reason) => (
                <li key={reason} style={{ marginBottom: 2 }}>{reason}</li>
              ))}
            </ul>
          </div>
        )}

        {s?.status?.lastError && (
          <div
            role="status"
            style={{
              padding: '10px 14px', marginBottom: 16,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--warning-500)', background: 'var(--warning-soft)',
              font: '12px var(--font-mono)', color: 'var(--text-900)',
            }}
          >
            last tick error: {s.status.lastError.message}
          </div>
        )}

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            marginBottom: 14,
          }}
        >
          <Tile label={`${s?.status?.symbol ?? 'Price'}`} value={s?.market?.price ? `$${money(s.market.price)}` : '—'} sub={s?.market?.idle ? 'out of band — idling' : 'in band'} />
          <Tile
            label="Equity"
            value={s?.account ? `$${money(s.account.equity)}` : '—'}
            footer={<CapitalSplit snapshot={s} />}
          />
          <Tile
            label="Realized P&L"
            value={s?.position ? signed(s.position.realizedPnl) : '—'}
            sub={s?.position ? `${s.position.roundTrips} trip(s) · net of fees` : null}
            tone={toneFor(s?.position?.realizedPnl)}
          />
          <Tile
            label="Day P&L"
            value={s?.account ? signed(daily) : '—'}
            sub={s?.account ? `limit ${signed(limit)}` : null}
            tone={toneFor(daily)}
          />
        </section>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            marginBottom: 26,
          }}
        >
          <Tile
            label="Unrealized P&L"
            value={s?.position ? signed(s.position.unrealizedPnl ?? 0) : '—'}
            sub={s?.position ? `${s.position.inventory} held · ${s.position.heldLevels.length} level(s)` : null}
            tone={toneFor(s?.position?.unrealizedPnl)}
          />
          <Tile
            label="Fees paid"
            value={s?.position ? `$${money(s.position.feesPaidQuote ?? 0, 4)}` : '—'}
            sub={s?.position ? `+ ${(s.position.feesPaidBase ?? 0).toFixed(9)} base` : null}
          />
          <Tile label="Order size" value={s?.grid ? s.grid.orderSize.toFixed(8) : '—'} sub={s?.grid ? `${s.grid.levels} levels · ${s.grid.spacing}` : null} />
          <Tile label="Band" value={s?.grid ? `$${money(s.grid.lowerBound, 0)} – $${money(s.grid.upperBound, 0)}` : '—'} sub={s?.grid ? `anchor ${s.grid.anchorMode}` : null} />
          <Tile label="Stop price" value={s?.grid?.stopPrice ? `$${money(s.grid.stopPrice)}` : 'not set'} sub={s?.grid?.stopPrice ? 'liquidates held inventory' : 'inventory held indefinitely'} />
        </section>

        {/* Daily loss budget — a meter, because the job is "how much room is left". */}
        {s?.account && (
          <section style={{ marginBottom: 26 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', font: '12px var(--font-sans)', color: 'var(--text-500)', marginBottom: 6 }}>
              <span>Daily loss budget used</span>
              <span className="apex-num">{usedPct.toFixed(0)}% of {signed(limit)}</span>
            </div>
            <div style={{ height: 8, borderRadius: 'var(--radius-pill)', background: 'var(--bg-inset)', border: '1px solid var(--border-soft)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${usedPct}%`,
                  height: '100%',
                  background: usedPct > 75 ? 'var(--down-500)' : usedPct > 40 ? 'var(--warning-500)' : 'var(--up-500)',
                  borderRadius: 'var(--radius-pill)',
                  transition: 'width var(--dur-3) var(--ease-out)',
                }}
              />
            </div>
          </section>
        )}

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 26 }}>
          <Ladder snapshot={s} />
          <Fills snapshot={s} />
        </section>

        <footer style={{ marginTop: 32, font: '12px var(--font-sans)', color: 'var(--text-400)' }}>
          {s?.status ? (
            <>tick {s.status.ticks} · polling every {POLL_MS / 1000}s · uptime {Math.floor(s.status.uptimeMs / 1000)}s</>
          ) : (
            'waiting for the bot…'
          )}
        </footer>
      </div>
    </main>
  );
}
