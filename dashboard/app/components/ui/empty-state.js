/* Apex Trader — placeholder for a tab that exists in the shell but has nothing
   real behind it yet.

   It says what is missing and why, rather than rendering a convincing-looking
   screen full of mock numbers. The prototype at /prototype already does the
   second thing, and confusing the two is exactly the failure mode this app is
   being built to end. */

import { Icon } from '../ds/index.js';

export default function EmptyState({ icon, title, body, reference }) {
  return (
    <div style={{ padding: '48px 28px', textAlign: 'center' }}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 46,
          height: 46,
          borderRadius: 13,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          color: 'var(--text-400)',
        }}
      >
        <Icon name={icon} size={22} />
      </span>

      <h1
        style={{
          font: '700 19px var(--font-sans)',
          color: 'var(--text-900)',
          letterSpacing: '-0.02em',
          margin: '16px 0 8px',
        }}
      >
        {title}
      </h1>

      <p style={{ font: '13px var(--font-sans)', color: 'var(--text-500)', lineHeight: 1.55, margin: 0 }}>
        {body}
      </p>

      {reference && (
        <p style={{ font: '12px var(--font-sans)', color: 'var(--text-400)', lineHeight: 1.5, marginTop: 14 }}>
          Design reference:{' '}
          <a href={reference} style={{ color: 'var(--brand-text)' }}>
            {reference.replace('/prototype/index.html', '/prototype')}
          </a>{' '}
          — mock data.
        </p>
      )}
    </div>
  );
}
