/* Apex Trader — ported from the vendored design system.

   Source: public/prototype/_ds/apex/_ds_bundle.js  (components/data/PriceChange.jsx)
   Ported per the checklist in README.md: IIFE unwrapped, React imported
   rather than read off window, component exported. The body below is
   otherwise VERBATIM — it is Babel output, so it reads as
   React.createElement rather than JSX. Re-port from the bundle if the
   design system is regenerated; do not hand-edit the createElement calls.
*/

import React from 'react';

function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function ensure(id, css) {
  if (typeof document === 'undefined') return;
  if (document.getElementById(id)) return;
  const el = document.createElement('style');
  el.id = id;
  el.textContent = css;
  document.head.appendChild(el);
}
const CSS = `
.apex-delta{
  display:inline-flex;align-items:center;gap:4px;
  font-family:var(--font-mono);font-variant-numeric:tabular-nums;
  font-weight:var(--weight-medium);letter-spacing:-.01em;line-height:1;
}
.apex-delta--up{color:var(--up-500);}
.apex-delta--down{color:var(--down-500);}
.apex-delta--flat{color:var(--text-500);}
.apex-delta__arrow{font-size:.85em;}
.apex-delta--sm{font-size:var(--text-sm);}
.apex-delta--md{font-size:var(--text-base);}
.apex-delta--lg{font-size:var(--text-h4);}
.apex-delta--pill{padding:4px 9px;border-radius:var(--radius-sm);font-weight:var(--weight-semibold);}
.apex-delta--pill.apex-delta--up{background:var(--up-soft);}
.apex-delta--pill.apex-delta--down{background:var(--down-soft);}
.apex-delta--pill.apex-delta--flat{background:var(--bg-elevated);}
`;

/**
 * Signed price/percent delta. Sign drives color (green up / red down).
 * Pass `value` (number) and `percent`/`pill` options, or `children` for custom.
 */
function PriceChange({
  value,
  percent = false,
  prefix = '',
  digits = 2,
  size = 'md',
  pill = false,
  showArrow = true,
  className = '',
  children,
  ...rest
}) {
  ensure('apex-delta-css', CSS);
  const dir = value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
  const arrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '–';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  const num = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
  return /*#__PURE__*/React.createElement("span", _extends({
    className: ['apex-delta', `apex-delta--${dir}`, `apex-delta--${size}`, pill ? 'apex-delta--pill' : '', className].filter(Boolean).join(' ')
  }, rest), showArrow && /*#__PURE__*/React.createElement("span", {
    className: "apex-delta__arrow",
    "aria-hidden": "true"
  }, arrow), children != null ? children : /*#__PURE__*/React.createElement("span", null, sign, prefix, num, percent ? '%' : ''));
}

export { PriceChange };
