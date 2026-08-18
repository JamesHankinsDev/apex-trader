/* Apex Trader — ported from the vendored design system.

   Source: public/prototype/_ds/apex/_ds_bundle.js  (components/data/Sparkline.jsx)
   Ported per the checklist in README.md: IIFE unwrapped, React imported
   rather than read off window, component exported. The body below is
   otherwise VERBATIM — it is Babel output, so it reads as
   React.createElement rather than JSX. Re-port from the bundle if the
   design system is regenerated; do not hand-edit the createElement calls.
*/

'use client';

import React from 'react';

function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Tiny inline trend line built from a numeric series. Auto-colors green/red
 * by net direction unless `tone` is set. Pure SVG, no deps.
 */
function Sparkline({
  data = [],
  width = 96,
  height = 28,
  strokeWidth = 1.75,
  tone = 'auto',
  fill = true,
  className = '',
  ...rest
}) {
  const pts = data.length ? data : [0, 0];
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;
  const stepX = width / (pts.length - 1 || 1);
  const coords = pts.map((v, i) => {
    const x = i * stepX;
    const y = height - (v - min) / range * (height - strokeWidth * 2) - strokeWidth;
    return [x, y];
  });
  const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;
  const up = pts[pts.length - 1] >= pts[0];
  const color = tone === 'up' ? 'var(--up-500)' : tone === 'down' ? 'var(--down-500)' : tone === 'brand' ? 'var(--brand)' : up ? 'var(--up-500)' : 'var(--down-500)';
  // PORT DEVIATION — the bundle uses Math.random() here. Under SSR that
  // generates one id on the server and a different one on the client, so
  // React reports a hydration mismatch and the gradient fill can point at a
  // <defs> id that no longer exists. useId() is stable across both passes.
  const gid = 'apex-spark-' + React.useId().replace(/:/g, '');
  return /*#__PURE__*/React.createElement("svg", _extends({
    className: ['apex-sparkline', className].filter(Boolean).join(' '),
    width: width,
    height: height,
    viewBox: `0 0 ${width} ${height}`,
    fill: "none",
    preserveAspectRatio: "none",
    "aria-hidden": "true"
  }, rest), fill && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: gid,
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0",
    stopColor: color,
    stopOpacity: "0.22"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "1",
    stopColor: color,
    stopOpacity: "0"
  }))), /*#__PURE__*/React.createElement("path", {
    d: area,
    fill: `url(#${gid})`
  })), /*#__PURE__*/React.createElement("path", {
    d: line,
    stroke: color,
    strokeWidth: strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }));
}

export { Sparkline };
