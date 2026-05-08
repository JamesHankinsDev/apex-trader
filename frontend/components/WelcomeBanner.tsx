'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'apex-v2-welcome-dismissed';

export default function WelcomeBanner() {
  // Start hidden to avoid flicker on SSR; show after mount if not dismissed.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = window.localStorage.getItem(STORAGE_KEY) === '1';
      if (!dismissed) setVisible(true);
    } catch {
      // localStorage may be blocked — fail closed (don't show).
    }
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
  }

  if (!visible) return null;

  return (
    <div
      role="status"
      style={{
        background: 'linear-gradient(90deg, rgba(96,165,250,0.14), rgba(74,222,128,0.08))',
        borderBottom: '1px solid var(--border)',
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}
    >
      <div style={{ fontSize: 18 }} aria-hidden>
        👋
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 500, marginBottom: 2 }}>
          Welcome to APEX v2 — first time here?
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          Backtest-first crypto strategy research. 208 runs across 7 strategies
          and 3 symbols are waiting in the database. Start with the
          walkthrough to understand what you&apos;re looking at.
        </div>
      </div>
      <Link
        href="/how-it-works"
        onClick={dismiss}
        style={{
          padding: '8px 14px',
          background: 'rgba(96,165,250,0.2)',
          border: '1px solid rgba(96,165,250,0.35)',
          borderRadius: 4,
          color: 'var(--blue)',
          fontSize: 13,
          fontWeight: 500,
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        Take the tour →
      </Link>
      <button
        onClick={dismiss}
        aria-label="Dismiss welcome"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--muted)',
          cursor: 'pointer',
          fontSize: 18,
          padding: '4px 8px',
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}
