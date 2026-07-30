/* Apex Trader — dashboard shell.

   The mobile prototype in app/components/ is NOT mounted here yet. Those files
   are browser-global IIFEs (they read `React` and
   `window.ApexTraderDesignSystem_cd55a5` off the window rather than importing
   anything), so Next.js cannot import them as modules. See README for the
   migration checklist. */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const STEPS = [
  { label: 'Monorepo + build config', done: true },
  { label: 'Grid level calculation', done: true },
  { label: 'Design system + prototype UI', done: true },
  { label: 'Alpaca client + credential check', done: false },
  { label: 'Order placement + fill tracking', done: false },
  { label: 'Dashboard API endpoints', done: false },
  { label: 'Port prototype to real data', done: false },
  { label: '6-month backtest harness', done: false },
];

export default function Home() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{ width: '100%', maxWidth: 520 }}>
        <div
          style={{
            font: '11px var(--font-sans)',
            fontWeight: 600,
            letterSpacing: '.12em',
            textTransform: 'uppercase',
            color: 'var(--text-400)',
          }}
        >
          Apex Trader 2.0
        </div>

        <h1
          style={{
            font: '700 32px var(--font-sans)',
            letterSpacing: '-0.03em',
            margin: '6px 0 8px',
            color: 'var(--text-900)',
          }}
        >
          Build status
        </h1>

        <p style={{ font: '14px var(--font-sans)', color: 'var(--text-500)', margin: '0 0 16px' }}>
          Bot API expected at <code style={{ fontFamily: 'var(--font-mono)' }}>{API_URL}</code>
        </p>

        <a
          href="/prototype"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 24,
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--brand-border)',
            background: 'var(--brand-surface)',
            font: '600 13px var(--font-sans)',
            color: 'var(--brand-text)',
          }}
        >
          Open the mobile prototype
          <span style={{ font: '11px var(--font-mono)', color: 'var(--text-400)' }}>mock data</span>
        </a>

        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
          {STEPS.map((s) => (
            <li
              key={s.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                background: 'var(--bg-surface)',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 8,
                  height: 8,
                  flex: 'none',
                  borderRadius: '50%',
                  background: s.done ? 'var(--up-500)' : 'var(--text-400)',
                }}
              />
              <span
                style={{
                  font: '14px var(--font-sans)',
                  color: s.done ? 'var(--text-700)' : 'var(--text-500)',
                }}
              >
                {s.label}
              </span>
              <span
                style={{
                  marginLeft: 'auto',
                  font: '11px var(--font-mono)',
                  color: s.done ? 'var(--up-500)' : 'var(--text-400)',
                }}
              >
                {s.done ? 'done' : 'todo'}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
