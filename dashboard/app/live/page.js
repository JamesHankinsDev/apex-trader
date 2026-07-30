'use client';

/* Live bot monitor.

   Reads the bot's in-memory snapshot through the server-side proxy every 2s.

   Colour note: green/red separate by only ΔE 7.2 under deuteranopia, so no
   figure here relies on colour alone — every signed value carries an explicit
   + or − and every state carries a word. Colour is reinforcement, not the
   channel. Stat tiles are hero numbers rather than charts: the job is "what
   is it right now", which a number answers better than a plot. */

import { useEffect, useState, useCallback } from 'react';

const POLL_MS = 2000;

const money = (n, dp = 2) =>
  Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });

/** Always emits a sign, so direction survives without colour. */
const signed = (n, dp = 2) => `${Number(n) >= 0 ? '+' : '−'}$${money(Math.abs(Number(n ?? 0)), dp)}`;

const toneFor = (n) => (Number(n) > 0 ? 'var(--up-500)' : Number(n) < 0 ? 'var(--down-500)' : 'var(--text-500)');

function Tile({ label, value, sub, tone }) {
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
    </div>
  );
}

function StatusPill({ snapshot, error }) {
  let word = 'connecting';
  let tone = 'var(--text-400)';

  if (error) {
    word = 'bot offline';
    tone = 'var(--down-500)';
  } else if (snapshot?.status?.halted) {
    word = `halted — ${snapshot.status.halted.replace(/_/g, ' ')}`;
    tone = 'var(--down-500)';
  } else if (snapshot?.rejections?.length) {
    // A grid rejecting every order must never render as a healthy one.
    word = `${snapshot.rejections.length} order(s) rejected`;
    tone = 'var(--warning-500)';
  } else if (snapshot?.status?.running) {
    word = snapshot.status.dryRun ? 'running — dry run' : 'running — live orders';
    tone = snapshot.status.dryRun ? 'var(--info-500)' : 'var(--up-500)';
  }

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
      {word}
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
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/bot/state', { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      setSnapshot(body);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [poll]);

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
          <StatusPill snapshot={s} error={error} />
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
            {error} — start it with <code style={{ fontFamily: 'var(--font-mono)' }}>npm run bot:loop</code>
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

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            marginBottom: 14,
          }}
        >
          <Tile label={`${s?.status?.symbol ?? 'Price'}`} value={s?.market?.price ? `$${money(s.market.price)}` : '—'} sub={s?.market?.idle ? 'out of band — idling' : 'in band'} />
          <Tile label="Equity" value={s?.account ? `$${money(s.account.equity)}` : '—'} />
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
