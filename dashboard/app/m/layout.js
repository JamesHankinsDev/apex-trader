/* Apex Trader — mobile section layout.

   A SERVER component that does nothing but wrap the client shell, because
   Next forbids `metadata` and `viewport` exports from client components and
   the shell needs hooks (usePathname). Splitting them is the only way to get
   viewport-fit=cover, which the shell depends on — see below.

   The shell itself is in ./shell.js. */

import MobileShell from './shell.js';

export const metadata = {
  title: 'Apex Trader — live',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#090b10',

  // REQUIRED, not cosmetic. Without viewport-fit=cover iOS reports every
  // env(safe-area-inset-*) as 0px, and the shell uses those to keep the bottom
  // nav clear of the home indicator — so omitting this puts the nav under it
  // on every notched iPhone. It also stops the page from being letterboxed
  // inside the safe area, which is what makes the background reach the edges.
  viewportFit: 'cover',

  // Pinch-zoom is deliberately NOT disabled. maximumScale/userScalable would
  // stop the page rubber-banding, but they also stop someone enlarging text —
  // a WCAG 1.4.4 failure for the sake of a scroll nicety. overscroll-behavior
  // in the shell handles the rubber-banding without taking zoom away.
};

export default function MobileLayout({ children }) {
  return <MobileShell>{children}</MobileShell>;
}
