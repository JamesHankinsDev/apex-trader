/* Apex Trader — ported from the vendored design system.

   Source: public/prototype/_ds/apex/_ds_bundle.js  (components/core/Icon.jsx)
   Ported per the checklist in README.md: IIFE unwrapped, React imported
   rather than read off window, component exported. The body below is
   otherwise VERBATIM — it is Babel output, so it reads as
   React.createElement rather than JSX. Re-port from the bundle if the
   design system is regenerated; do not hand-edit the createElement calls.
*/

import React from 'react';

function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Apex iconography — Lucide-style 24px stroke icons (2px, round caps/joins).
   currentColor inherits the text color. One coherent line-icon language. */
const P = {
  'trending-up': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("polyline", {
    points: "22 7 13.5 15.5 8.5 10.5 2 17"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "16 7 22 7 22 13"
  })),
  'trending-down': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("polyline", {
    points: "22 17 13.5 8.5 8.5 13.5 2 7"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "16 17 22 17 22 11"
  })),
  'arrow-up-right': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("line", {
    x1: "7",
    y1: "17",
    x2: "17",
    y2: "7"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "7 7 17 7 17 17"
  })),
  'arrow-down-right': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("line", {
    x1: "7",
    y1: "7",
    x2: "17",
    y2: "17"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "17 7 17 17 7 17"
  })),
  'arrow-up': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "19",
    x2: "12",
    y2: "5"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "5 12 12 5 19 12"
  })),
  'arrow-down': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "5",
    x2: "12",
    y2: "19"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "19 12 12 19 5 12"
  })),
  'chevron-down': /*#__PURE__*/React.createElement("polyline", {
    points: "6 9 12 15 18 9"
  }),
  'chevron-right': /*#__PURE__*/React.createElement("polyline", {
    points: "9 6 15 12 9 18"
  }),
  'chevron-left': /*#__PURE__*/React.createElement("polyline", {
    points: "15 6 9 12 15 18"
  }),
  'chevron-up': /*#__PURE__*/React.createElement("polyline", {
    points: "6 15 12 9 18 15"
  }),
  'x': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("line", {
    x1: "18",
    y1: "6",
    x2: "6",
    y2: "18"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "6",
    y1: "6",
    x2: "18",
    y2: "18"
  })),
  'check': /*#__PURE__*/React.createElement("polyline", {
    points: "20 6 9 17 4 12"
  }),
  'plus': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "5",
    x2: "12",
    y2: "19"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "5",
    y1: "12",
    x2: "19",
    y2: "12"
  })),
  'search': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "7"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "21",
    y1: "21",
    x2: "16.65",
    y2: "16.65"
  })),
  'bell': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M13.73 21a2 2 0 0 1-3.46 0"
  })),
  'settings': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M19.4 15a1.6 1.6 0 0 0 .32 1.77l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-2.77 1.13V21a2 2 0 0 1-4 0v-.09A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.77.32l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.6 1.6 0 0 0 3.6 15H3.5a2 2 0 0 1 0-4h.09A1.6 1.6 0 0 0 5 9.4a1.6 1.6 0 0 0-.32-1.77l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.6 1.6 0 0 0 9 5.6h.09A1.6 1.6 0 0 0 11 3.6V3.5a2 2 0 0 1 4 0v.09a1.6 1.6 0 0 0 2.6 1.18 1.6 1.6 0 0 0 1.77.32l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.6 1.6 0 0 0 20.4 11h.1a2 2 0 0 1 0 4h-.09a1.6 1.6 0 0 0-1.01.99z"
  })),
  'sliders': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("line", {
    x1: "4",
    y1: "21",
    x2: "4",
    y2: "14"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "4",
    y1: "10",
    x2: "4",
    y2: "3"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "21",
    x2: "12",
    y2: "12"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "8",
    x2: "12",
    y2: "3"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "20",
    y1: "21",
    x2: "20",
    y2: "16"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "20",
    y1: "12",
    x2: "20",
    y2: "3"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "1",
    y1: "14",
    x2: "7",
    y2: "14"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "9",
    y1: "8",
    x2: "15",
    y2: "8"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "17",
    y1: "16",
    x2: "23",
    y2: "16"
  })),
  'filter': /*#__PURE__*/React.createElement("polygon", {
    points: "22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"
  }),
  'more-horizontal': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "19",
    cy: "12",
    r: "1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "5",
    cy: "12",
    r: "1"
  })),
  'refresh-cw': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M21 12a9 9 0 0 1-9 9 9 9 0 0 1-6.36-2.64L3 16"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M3 12a9 9 0 0 1 9-9 9 9 0 0 1 6.36 2.64L21 8"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "21 3 21 8 16 8"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "3 21 3 16 8 16"
  })),
  'repeat': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("polyline", {
    points: "17 1 21 5 17 9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M3 11V9a4 4 0 0 1 4-4h14"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "7 23 3 19 7 15"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M21 13v2a4 4 0 0 1-4 4H3"
  })),
  'copy': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
    x: "9",
    y: "9",
    width: "13",
    height: "13",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
  })),
  'external-link': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "15 3 21 3 21 9"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "10",
    y1: "14",
    x2: "21",
    y2: "3"
  })),
  'play': /*#__PURE__*/React.createElement("polygon", {
    points: "6 4 20 12 6 20 6 4"
  }),
  'pause': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
    x: "6",
    y: "4",
    width: "4",
    height: "16",
    rx: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "14",
    y: "4",
    width: "4",
    height: "16",
    rx: "1"
  })),
  'zap': /*#__PURE__*/React.createElement("polygon", {
    points: "13 2 3 14 12 14 11 22 21 10 12 10 13 2"
  }),
  'shield': /*#__PURE__*/React.createElement("path", {
    d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
  }),
  'activity': /*#__PURE__*/React.createElement("polyline", {
    points: "22 12 18 12 15 21 9 3 6 12 2 12"
  }),
  'bot': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "11",
    width: "18",
    height: "10",
    rx: "2"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "5",
    r: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 7v4"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8",
    y1: "16",
    x2: "8",
    y2: "16"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "16",
    y1: "16",
    x2: "16",
    y2: "16"
  })),
  'cpu': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
    x: "4",
    y: "4",
    width: "16",
    height: "16",
    rx: "2"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "9",
    y: "9",
    width: "6",
    height: "6"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "9",
    y1: "1",
    x2: "9",
    y2: "4"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "15",
    y1: "1",
    x2: "15",
    y2: "4"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "9",
    y1: "20",
    x2: "9",
    y2: "23"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "15",
    y1: "20",
    x2: "15",
    y2: "23"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "20",
    y1: "9",
    x2: "23",
    y2: "9"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "20",
    y1: "14",
    x2: "23",
    y2: "14"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "1",
    y1: "9",
    x2: "4",
    y2: "9"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "1",
    y1: "14",
    x2: "4",
    y2: "14"
  })),
  'wallet': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M21 12V7H5a2 2 0 0 1 0-4h14v4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M3 5v14a2 2 0 0 0 2 2h16v-5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M18 12a2 2 0 0 0 0 4h4v-4z"
  })),
  'pie-chart': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M21.21 15.89A10 10 0 1 1 8 2.83"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M22 12A10 10 0 0 0 12 2v10z"
  })),
  'bar-chart': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("line", {
    x1: "6",
    y1: "20",
    x2: "6",
    y2: "12"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "20",
    x2: "12",
    y2: "4"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "18",
    y1: "20",
    x2: "18",
    y2: "14"
  })),
  'candlestick': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M9 5v3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9 16v3"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "7",
    y: "8",
    width: "4",
    height: "8",
    rx: "1"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M15 3v4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M15 17v4"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "13",
    y: "7",
    width: "4",
    height: "10",
    rx: "1"
  })),
  'layout-dashboard': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "3",
    width: "7",
    height: "9",
    rx: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "14",
    y: "3",
    width: "7",
    height: "5",
    rx: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "14",
    y: "12",
    width: "7",
    height: "9",
    rx: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "16",
    width: "7",
    height: "5",
    rx: "1"
  })),
  'dollar-sign': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "1",
    x2: "12",
    y2: "23"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
  })),
  'lock': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "11",
    width: "18",
    height: "11",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7 11V7a5 5 0 0 1 10 0v4"
  })),
  'user': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "7",
    r: "4"
  })),
  'log-out': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "16 17 21 12 16 7"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "21",
    y1: "12",
    x2: "9",
    y2: "12"
  })),
  'eye': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "3"
  })),
  'alert-triangle': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "9",
    x2: "12",
    y2: "13"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "17",
    x2: "12",
    y2: "17"
  })),
  'star': /*#__PURE__*/React.createElement("polygon", {
    points: "12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
  }),
  'gauge': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M12 14 18 8"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M3.34 19a10 10 0 1 1 17.32 0"
  })),
  'sparkles': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M19 5v2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M20 6h-2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5 17v2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M6 18H4"
  })),
  'menu': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("line", {
    x1: "3",
    y1: "6",
    x2: "21",
    y2: "6"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "3",
    y1: "12",
    x2: "21",
    y2: "12"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "3",
    y1: "18",
    x2: "21",
    y2: "18"
  })),
  'home': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"
  })),
  'clock': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "9"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "12 7 12 12 15 14"
  })),
  'info': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "9"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "11",
    x2: "12",
    y2: "16"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "8",
    x2: "12",
    y2: "8"
  })),
  'wifi': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M5 12.5a10 10 0 0 1 14 0"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8.5 16a5 5 0 0 1 7 0"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "19.5",
    x2: "12",
    y2: "19.5"
  }))
};

/** Lucide-style line icon. Pass a `name` from the Apex icon set. */
function Icon({
  name,
  size = 20,
  strokeWidth = 2,
  className = '',
  ...rest
}) {
  const node = P[name];
  return /*#__PURE__*/React.createElement("svg", _extends({
    className: ['apex-icon', className].filter(Boolean).join(' '),
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      display: 'inline-flex',
      flex: 'none',
      verticalAlign: 'middle'
    },
    "aria-hidden": "true"
  }, rest), node || null);
}

/** Names available in the Apex icon set. */
const ICON_NAMES = Object.keys(P);

export { Icon, ICON_NAMES };
