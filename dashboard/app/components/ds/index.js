/* Apex Trader — design system surface for the Next.js app.

   Import from here, never from public/prototype/. The prototype is a vendored
   browser bundle (React 18 UMD + Babel, components on window) that Next cannot
   import; it stays in place as the visual reference.

   Only what the app actually renders is ported. The bundle also carries
   StatCard, Tag, Button, IconButton, Input, Select, Switch, Avatar, Card and
   Tabs — port each on demand, the same way, rather than up front. */

// Named icon-set.js, NOT icon.js: under app/ Next treats `icon.{js,tsx}`
// as the dynamic-favicon metadata convention and tries to build it as a
// route, which fails with "Default export is missing".
export { Icon, ICON_NAMES } from './icon-set.js';
export { Badge } from './badge.js';
export { PriceChange } from './price-change.js';
export { Sparkline } from './sparkline.js';
