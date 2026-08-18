/* Apex Trader — ported from the vendored design system.

   Source: public/prototype/_ds/apex/_ds_bundle.js  (components/data/Badge.jsx)
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
.apex-badge{
  display:inline-flex;align-items:center;gap:5px;
  font-family:var(--font-sans);font-size:var(--text-2xs);font-weight:var(--weight-semibold);
  letter-spacing:.01em;line-height:1;padding:4px 9px;border-radius:var(--radius-pill);
  border:1px solid transparent;white-space:nowrap;
}
.apex-badge--solid{padding:5px 10px;}
.apex-badge__dot{width:6px;height:6px;border-radius:50%;background:currentColor;flex:none;}
.apex-badge--neutral{background:var(--bg-elevated);color:var(--text-500);border-color:var(--line);}
.apex-badge--brand{background:var(--brand-surface);color:var(--brand-text);border-color:var(--brand-border);}
.apex-badge--up{background:var(--up-soft);color:var(--up-400);border-color:var(--up-line);}
.apex-badge--down{background:var(--down-soft);color:var(--down-400);border-color:var(--down-line);}
.apex-badge--warning{background:var(--warning-soft);color:var(--warning-500);border-color:rgba(255,176,32,.4);}
.apex-badge--info{background:var(--info-soft);color:var(--info-500);border-color:rgba(77,168,255,.4);}
.apex-badge--solid.apex-badge--brand{background:var(--brand);color:#fff;border-color:transparent;}
.apex-badge--solid.apex-badge--up{background:var(--up-500);color:#06140d;border-color:transparent;}
.apex-badge--solid.apex-badge--down{background:var(--down-500);color:#fff;border-color:transparent;}
`;

/** Compact status pill. tone: neutral|brand|up|down|warning|info. */
function Badge({
  tone = 'neutral',
  solid = false,
  dot = false,
  className = '',
  children,
  ...rest
}) {
  ensure('apex-badge-css', CSS);
  return /*#__PURE__*/React.createElement("span", _extends({
    className: ['apex-badge', `apex-badge--${tone}`, solid ? 'apex-badge--solid' : '', className].filter(Boolean).join(' ')
  }, rest), dot && /*#__PURE__*/React.createElement("span", {
    className: "apex-badge__dot"
  }), children);
}

export { Badge };
