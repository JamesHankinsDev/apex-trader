import type { ReactNode } from 'react';
import Link from 'next/link';
import WelcomeBanner from '../components/WelcomeBanner';
import './globals.css';

export const metadata = {
  title: 'APEX TRADER v2',
  description: 'Backtest and strategy transparency',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WelcomeBanner />
        <nav className="topnav">
          <Link href="/" className="brand">APEX v2</Link>
          <div className="links">
            <Link href="/matrix">Matrix</Link>
            <Link href="/runs">Runs</Link>
            <Link href="/portfolios">Portfolios</Link>
            <Link href="/roadmap">What&apos;s next</Link>
            <Link href="/how-it-works">How it works</Link>
          </div>
        </nav>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
