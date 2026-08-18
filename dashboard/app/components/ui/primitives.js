/* Apex Trader — shared UI primitives for the mobile app.

   Ported from public/prototype/app/ui.jsx. That file is JSX source (the
   prototype compiles it with Babel in the browser), so unlike the design
   system these come across as readable JSX rather than createElement calls.

   Only the primitives the live screen uses are here. CoinRow, CoinGlyph,
   BottomSheet and RiskBadge stay unported until a screen needs them —
   CoinRow in particular is built on the prototype's mock ticker. */

export const Eyebrow = ({ children, style }) => (
  <div
    style={{
      font: '11px var(--font-sans)',
      fontWeight: 600,
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: 'var(--text-400)',
      ...style,
    }}
  >
    {children}
  </div>
);

export const Section = ({ children, style }) => (
  <div style={{ padding: '0 16px', ...style }}>{children}</div>
);

/** Big page title. Sentence case, per brand voice. */
export const ScreenHead = ({ title, sub, action }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      padding: '6px 16px 14px',
    }}
  >
    <div>
      <h1
        style={{
          font: '700 26px var(--font-sans)',
          color: 'var(--text-900)',
          letterSpacing: '-0.03em',
          lineHeight: 1.05,
        }}
      >
        {title}
      </h1>
      {sub && (
        <div style={{ font: '13px var(--font-sans)', color: 'var(--text-500)', marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
    {action}
  </div>
);

export const SubHead = ({ children, action, style }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '20px 16px 10px',
      ...style,
    }}
  >
    <h2
      style={{ font: '600 15px var(--font-sans)', color: 'var(--text-900)', letterSpacing: '-0.01em' }}
    >
      {children}
    </h2>
    {action}
  </div>
);

export const MetricRow = ({ label, value, mono = true, color, hint }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      padding: '11px 0',
      borderTop: '1px solid var(--border-soft)',
    }}
  >
    <span style={{ font: '13px var(--font-sans)', color: 'var(--text-500)', minWidth: 0 }}>
      {label}
      {hint && (
        <span style={{ display: 'block', font: '11px var(--font-sans)', color: 'var(--text-400)', marginTop: 2 }}>
          {hint}
        </span>
      )}
    </span>
    <span
      className={mono ? 'apex-num' : undefined}
      style={{
        font: mono ? '14px var(--font-mono)' : '600 14px var(--font-sans)',
        color: color || 'var(--text-900)',
        textAlign: 'right',
        whiteSpace: 'nowrap',
      }}
    >
      {value}
    </span>
  </div>
);

/** Surface used for every grouped block on the live screen. */
export const Panel = ({ children, style }) => (
  <div
    style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--inset-top)',
      ...style,
    }}
  >
    {children}
  </div>
);
