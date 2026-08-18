'use client';

/* Apex Trader — mobile app shell.

   Ported from public/prototype/app/app.jsx, with two deliberate departures:

   1. No IOSDevice frame. The prototype renders inside a scaled 390x844 device
      mock because it is a design artefact viewed on a desktop. This runs on an
      actual phone, so the viewport IS the frame; wrapping it in a fake bezel
      would waste the screen and break scroll behaviour.

   2. Tabs are routes, not useState. The prototype swaps a `tab` string because
      it has no router. Real routes give back the URL, the back button, and
      deep links — /m/live is something you can bookmark or send to yourself.

   The prototype's accent theming, tweaks panel and toast system are not ported.
   They are prototype tooling, not product. */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '../components/ds/index.js';

const TABS = [
  ['/m/live', 'Live', 'activity'],
  ['/m/assets', 'Assets', 'wallet'],
  ['/m/market', 'Market', 'candlestick'],
  ['/m/bots', 'Bots', 'bot'],
  ['/m/stats', 'Stats', 'bar-chart'],
];

function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        flex: 'none',
        display: 'flex',
        borderTop: '1px solid var(--border)',
        background: 'rgba(9,11,16,0.86)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        // The trailing inset is the home-indicator gutter. env() resolves to 0
        // on anything without one, so this is safe on desktop too.
        padding: '8px 6px calc(10px + env(safe-area-inset-bottom))',
      }}
    >
      {TABS.map(([href, label, icon]) => {
        const on = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={on ? 'page' : undefined}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: '6px 0',
              textDecoration: 'none',
              color: on ? 'var(--brand-text)' : 'var(--text-500)',
            }}
          >
            <Icon name={icon} size={22} strokeWidth={on ? 2.4 : 2} />
            <span style={{ font: `${on ? 600 : 500} 10px var(--font-sans)` }}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function MobileShell({ children }) {
  return (
    <div
      style={{
        // Not 100vh: on iOS Safari that is the height WITHOUT the browser
        // chrome, so the bottom nav sits under the address bar. dvh tracks the
        // visible viewport as the chrome collapses.
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-app)',
        overflow: 'hidden',
        // Stops the whole shell rubber-banding against the nav on iOS. Doing
        // it here rather than with userScalable:false keeps pinch-zoom.
        overscrollBehavior: 'none',
      }}
    >
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingTop: 'calc(8px + env(safe-area-inset-top))',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
