/* @ds-bundle: {"format":3,"namespace":"ApexTraderDesignSystem_cd55a5","components":[{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"ICON_NAMES","sourcePath":"components/core/Icon.jsx"},{"name":"Badge","sourcePath":"components/data/Badge.jsx"},{"name":"PriceChange","sourcePath":"components/data/PriceChange.jsx"},{"name":"Sparkline","sourcePath":"components/data/Sparkline.jsx"},{"name":"StatCard","sourcePath":"components/data/StatCard.jsx"},{"name":"Tag","sourcePath":"components/data/Tag.jsx"},{"name":"Button","sourcePath":"components/forms/Button.jsx"},{"name":"IconButton","sourcePath":"components/forms/IconButton.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"Avatar","sourcePath":"components/layout/Avatar.jsx"},{"name":"Card","sourcePath":"components/layout/Card.jsx"},{"name":"Tabs","sourcePath":"components/layout/Tabs.jsx"}],"sourceHashes":{"components/core/Icon.jsx":"b21d218b318d","components/data/Badge.jsx":"a37ee99f8bb2","components/data/PriceChange.jsx":"730f4219afb1","components/data/Sparkline.jsx":"d2bb32395d5a","components/data/StatCard.jsx":"55ae09ec4320","components/data/Tag.jsx":"76137007e7b9","components/forms/Button.jsx":"55647fe0ec5b","components/forms/IconButton.jsx":"c23ab9704775","components/forms/Input.jsx":"a0d3a2979c59","components/forms/Select.jsx":"1f66f2e9f11c","components/forms/Switch.jsx":"4d889c065d63","components/layout/Avatar.jsx":"a2b68eeab674","components/layout/Card.jsx":"5ac01bde41ef","components/layout/Tabs.jsx":"cd6aee62da53","ui_kits/mobile_app/ios-frame.jsx":"be3343be4b51","ui_kits/mobile_app/screens.jsx":"a49ed02f876d","ui_kits/trading_app/Bots.jsx":"f30a4bd526c4","ui_kits/trading_app/Chart.jsx":"4a756fe1e7ae","ui_kits/trading_app/Dashboard.jsx":"cc1b69163689","ui_kits/trading_app/Portfolio.jsx":"f799c7faad2b","ui_kits/trading_app/Shell.jsx":"8ad746530853","ui_kits/trading_app/data.js":"5ec06ca6aa08"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.ApexTraderDesignSystem_cd55a5 = window.ApexTraderDesignSystem_cd55a5 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Icon.jsx
try { (() => {
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
Object.assign(__ds_scope, { Icon, ICON_NAMES });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/data/Badge.jsx
try { (() => {
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
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Badge.jsx", error: String((e && e.message) || e) }); }

// components/data/PriceChange.jsx
try { (() => {
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
Object.assign(__ds_scope, { PriceChange });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/PriceChange.jsx", error: String((e && e.message) || e) }); }

// components/data/Sparkline.jsx
try { (() => {
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
  const gid = 'apex-spark-' + Math.random().toString(36).slice(2, 8);
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
Object.assign(__ds_scope, { Sparkline });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Sparkline.jsx", error: String((e && e.message) || e) }); }

// components/data/StatCard.jsx
try { (() => {
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
.apex-stat{
  display:flex;flex-direction:column;gap:10px;
  padding:var(--pad-card);background:var(--bg-surface);
  border:1px solid var(--border);border-radius:var(--radius-lg);
  box-shadow:var(--inset-top);min-width:0;
}
.apex-stat__top{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.apex-stat__label{font-size:var(--text-xs);font-weight:var(--weight-medium);color:var(--text-500);
  text-transform:uppercase;letter-spacing:var(--tracking-caps);}
.apex-stat__icon{color:var(--text-500);display:flex;}
.apex-stat__value{font-family:var(--font-mono);font-variant-numeric:tabular-nums;
  font-size:var(--text-h2);font-weight:var(--weight-semibold);color:var(--text-900);
  letter-spacing:-.02em;line-height:1;}
.apex-stat__unit{font-size:.55em;color:var(--text-500);margin-left:4px;font-weight:var(--weight-regular);}
.apex-stat__foot{display:flex;align-items:center;justify-content:space-between;gap:10px;}
.apex-stat__sub{font-size:var(--text-xs);color:var(--text-400);}
.apex-stat--compact{padding:14px 16px;gap:7px;}
.apex-stat--compact .apex-stat__value{font-size:var(--text-h3);}
`;

/** KPI tile: label, big mono value, optional delta + sparkline. */
function StatCard({
  label,
  value,
  unit,
  delta,
  deltaPercent = true,
  sub,
  data,
  icon,
  compact = false,
  className = '',
  ...rest
}) {
  ensure('apex-stat-css', CSS);
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ['apex-stat', compact ? 'apex-stat--compact' : '', className].filter(Boolean).join(' ')
  }, rest), /*#__PURE__*/React.createElement("div", {
    className: "apex-stat__top"
  }, /*#__PURE__*/React.createElement("span", {
    className: "apex-stat__label"
  }, label), icon && /*#__PURE__*/React.createElement("span", {
    className: "apex-stat__icon"
  }, icon)), /*#__PURE__*/React.createElement("div", {
    className: "apex-stat__value"
  }, value, unit && /*#__PURE__*/React.createElement("span", {
    className: "apex-stat__unit"
  }, unit)), /*#__PURE__*/React.createElement("div", {
    className: "apex-stat__foot"
  }, delta != null && /*#__PURE__*/React.createElement(__ds_scope.PriceChange, {
    value: delta,
    percent: deltaPercent,
    size: "sm"
  }), sub && /*#__PURE__*/React.createElement("span", {
    className: "apex-stat__sub"
  }, sub), data && /*#__PURE__*/React.createElement(__ds_scope.Sparkline, {
    data: data,
    width: 84,
    height: 26
  })));
}
Object.assign(__ds_scope, { StatCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/StatCard.jsx", error: String((e && e.message) || e) }); }

// components/data/Tag.jsx
try { (() => {
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
.apex-tag{
  display:inline-flex;align-items:center;gap:6px;font-family:var(--font-sans);
  font-size:var(--text-sm);font-weight:var(--weight-medium);color:var(--text-700);
  padding:5px 10px;background:var(--bg-elevated);border:1px solid var(--line);
  border-radius:var(--radius-sm);line-height:1;white-space:nowrap;
  transition:border-color var(--dur-2) var(--ease-out),background var(--dur-2) var(--ease-out),color var(--dur-2) var(--ease-out);
}
.apex-tag--clickable{cursor:pointer;}
.apex-tag--clickable:hover{border-color:var(--violet-line);color:var(--text-900);}
.apex-tag--selected{background:var(--brand-surface);border-color:var(--brand-border);color:var(--brand-text);}
.apex-tag__sym{font-family:var(--font-mono);font-weight:var(--weight-semibold);letter-spacing:-.01em;}
.apex-tag__x{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;
  margin:-2px -3px -2px 0;border-radius:var(--radius-xs);color:var(--text-400);cursor:pointer;}
.apex-tag__x:hover{background:var(--bg-hover);color:var(--text-900);}
.apex-tag--sm{font-size:var(--text-xs);padding:3px 8px;}
`;

/** Chip for filters, asset symbols and selectable categories. */
function Tag({
  selected = false,
  onRemove,
  clickable = false,
  mono = false,
  size = 'md',
  leading,
  className = '',
  children,
  ...rest
}) {
  ensure('apex-tag-css', CSS);
  const isClickable = clickable || !!rest.onClick;
  return /*#__PURE__*/React.createElement("span", _extends({
    className: ['apex-tag', size === 'sm' ? 'apex-tag--sm' : '', isClickable ? 'apex-tag--clickable' : '', selected ? 'apex-tag--selected' : '', className].filter(Boolean).join(' ')
  }, rest), leading, /*#__PURE__*/React.createElement("span", {
    className: mono ? 'apex-tag__sym' : undefined
  }, children), onRemove && /*#__PURE__*/React.createElement("span", {
    className: "apex-tag__x",
    role: "button",
    "aria-label": "Remove",
    onClick: e => {
      e.stopPropagation();
      onRemove(e);
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "10",
    height: "10",
    viewBox: "0 0 10 10",
    fill: "none",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M1 1l8 8M9 1l-8 8",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round"
  }))));
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Tag.jsx", error: String((e && e.message) || e) }); }

// components/forms/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* one-time stylesheet injection so :hover / :active / focus work */
function ensure(id, css) {
  if (typeof document === 'undefined') return;
  if (document.getElementById(id)) return;
  const el = document.createElement('style');
  el.id = id;
  el.textContent = css;
  document.head.appendChild(el);
}
const CSS = `
.apex-btn{
  --_bg:var(--brand);--_fg:var(--brand-contrast);--_bd:transparent;
  display:inline-flex;align-items:center;justify-content:center;gap:var(--gap-inline);
  font-family:var(--font-sans);font-weight:var(--weight-semibold);
  border:1px solid var(--_bd);border-radius:var(--radius-md);
  background:var(--_bg);color:var(--_fg);cursor:pointer;
  white-space:nowrap;text-decoration:none;line-height:1;
  transition:transform var(--dur-1) var(--ease-out),
             background var(--dur-2) var(--ease-out),
             border-color var(--dur-2) var(--ease-out),
             box-shadow var(--dur-2) var(--ease-out),
             opacity var(--dur-2) var(--ease-out);
}
.apex-btn:focus-visible{outline:none;box-shadow:var(--ring-focus);}
.apex-btn:active{transform:translateY(1px) scale(0.985);}
.apex-btn[disabled],.apex-btn[aria-disabled="true"]{opacity:.45;cursor:not-allowed;pointer-events:none;}

/* sizes */
.apex-btn--sm{height:32px;padding:0 14px;font-size:var(--text-sm);}
.apex-btn--md{height:40px;padding:0 18px;font-size:var(--text-base);}
.apex-btn--lg{height:48px;padding:0 24px;font-size:var(--text-lg);border-radius:var(--radius-lg);}

/* variants */
.apex-btn--primary{--_bg:var(--brand);--_fg:#fff;box-shadow:var(--glow-brand);}
.apex-btn--primary:hover{--_bg:var(--brand-hover);}
.apex-btn--primary:active{--_bg:var(--brand-press);}

.apex-btn--secondary{--_bg:var(--bg-elevated);--_fg:var(--text-900);--_bd:var(--line-strong);box-shadow:var(--inset-top);}
.apex-btn--secondary:hover{--_bg:var(--bg-hover);--_bd:var(--violet-line);}

.apex-btn--ghost{--_bg:transparent;--_fg:var(--text-700);}
.apex-btn--ghost:hover{--_bg:var(--bg-hover);--_fg:var(--text-900);}

.apex-btn--danger{--_bg:var(--down-soft);--_fg:var(--down-400);--_bd:var(--down-line);}
.apex-btn--danger:hover{--_bg:var(--down-500);--_fg:#fff;--_bd:transparent;}

.apex-btn--success{--_bg:var(--up-soft);--_fg:var(--up-400);--_bd:var(--up-line);}
.apex-btn--success:hover{--_bg:var(--up-500);--_fg:#06140d;--_bd:transparent;}

.apex-btn--block{width:100%;}
.apex-btn__spin{width:1em;height:1em;border-radius:50%;border:2px solid currentColor;border-top-color:transparent;animation:apex-btn-spin .7s linear infinite;}
@keyframes apex-btn-spin{to{transform:rotate(360deg);}}
`;

/**
 * Primary action control. Variants: primary | secondary | ghost | danger | success.
 */
function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  loading = false,
  disabled = false,
  iconLeft = null,
  iconRight = null,
  as = 'button',
  className = '',
  children,
  ...rest
}) {
  ensure('apex-btn-css', CSS);
  const Tag = as;
  const cls = ['apex-btn', `apex-btn--${variant}`, `apex-btn--${size}`, block ? 'apex-btn--block' : '', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement(Tag, _extends({
    className: cls,
    disabled: Tag === 'button' ? disabled || loading : undefined,
    "aria-disabled": disabled || loading || undefined
  }, rest), loading && /*#__PURE__*/React.createElement("span", {
    className: "apex-btn__spin",
    "aria-hidden": "true"
  }), !loading && iconLeft, children, !loading && iconRight);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Button.jsx", error: String((e && e.message) || e) }); }

// components/forms/IconButton.jsx
try { (() => {
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
.apex-iconbtn{
  display:inline-flex;align-items:center;justify-content:center;
  border:1px solid transparent;border-radius:var(--radius-md);
  background:transparent;color:var(--text-500);cursor:pointer;
  transition:background var(--dur-2) var(--ease-out),color var(--dur-2) var(--ease-out),
             border-color var(--dur-2) var(--ease-out),transform var(--dur-1) var(--ease-out);
}
.apex-iconbtn:hover{background:var(--bg-hover);color:var(--text-900);}
.apex-iconbtn:active{transform:scale(0.92);}
.apex-iconbtn:focus-visible{outline:none;box-shadow:var(--ring-focus);color:var(--text-900);}
.apex-iconbtn[disabled]{opacity:.4;cursor:not-allowed;pointer-events:none;}
.apex-iconbtn--sm{width:32px;height:32px;}
.apex-iconbtn--md{width:40px;height:40px;}
.apex-iconbtn--lg{width:48px;height:48px;border-radius:var(--radius-lg);}
.apex-iconbtn--solid{background:var(--bg-elevated);border-color:var(--line-strong);color:var(--text-700);box-shadow:var(--inset-top);}
.apex-iconbtn--solid:hover{background:var(--bg-hover);border-color:var(--violet-line);color:var(--text-900);}
.apex-iconbtn--brand{background:var(--brand-surface);border-color:var(--brand-border);color:var(--brand-text);}
.apex-iconbtn--brand:hover{background:var(--brand);color:#fff;border-color:transparent;}
.apex-iconbtn--active{background:var(--brand-surface);border-color:var(--brand-border);color:var(--brand-text);}
`;

/** Square, icon-only control. Pass a single icon node as children. */
function IconButton({
  size = 'md',
  variant = 'ghost',
  active = false,
  label,
  className = '',
  children,
  ...rest
}) {
  ensure('apex-iconbtn-css', CSS);
  const cls = ['apex-iconbtn', `apex-iconbtn--${size}`, variant !== 'ghost' ? `apex-iconbtn--${variant}` : '', active ? 'apex-iconbtn--active' : '', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("button", _extends({
    className: cls,
    "aria-label": label,
    "aria-pressed": active || undefined
  }, rest), children);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
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
.apex-field{display:flex;flex-direction:column;gap:6px;font-family:var(--font-sans);}
.apex-field__label{font-size:var(--text-sm);font-weight:var(--weight-medium);color:var(--text-700);}
.apex-field__req{color:var(--brand-text);margin-left:2px;}
.apex-input{
  display:flex;align-items:center;gap:var(--gap-inline);
  height:42px;padding:0 14px;
  background:var(--bg-inset);border:1px solid var(--line);
  border-radius:var(--radius-md);color:var(--text-900);
  transition:border-color var(--dur-2) var(--ease-out),box-shadow var(--dur-2) var(--ease-out),background var(--dur-2) var(--ease-out);
}
.apex-input:hover{border-color:var(--line-strong);}
.apex-input:focus-within{border-color:var(--violet-400);box-shadow:var(--glow-brand-soft);background:var(--bg-surface);}
.apex-input--invalid{border-color:var(--down-500);}
.apex-input--invalid:focus-within{box-shadow:var(--glow-down);}
.apex-input__el{
  flex:1;min-width:0;border:none;outline:none;background:transparent;
  color:var(--text-900);font-family:inherit;font-size:var(--text-base);
}
.apex-input--mono .apex-input__el{font-family:var(--font-mono);font-variant-numeric:tabular-nums;letter-spacing:-.01em;}
.apex-input__el::placeholder{color:var(--text-400);}
.apex-input__affix{color:var(--text-500);display:inline-flex;align-items:center;font-size:var(--text-sm);}
.apex-input--lg{height:48px;}
.apex-input--sm{height:34px;padding:0 11px;}
.apex-input[aria-disabled="true"]{opacity:.5;pointer-events:none;}
.apex-field__hint{font-size:var(--text-xs);color:var(--text-400);}
.apex-field__hint--err{color:var(--down-400);}
`;

/** Labeled text/number input with optional prefix/suffix affixes. */
function Input({
  label,
  hint,
  error,
  required = false,
  size = 'md',
  mono = false,
  disabled = false,
  prefix = null,
  suffix = null,
  id,
  className = '',
  ...rest
}) {
  ensure('apex-input-css', CSS);
  const fid = id || (label ? 'apex-' + label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const invalid = !!error;
  return /*#__PURE__*/React.createElement("label", {
    className: "apex-field",
    htmlFor: fid
  }, label && /*#__PURE__*/React.createElement("span", {
    className: "apex-field__label"
  }, label, required && /*#__PURE__*/React.createElement("span", {
    className: "apex-field__req"
  }, "*")), /*#__PURE__*/React.createElement("span", {
    className: ['apex-input', `apex-input--${size}`, mono ? 'apex-input--mono' : '', invalid ? 'apex-input--invalid' : '', className].filter(Boolean).join(' '),
    "aria-disabled": disabled || undefined
  }, prefix && /*#__PURE__*/React.createElement("span", {
    className: "apex-input__affix"
  }, prefix), /*#__PURE__*/React.createElement("input", _extends({
    id: fid,
    className: "apex-input__el",
    disabled: disabled,
    "aria-invalid": invalid || undefined
  }, rest)), suffix && /*#__PURE__*/React.createElement("span", {
    className: "apex-input__affix"
  }, suffix)), (error || hint) && /*#__PURE__*/React.createElement("span", {
    className: ['apex-field__hint', invalid ? 'apex-field__hint--err' : ''].filter(Boolean).join(' ')
  }, error || hint));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
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
.apex-select{position:relative;display:inline-flex;align-items:center;width:100%;}
.apex-select__el{
  appearance:none;-webkit-appearance:none;width:100%;height:42px;
  padding:0 38px 0 14px;font-family:var(--font-sans);font-size:var(--text-base);
  color:var(--text-900);background:var(--bg-inset);
  border:1px solid var(--line);border-radius:var(--radius-md);cursor:pointer;
  transition:border-color var(--dur-2) var(--ease-out),box-shadow var(--dur-2) var(--ease-out);
}
.apex-select__el:hover{border-color:var(--line-strong);}
.apex-select__el:focus-visible{outline:none;border-color:var(--violet-400);box-shadow:var(--glow-brand-soft);}
.apex-select__el:disabled{opacity:.5;cursor:not-allowed;}
.apex-select--sm .apex-select__el{height:34px;font-size:var(--text-sm);}
.apex-select--lg .apex-select__el{height:48px;}
.apex-select__chev{position:absolute;right:13px;pointer-events:none;color:var(--text-500);display:flex;}
`;
const Chevron = () => /*#__PURE__*/React.createElement("svg", {
  className: "apex-select__chev",
  width: "16",
  height: "16",
  viewBox: "0 0 16 16",
  fill: "none",
  "aria-hidden": "true"
}, /*#__PURE__*/React.createElement("path", {
  d: "M4 6l4 4 4-4",
  stroke: "currentColor",
  strokeWidth: "1.6",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}));

/** Native select styled to the Apex system. Pass options[] or children. */
function Select({
  options,
  value,
  defaultValue,
  onChange,
  size = 'md',
  disabled = false,
  placeholder,
  className = '',
  children,
  ...rest
}) {
  ensure('apex-select-css', CSS);
  return /*#__PURE__*/React.createElement("span", {
    className: ['apex-select', `apex-select--${size}`, className].filter(Boolean).join(' ')
  }, /*#__PURE__*/React.createElement("select", _extends({
    className: "apex-select__el",
    value: value,
    defaultValue: defaultValue,
    onChange: onChange,
    disabled: disabled
  }, rest), placeholder && /*#__PURE__*/React.createElement("option", {
    value: "",
    disabled: true
  }, placeholder), options ? options.map(o => {
    const opt = typeof o === 'string' ? {
      value: o,
      label: o
    } : o;
    return /*#__PURE__*/React.createElement("option", {
      key: opt.value,
      value: opt.value
    }, opt.label);
  }) : children), /*#__PURE__*/React.createElement(Chevron, null));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
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
.apex-switch{display:inline-flex;align-items:center;gap:10px;cursor:pointer;font-family:var(--font-sans);user-select:none;}
.apex-switch__track{
  position:relative;flex:none;width:42px;height:24px;border-radius:var(--radius-pill);
  background:var(--ink-600);border:1px solid var(--line);
  transition:background var(--dur-2) var(--ease-out),border-color var(--dur-2) var(--ease-out),box-shadow var(--dur-2) var(--ease-out);
}
.apex-switch__thumb{
  position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;
  background:var(--text-700);box-shadow:var(--shadow-1);
  transition:transform var(--dur-2) var(--ease-spring),background var(--dur-2) var(--ease-out);
}
.apex-switch__input{position:absolute;opacity:0;width:0;height:0;}
.apex-switch__input:checked + .apex-switch__track{background:var(--brand);border-color:transparent;box-shadow:var(--glow-brand);}
.apex-switch__input:checked + .apex-switch__track .apex-switch__thumb{transform:translateX(18px);background:#fff;}
.apex-switch__input:focus-visible + .apex-switch__track{box-shadow:var(--ring-focus);}
.apex-switch--sm .apex-switch__track{width:34px;height:20px;}
.apex-switch--sm .apex-switch__thumb{width:14px;height:14px;}
.apex-switch--sm .apex-switch__input:checked + .apex-switch__track .apex-switch__thumb{transform:translateX(14px);}
.apex-switch__label{font-size:var(--text-sm);color:var(--text-700);}
.apex-switch--disabled{opacity:.45;cursor:not-allowed;}
`;

/** On/off toggle. Used for bot enable, notifications, paper-trading mode, etc. */
function Switch({
  checked,
  defaultChecked,
  onChange,
  label,
  size = 'md',
  disabled = false,
  className = '',
  ...rest
}) {
  ensure('apex-switch-css', CSS);
  return /*#__PURE__*/React.createElement("label", {
    className: ['apex-switch', `apex-switch--${size}`, disabled ? 'apex-switch--disabled' : '', className].filter(Boolean).join(' ')
  }, /*#__PURE__*/React.createElement("input", _extends({
    type: "checkbox",
    className: "apex-switch__input",
    checked: checked,
    defaultChecked: defaultChecked,
    onChange: onChange,
    disabled: disabled,
    role: "switch"
  }, rest)), /*#__PURE__*/React.createElement("span", {
    className: "apex-switch__track"
  }, /*#__PURE__*/React.createElement("span", {
    className: "apex-switch__thumb"
  })), label && /*#__PURE__*/React.createElement("span", {
    className: "apex-switch__label"
  }, label));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/layout/Avatar.jsx
try { (() => {
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
.apex-avatar{position:relative;display:inline-flex;align-items:center;justify-content:center;flex:none;
  border-radius:50%;background:var(--bg-elevated);color:var(--text-700);overflow:hidden;
  font-family:var(--font-sans);font-weight:var(--weight-semibold);user-select:none;
  border:1px solid var(--line);}
.apex-avatar--brand{background:var(--brand-surface);color:var(--brand-text);border-color:var(--brand-border);}
.apex-avatar--square{border-radius:var(--radius-md);}
.apex-avatar img{width:100%;height:100%;object-fit:cover;}
.apex-avatar__status{position:absolute;right:-1px;bottom:-1px;border-radius:50%;
  border:2px solid var(--bg-surface);}
.apex-avatar__status--online{background:var(--up-500);}
.apex-avatar__status--idle{background:var(--warning-500);}
.apex-avatar__status--offline{background:var(--text-400);}
`;
const SIZES = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 72
};
function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

/** User/bot avatar — image, initials fallback, optional status dot. */
function Avatar({
  name,
  src,
  size = 'md',
  square = false,
  brand = false,
  status,
  className = '',
  ...rest
}) {
  ensure('apex-avatar-css', CSS);
  const px = typeof size === 'number' ? size : SIZES[size] || 40;
  const dot = Math.max(8, Math.round(px * 0.28));
  return /*#__PURE__*/React.createElement("span", _extends({
    className: ['apex-avatar', square ? 'apex-avatar--square' : '', brand ? 'apex-avatar--brand' : '', className].filter(Boolean).join(' '),
    style: {
      width: px,
      height: px,
      fontSize: Math.round(px * 0.4)
    }
  }, rest), src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: name || ''
  }) : /*#__PURE__*/React.createElement("span", null, initials(name)), status && /*#__PURE__*/React.createElement("span", {
    className: `apex-avatar__status apex-avatar__status--${status}`,
    style: {
      width: dot,
      height: dot
    }
  }));
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/layout/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/layout/Card.jsx
try { (() => {
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
.apex-card{
  display:flex;flex-direction:column;
  background:var(--bg-surface);border:1px solid var(--border);
  border-radius:var(--radius-lg);box-shadow:var(--inset-top);
  transition:border-color var(--dur-2) var(--ease-out),box-shadow var(--dur-2) var(--ease-out),transform var(--dur-2) var(--ease-out);
}
.apex-card--elevated{background:var(--bg-raised);box-shadow:var(--shadow-2),var(--inset-top);}
.apex-card--glow{border-color:var(--brand-border);box-shadow:var(--glow-brand-soft),var(--inset-top);}
.apex-card--inset{background:var(--bg-inset);}
.apex-card--interactive{cursor:pointer;}
.apex-card--interactive:hover{border-color:var(--violet-line);transform:translateY(-2px);box-shadow:var(--shadow-3);}
.apex-card__head{display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:var(--pad-card);border-bottom:1px solid var(--border);}
.apex-card__titles{display:flex;flex-direction:column;gap:2px;min-width:0;}
.apex-card__title{font-size:var(--text-h4);font-weight:var(--weight-semibold);color:var(--text-900);letter-spacing:-.01em;}
.apex-card__sub{font-size:var(--text-xs);color:var(--text-400);}
.apex-card__body{padding:var(--pad-card);}
.apex-card--flush .apex-card__body{padding:0;}
`;

/** Surface container with optional header (title/subtitle/actions). */
function Card({
  title,
  subtitle,
  actions,
  variant = 'default',
  interactive = false,
  flush = false,
  padding,
  className = '',
  children,
  ...rest
}) {
  ensure('apex-card-css', CSS);
  const hasHead = title || subtitle || actions;
  const cls = ['apex-card', variant !== 'default' ? `apex-card--${variant}` : '', interactive ? 'apex-card--interactive' : '', flush ? 'apex-card--flush' : '', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("div", _extends({
    className: cls
  }, rest), hasHead && /*#__PURE__*/React.createElement("div", {
    className: "apex-card__head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "apex-card__titles"
  }, title && /*#__PURE__*/React.createElement("span", {
    className: "apex-card__title"
  }, title), subtitle && /*#__PURE__*/React.createElement("span", {
    className: "apex-card__sub"
  }, subtitle)), actions && /*#__PURE__*/React.createElement("div", {
    className: "apex-card__actions"
  }, actions)), /*#__PURE__*/React.createElement("div", {
    className: "apex-card__body",
    style: padding != null ? {
      padding
    } : undefined
  }, children));
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/layout/Card.jsx", error: String((e && e.message) || e) }); }

// components/layout/Tabs.jsx
try { (() => {
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
.apex-tabs{display:inline-flex;align-items:center;gap:2px;font-family:var(--font-sans);}
.apex-tabs--line{gap:4px;border-bottom:1px solid var(--border);width:100%;}
.apex-tabs--pill{background:var(--bg-inset);border:1px solid var(--border);border-radius:var(--radius-md);padding:3px;}
.apex-tab{
  appearance:none;border:none;background:transparent;cursor:pointer;
  font-family:inherit;font-size:var(--text-sm);font-weight:var(--weight-medium);
  color:var(--text-500);display:inline-flex;align-items:center;gap:7px;
  transition:color var(--dur-2) var(--ease-out),background var(--dur-2) var(--ease-out);white-space:nowrap;
}
.apex-tab__count{font-family:var(--font-mono);font-size:var(--text-2xs);padding:1px 6px;border-radius:var(--radius-pill);
  background:var(--bg-elevated);color:var(--text-500);}
.apex-tab:hover{color:var(--text-900);}

.apex-tabs--pill .apex-tab{padding:7px 14px;border-radius:var(--radius-sm);}
.apex-tabs--pill .apex-tab[aria-selected="true"]{background:var(--bg-elevated);color:var(--text-900);box-shadow:var(--shadow-1);}
.apex-tabs--pill .apex-tab[aria-selected="true"] .apex-tab__count{background:var(--brand-surface);color:var(--brand-text);}

.apex-tabs--line .apex-tab{padding:11px 4px;margin-bottom:-1px;border-bottom:2px solid transparent;}
.apex-tabs--line .apex-tab[aria-selected="true"]{color:var(--text-900);border-bottom-color:var(--brand);}
.apex-tab:focus-visible{outline:none;color:var(--text-900);box-shadow:var(--ring-focus);border-radius:var(--radius-xs);}
`;

/** Tab strip. Controlled via value/onChange. variant: line | pill. */
function Tabs({
  items = [],
  value,
  onChange,
  variant = 'line',
  className = '',
  ...rest
}) {
  ensure('apex-tabs-css', CSS);
  const current = value ?? (items[0] && (typeof items[0] === 'string' ? items[0] : items[0].value));
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ['apex-tabs', `apex-tabs--${variant}`, className].filter(Boolean).join(' '),
    role: "tablist"
  }, rest), items.map(it => {
    const t = typeof it === 'string' ? {
      value: it,
      label: it
    } : it;
    const sel = t.value === current;
    return /*#__PURE__*/React.createElement("button", {
      key: t.value,
      role: "tab",
      "aria-selected": sel,
      className: "apex-tab",
      onClick: () => onChange && onChange(t.value)
    }, t.icon, t.label, t.count != null && /*#__PURE__*/React.createElement("span", {
      className: "apex-tab__count"
    }, t.count));
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/layout/Tabs.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile_app/ios-frame.jsx
try { (() => {
// @ds-adherence-ignore -- omelette starter scaffold (raw elements/hex/px by design)

/* BEGIN USAGE */
// iOS.jsx — Simplified iOS 26 (Liquid Glass) device frame
// Based on the iOS 26 UI Kit + Figma status bar spec. No assets, no deps.
// Exports (to window): IOSDevice, IOSStatusBar, IOSNavBar, IOSGlassPill, IOSList, IOSListRow, IOSKeyboard
//
// Usage — wrap your screen content in <IOSDevice> to get the bezel, status bar
// and home indicator (props: title, dark, keyboard):
//
//   <IOSDevice title="Settings">
//     ...your screen content...
//   </IOSDevice>
//   <IOSDevice dark title="Search" keyboard>…</IOSDevice>
/* END USAGE */

// ─────────────────────────────────────────────────────────────
// Status bar
// ─────────────────────────────────────────────────────────────
function IOSStatusBar({
  dark = false,
  time = '9:41'
}) {
  const c = dark ? '#fff' : '#000';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 154,
      alignItems: 'center',
      justifyContent: 'center',
      padding: '21px 24px 19px',
      boxSizing: 'border-box',
      position: 'relative',
      zIndex: 20,
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 22,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 1.5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: '-apple-system, "SF Pro", system-ui',
      fontWeight: 590,
      fontSize: 17,
      lineHeight: '22px',
      color: c
    }
  }, time)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 22,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingTop: 1,
      paddingRight: 1
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "19",
    height: "12",
    viewBox: "0 0 19 12"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "0",
    y: "7.5",
    width: "3.2",
    height: "4.5",
    rx: "0.7",
    fill: c
  }), /*#__PURE__*/React.createElement("rect", {
    x: "4.8",
    y: "5",
    width: "3.2",
    height: "7",
    rx: "0.7",
    fill: c
  }), /*#__PURE__*/React.createElement("rect", {
    x: "9.6",
    y: "2.5",
    width: "3.2",
    height: "9.5",
    rx: "0.7",
    fill: c
  }), /*#__PURE__*/React.createElement("rect", {
    x: "14.4",
    y: "0",
    width: "3.2",
    height: "12",
    rx: "0.7",
    fill: c
  })), /*#__PURE__*/React.createElement("svg", {
    width: "17",
    height: "12",
    viewBox: "0 0 17 12"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M8.5 3.2C10.8 3.2 12.9 4.1 14.4 5.6L15.5 4.5C13.7 2.7 11.2 1.5 8.5 1.5C5.8 1.5 3.3 2.7 1.5 4.5L2.6 5.6C4.1 4.1 6.2 3.2 8.5 3.2Z",
    fill: c
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8.5 6.8C9.9 6.8 11.1 7.3 12 8.2L13.1 7.1C11.8 5.9 10.2 5.1 8.5 5.1C6.8 5.1 5.2 5.9 3.9 7.1L5 8.2C5.9 7.3 7.1 6.8 8.5 6.8Z",
    fill: c
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "8.5",
    cy: "10.5",
    r: "1.5",
    fill: c
  })), /*#__PURE__*/React.createElement("svg", {
    width: "27",
    height: "13",
    viewBox: "0 0 27 13"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "0.5",
    y: "0.5",
    width: "23",
    height: "12",
    rx: "3.5",
    stroke: c,
    strokeOpacity: "0.35",
    fill: "none"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "2",
    y: "2",
    width: "20",
    height: "9",
    rx: "2",
    fill: c
  }), /*#__PURE__*/React.createElement("path", {
    d: "M25 4.5V8.5C25.8 8.2 26.5 7.2 26.5 6.5C26.5 5.8 25.8 4.8 25 4.5Z",
    fill: c,
    fillOpacity: "0.4"
  }))));
}

// ─────────────────────────────────────────────────────────────
// Liquid glass pill — blur + tint + shine
// ─────────────────────────────────────────────────────────────
function IOSGlassPill({
  children,
  dark = false,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: 44,
      minWidth: 44,
      borderRadius: 9999,
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: dark ? '0 2px 6px rgba(0,0,0,0.35), 0 6px 16px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.07), 0 3px 10px rgba(0,0,0,0.06)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 9999,
      backdropFilter: 'blur(12px) saturate(180%)',
      WebkitBackdropFilter: 'blur(12px) saturate(180%)',
      background: dark ? 'rgba(120,120,128,0.28)' : 'rgba(255,255,255,0.5)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 9999,
      boxShadow: dark ? 'inset 1.5px 1.5px 1px rgba(255,255,255,0.15), inset -1px -1px 1px rgba(255,255,255,0.08)' : 'inset 1.5px 1.5px 1px rgba(255,255,255,0.7), inset -1px -1px 1px rgba(255,255,255,0.4)',
      border: dark ? '0.5px solid rgba(255,255,255,0.15)' : '0.5px solid rgba(0,0,0,0.06)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      zIndex: 1,
      display: 'flex',
      alignItems: 'center',
      padding: '0 4px'
    }
  }, children));
}

// ─────────────────────────────────────────────────────────────
// Navigation bar — glass pills + large title
// ─────────────────────────────────────────────────────────────
function IOSNavBar({
  title = 'Title',
  dark = false,
  trailingIcon = true
}) {
  const muted = dark ? 'rgba(255,255,255,0.6)' : '#404040';
  const text = dark ? '#fff' : '#000';
  const pillIcon = content => /*#__PURE__*/React.createElement(IOSGlassPill, {
    dark: dark
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, content));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      paddingTop: 62,
      paddingBottom: 10,
      position: 'relative',
      zIndex: 5
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px'
    }
  }, pillIcon(/*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "20",
    viewBox: "0 0 12 20",
    fill: "none",
    style: {
      marginLeft: -1
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M10 2L2 10l8 8",
    stroke: muted,
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }))), trailingIcon && pillIcon(/*#__PURE__*/React.createElement("svg", {
    width: "22",
    height: "6",
    viewBox: "0 0 22 6"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "3",
    cy: "3",
    r: "2.5",
    fill: muted
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "3",
    r: "2.5",
    fill: muted
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "19",
    cy: "3",
    r: "2.5",
    fill: muted
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px',
      fontFamily: '-apple-system, system-ui',
      fontSize: 34,
      fontWeight: 700,
      lineHeight: '41px',
      color: text,
      letterSpacing: 0.4
    }
  }, title));
}

// ─────────────────────────────────────────────────────────────
// Grouped list (inset card, r:26) + row (52px)
// ─────────────────────────────────────────────────────────────
function IOSListRow({
  title,
  detail,
  icon,
  chevron = true,
  isLast = false,
  dark = false
}) {
  const text = dark ? '#fff' : '#000';
  const sec = dark ? 'rgba(235,235,245,0.6)' : 'rgba(60,60,67,0.6)';
  const ter = dark ? 'rgba(235,235,245,0.3)' : 'rgba(60,60,67,0.3)';
  const sep = dark ? 'rgba(84,84,88,0.65)' : 'rgba(60,60,67,0.12)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      minHeight: 52,
      padding: '0 16px',
      position: 'relative',
      fontFamily: '-apple-system, system-ui',
      fontSize: 17,
      letterSpacing: -0.43
    }
  }, icon && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 30,
      height: 30,
      borderRadius: 7,
      background: icon,
      marginRight: 12,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      color: text
    }
  }, title), detail && /*#__PURE__*/React.createElement("span", {
    style: {
      color: sec,
      marginRight: 6
    }
  }, detail), chevron && /*#__PURE__*/React.createElement("svg", {
    width: "8",
    height: "14",
    viewBox: "0 0 8 14",
    style: {
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M1 1l6 6-6 6",
    stroke: ter,
    strokeWidth: "2",
    fill: "none",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })), !isLast && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      left: icon ? 58 : 16,
      height: 0.5,
      background: sep
    }
  }));
}
function IOSList({
  header,
  children,
  dark = false
}) {
  const hc = dark ? 'rgba(235,235,245,0.6)' : 'rgba(60,60,67,0.6)';
  const bg = dark ? '#1C1C1E' : '#fff';
  return /*#__PURE__*/React.createElement("div", null, header && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: '-apple-system, system-ui',
      fontSize: 13,
      color: hc,
      textTransform: 'uppercase',
      padding: '8px 36px 6px',
      letterSpacing: -0.08
    }
  }, header), /*#__PURE__*/React.createElement("div", {
    style: {
      background: bg,
      borderRadius: 26,
      margin: '0 16px',
      overflow: 'hidden'
    }
  }, children));
}

// ─────────────────────────────────────────────────────────────
// Device frame
// ─────────────────────────────────────────────────────────────
function IOSDevice({
  children,
  width = 402,
  height = 874,
  dark = false,
  title,
  keyboard = false
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width,
      height,
      borderRadius: 48,
      overflow: 'hidden',
      position: 'relative',
      background: dark ? '#000' : '#F2F2F7',
      boxShadow: '0 40px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.12)',
      fontFamily: '-apple-system, system-ui, sans-serif',
      WebkitFontSmoothing: 'antialiased'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 11,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 126,
      height: 37,
      borderRadius: 24,
      background: '#000',
      zIndex: 50
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10
    }
  }, /*#__PURE__*/React.createElement(IOSStatusBar, {
    dark: dark
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }
  }, title !== undefined && /*#__PURE__*/React.createElement(IOSNavBar, {
    title: title,
    dark: dark
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: 'auto'
    }
  }, children), keyboard && /*#__PURE__*/React.createElement(IOSKeyboard, {
    dark: dark
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 60,
      height: 34,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-end',
      paddingBottom: 8,
      pointerEvents: 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 139,
      height: 5,
      borderRadius: 100,
      background: dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.25)'
    }
  })));
}

// ─────────────────────────────────────────────────────────────
// Keyboard — iOS 26 liquid glass
// ─────────────────────────────────────────────────────────────
function IOSKeyboard({
  dark = false
}) {
  const glyph = dark ? 'rgba(255,255,255,0.7)' : '#595959';
  const sugg = dark ? 'rgba(255,255,255,0.6)' : '#333';
  const keyBg = dark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.85)';

  // special-key icons
  const icons = {
    shift: /*#__PURE__*/React.createElement("svg", {
      width: "19",
      height: "17",
      viewBox: "0 0 19 17"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M9.5 1L1 9.5h4.5V16h8V9.5H18L9.5 1z",
      fill: glyph
    })),
    del: /*#__PURE__*/React.createElement("svg", {
      width: "23",
      height: "17",
      viewBox: "0 0 23 17"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M7 1h13a2 2 0 012 2v11a2 2 0 01-2 2H7l-6-7.5L7 1z",
      fill: "none",
      stroke: glyph,
      strokeWidth: "1.6",
      strokeLinejoin: "round"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M10 5l7 7M17 5l-7 7",
      stroke: glyph,
      strokeWidth: "1.6",
      strokeLinecap: "round"
    })),
    ret: /*#__PURE__*/React.createElement("svg", {
      width: "20",
      height: "14",
      viewBox: "0 0 20 14"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M18 1v6H4m0 0l4-4M4 7l4 4",
      fill: "none",
      stroke: "#fff",
      strokeWidth: "1.8",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }))
  };
  const key = (content, {
    w,
    flex,
    ret,
    fs = 25,
    k
  } = {}) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      height: 42,
      borderRadius: 8.5,
      flex: flex ? 1 : undefined,
      width: w,
      minWidth: 0,
      background: ret ? '#08f' : keyBg,
      boxShadow: '0 1px 0 rgba(0,0,0,0.075)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, "SF Compact", system-ui',
      fontSize: fs,
      fontWeight: 458,
      color: ret ? '#fff' : glyph
    }
  }, content);
  const row = (keys, pad = 0) => /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6.5,
      justifyContent: 'center',
      padding: `0 ${pad}px`
    }
  }, keys.map(l => key(l, {
    flex: true,
    k: l
  })));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      zIndex: 15,
      borderRadius: 27,
      overflow: 'hidden',
      padding: '11px 0 2px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      boxShadow: dark ? '0 -2px 20px rgba(0,0,0,0.09)' : '0 -1px 6px rgba(0,0,0,0.018), 0 -3px 20px rgba(0,0,0,0.012)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 27,
      backdropFilter: 'blur(12px) saturate(180%)',
      WebkitBackdropFilter: 'blur(12px) saturate(180%)',
      background: dark ? 'rgba(120,120,128,0.14)' : 'rgba(255,255,255,0.25)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 27,
      boxShadow: dark ? 'inset 1.5px 1.5px 1px rgba(255,255,255,0.15)' : 'inset 1.5px 1.5px 1px rgba(255,255,255,0.7), inset -1px -1px 1px rgba(255,255,255,0.4)',
      border: dark ? '0.5px solid rgba(255,255,255,0.15)' : '0.5px solid rgba(0,0,0,0.06)',
      pointerEvents: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 20,
      alignItems: 'center',
      padding: '8px 22px 13px',
      width: '100%',
      boxSizing: 'border-box',
      position: 'relative'
    }
  }, ['"The"', 'the', 'to'].map((w, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, i > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 1,
      height: 25,
      background: '#ccc',
      opacity: 0.3
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      textAlign: 'center',
      fontFamily: '-apple-system, system-ui',
      fontSize: 17,
      color: sugg,
      letterSpacing: -0.43,
      lineHeight: '22px'
    }
  }, w)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 13,
      padding: '0 6.5px',
      width: '100%',
      boxSizing: 'border-box',
      position: 'relative'
    }
  }, row(['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p']), row(['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'], 20), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14.25,
      alignItems: 'center'
    }
  }, key(icons.shift, {
    w: 45,
    k: 'shift'
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6.5,
      flex: 1
    }
  }, ['z', 'x', 'c', 'v', 'b', 'n', 'm'].map(l => key(l, {
    flex: true,
    k: l
  }))), key(icons.del, {
    w: 45,
    k: 'del'
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      alignItems: 'center'
    }
  }, key('ABC', {
    w: 92.25,
    fs: 18,
    k: 'abc'
  }), key('', {
    flex: true,
    k: 'space'
  }), key(icons.ret, {
    w: 92.25,
    ret: true,
    k: 'ret'
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 56,
      width: '100%',
      position: 'relative'
    }
  }));
}
Object.assign(window, {
  IOSDevice,
  IOSStatusBar,
  IOSNavBar,
  IOSGlassPill,
  IOSList,
  IOSListRow,
  IOSKeyboard
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile_app/ios-frame.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile_app/screens.jsx
try { (() => {
/* Apex Trader UI kit — mobile app screens. Rendered inside IOSDevice (dark). */
(function () {
  const DS = window.ApexTraderDesignSystem_cd55a5;
  const {
    Icon,
    PriceChange,
    Sparkline,
    Badge,
    Tag,
    Button,
    Avatar,
    Switch
  } = DS;
  const A = window.APEX;
  function MiniArea({
    data,
    color = 'var(--brand)',
    height = 92
  }) {
    const w = 360,
      pad = 4;
    const min = Math.min(...data),
      max = Math.max(...data),
      range = max - min || 1;
    const sx = (w - pad * 2) / (data.length - 1);
    const pts = data.map((v, i) => [pad + i * sx, height - pad - (v - min) / range * (height - pad * 2)]);
    const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const area = `${line} L${pts[pts.length - 1][0]},${height} L${pts[0][0]},${height} Z`;
    return /*#__PURE__*/React.createElement("svg", {
      width: "100%",
      viewBox: `0 0 ${w} ${height}`,
      preserveAspectRatio: "none",
      style: {
        display: 'block'
      }
    }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
      id: "mba",
      x1: "0",
      y1: "0",
      x2: "0",
      y2: "1"
    }, /*#__PURE__*/React.createElement("stop", {
      offset: "0",
      stopColor: color,
      stopOpacity: "0.35"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "1",
      stopColor: color,
      stopOpacity: "0"
    }))), /*#__PURE__*/React.createElement("path", {
      d: area,
      fill: "url(#mba)"
    }), /*#__PURE__*/React.createElement("path", {
      d: line,
      stroke: color,
      strokeWidth: "2.5",
      fill: "none",
      strokeLinejoin: "round",
      strokeLinecap: "round"
    }));
  }
  const Section = ({
    children,
    style
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px',
      ...style
    }
  }, children);
  const H = ({
    children,
    action
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '20px 16px 10px'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      font: '600 18px var(--font-sans)',
      color: 'var(--text-900)',
      letterSpacing: '-0.01em'
    }
  }, children), action);
  function AssetRow({
    c,
    balance
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 38,
        height: 38,
        borderRadius: '50%',
        flex: 'none',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        font: '600 13px var(--font-mono)',
        color: 'var(--text-700)'
      }
    }, c.sym[0]), /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        font: '600 14px var(--font-mono)',
        color: 'var(--text-900)'
      }
    }, c.sym), /*#__PURE__*/React.createElement("div", {
      style: {
        font: '12px var(--font-sans)',
        color: 'var(--text-400)'
      }
    }, c.name)), /*#__PURE__*/React.createElement(Sparkline, {
      data: c.spark,
      width: 48,
      height: 26,
      fill: false
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        marginLeft: 'auto',
        textAlign: 'right'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        font: '14px var(--font-mono)',
        color: 'var(--text-900)'
      }
    }, "$", A.fmtPrice(c.price)), /*#__PURE__*/React.createElement(PriceChange, {
      value: c.chg,
      percent: true,
      size: "sm",
      showArrow: false
    })));
  }
  function Home() {
    const [tf, setTf] = React.useState('1W');
    const actions = [['plus', 'Deposit'], ['arrow-up-right', 'Send'], ['repeat', 'Trade'], ['bot', 'Bots']];
    return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px 4px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 9
      }
    }, /*#__PURE__*/React.createElement("img", {
      src: "../../assets/logo-mark.svg",
      width: "28",
      height: "28",
      alt: ""
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        font: '700 16px var(--font-sans)',
        color: 'var(--text-900)',
        letterSpacing: '-0.02em'
      }
    }, "APEX")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 38,
        height: 38,
        borderRadius: '50%',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-500)'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "bell",
      size: 18
    })), /*#__PURE__*/React.createElement(Avatar, {
      name: "Maya Chen",
      size: 38,
      status: "online"
    }))), /*#__PURE__*/React.createElement(Section, {
      style: {
        marginTop: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        border: '1px solid var(--brand-border)',
        background: 'linear-gradient(170deg, var(--violet-soft), transparent 60%), var(--bg-surface)',
        borderRadius: 'var(--radius-xl)',
        padding: 18,
        boxShadow: 'var(--glow-brand-soft)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        font: '11px var(--font-sans)',
        letterSpacing: '.1em',
        textTransform: 'uppercase',
        color: 'var(--text-400)'
      }
    }, "Total balance"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        marginTop: 5
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        font: '700 30px var(--font-mono)',
        color: 'var(--text-900)',
        letterSpacing: '-0.02em'
      }
    }, "$48,210.34")), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 6
      }
    }, /*#__PURE__*/React.createElement(PriceChange, {
      value: 2.41,
      percent: true,
      pill: true,
      size: "sm"
    }), " ", /*#__PURE__*/React.createElement("span", {
      style: {
        font: '12px var(--font-mono)',
        color: 'var(--up-500)',
        marginLeft: 4
      }
    }, "+$1,204 this week")), /*#__PURE__*/React.createElement("div", {
      style: {
        margin: '8px -4px 0'
      }
    }, /*#__PURE__*/React.createElement(MiniArea, {
      data: A.equity
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 6,
        marginTop: 6
      }
    }, ['1D', '1W', '1M', '1Y'].map(t => /*#__PURE__*/React.createElement("button", {
      key: t,
      onClick: () => setTf(t),
      style: {
        flex: 1,
        padding: '6px',
        border: 'none',
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
        font: '600 12px var(--font-mono)',
        background: tf === t ? 'var(--brand-surface)' : 'transparent',
        color: tf === t ? 'var(--brand-text)' : 'var(--text-500)'
      }
    }, t))))), /*#__PURE__*/React.createElement(Section, {
      style: {
        marginTop: 16
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4,1fr)',
        gap: 8
      }
    }, actions.map(([ic, lb]) => /*#__PURE__*/React.createElement("button", {
      key: lb,
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 7,
        padding: '14px 4px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        cursor: 'pointer',
        color: 'var(--text-700)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--brand-text)'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: ic,
      size: 20
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        font: '11px var(--font-sans)',
        color: 'var(--text-700)'
      }
    }, lb))))), /*#__PURE__*/React.createElement(H, {
      action: /*#__PURE__*/React.createElement("span", {
        style: {
          font: '13px var(--font-sans)',
          color: 'var(--brand-text)'
        }
      }, "See all")
    }, "Your assets"), /*#__PURE__*/React.createElement("div", {
      style: {
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        margin: '0 16px',
        overflow: 'hidden'
      }
    }, A.coins.slice(0, 4).map((c, i) => /*#__PURE__*/React.createElement("div", {
      key: c.sym,
      style: {
        borderTop: i ? '1px solid var(--border-soft)' : 'none'
      }
    }, /*#__PURE__*/React.createElement(AssetRow, {
      c: c
    })))));
  }
  function Markets() {
    const [seg, setSeg] = React.useState('Hot');
    return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Section, {
      style: {
        paddingTop: 8
      }
    }, /*#__PURE__*/React.createElement("label", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        height: 42,
        padding: '0 13px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        color: 'var(--text-400)'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "search",
      size: 18
    }), /*#__PURE__*/React.createElement("input", {
      placeholder: "Search coins",
      style: {
        border: 'none',
        outline: 'none',
        background: 'transparent',
        color: 'var(--text-900)',
        font: '15px var(--font-sans)',
        width: '100%'
      }
    }))), /*#__PURE__*/React.createElement(Section, {
      style: {
        marginTop: 14
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8
      }
    }, ['Hot', 'Gainers', 'Losers', 'New'].map(s => /*#__PURE__*/React.createElement(Tag, {
      key: s,
      clickable: true,
      selected: seg === s,
      onClick: () => setSeg(s)
    }, s)))), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 8
      }
    }, A.coins.map((c, i) => /*#__PURE__*/React.createElement("div", {
      key: c.sym,
      style: {
        borderTop: i ? '1px solid var(--border-soft)' : 'none'
      }
    }, /*#__PURE__*/React.createElement(AssetRow, {
      c: c
    })))));
  }
  function BotRow({
    b
  }) {
    const [on, setOn] = React.useState(b.status === 'live');
    return /*#__PURE__*/React.createElement("div", {
      style: {
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: 14,
        margin: '0 16px 10px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 11
      }
    }, /*#__PURE__*/React.createElement(Avatar, {
      name: b.name,
      square: true,
      brand: true
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        font: '600 14px var(--font-sans)',
        color: 'var(--text-900)'
      }
    }, b.name), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginTop: 2
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        font: '12px var(--font-mono)',
        color: 'var(--text-500)'
      }
    }, b.pair), /*#__PURE__*/React.createElement(Badge, {
      tone: on ? 'up' : 'neutral',
      dot: true
    }, on ? 'Live' : 'Paused'))), /*#__PURE__*/React.createElement(Switch, {
      checked: on,
      onChange: e => setOn(e.target.checked),
      size: "sm"
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        marginTop: 12
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        font: '10px var(--font-sans)',
        letterSpacing: '.08em',
        textTransform: 'uppercase',
        color: 'var(--text-400)'
      }
    }, "30d"), /*#__PURE__*/React.createElement("div", {
      style: {
        font: '600 18px var(--font-mono)',
        color: b.pnl >= 0 ? 'var(--up-500)' : 'var(--down-500)'
      }
    }, b.pnl >= 0 ? '+' : '−', Math.abs(b.pnl).toFixed(1), "%")), /*#__PURE__*/React.createElement(Sparkline, {
      data: b.spark,
      width: 96,
      height: 34,
      tone: b.pnl >= 0 ? 'up' : 'down'
    })));
  }
  function Bots() {
    return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(H, {
      action: /*#__PURE__*/React.createElement("span", {
        style: {
          color: 'var(--brand-text)'
        }
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "plus",
        size: 20
      }))
    }, "AI Bots"), /*#__PURE__*/React.createElement(Section, {
      style: {
        marginBottom: 14
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        border: '1px solid var(--brand-border)',
        background: 'var(--violet-soft)',
        borderRadius: 'var(--radius-lg)',
        padding: 14,
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--brand-text)'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "sparkles",
      size: 22
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        font: '600 14px var(--font-sans)',
        color: 'var(--text-900)'
      }
    }, "Build with Copilot"), /*#__PURE__*/React.createElement("div", {
      style: {
        font: '12px var(--font-sans)',
        color: 'var(--text-500)'
      }
    }, "Describe a strategy in plain English")), /*#__PURE__*/React.createElement(Icon, {
      name: "chevron-right",
      size: 18
    }))), A.bots.map(b => /*#__PURE__*/React.createElement(BotRow, {
      key: b.name,
      b: b
    })));
  }
  function Wallet() {
    return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(H, null, "Wallet"), /*#__PURE__*/React.createElement(Section, null, /*#__PURE__*/React.createElement("div", {
      style: {
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: 18,
        textAlign: 'center'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        font: '11px var(--font-sans)',
        letterSpacing: '.1em',
        textTransform: 'uppercase',
        color: 'var(--text-400)'
      }
    }, "Available \xB7 USDT"), /*#__PURE__*/React.createElement("div", {
      style: {
        font: '700 28px var(--font-mono)',
        color: 'var(--text-900)',
        margin: '6px 0 14px'
      }
    }, "$5,785.40"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      block: true,
      iconLeft: /*#__PURE__*/React.createElement(Icon, {
        name: "plus",
        size: 16
      })
    }, "Deposit"), /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      block: true,
      iconLeft: /*#__PURE__*/React.createElement(Icon, {
        name: "arrow-up-right",
        size: 16
      })
    }, "Withdraw")))), /*#__PURE__*/React.createElement(H, null, "Holdings"), /*#__PURE__*/React.createElement("div", {
      style: {
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        margin: '0 16px',
        overflow: 'hidden'
      }
    }, A.coins.slice(0, 5).map((c, i) => /*#__PURE__*/React.createElement("div", {
      key: c.sym,
      style: {
        borderTop: i ? '1px solid var(--border-soft)' : 'none'
      }
    }, /*#__PURE__*/React.createElement(AssetRow, {
      c: c
    })))));
  }
  const TABS = [['home', 'Home', 'home'], ['markets', 'Markets', 'candlestick'], ['bots', 'Bots', 'bot'], ['wallet', 'Wallet', 'wallet']];
  const SCREENS = {
    home: Home,
    markets: Markets,
    bots: Bots,
    wallet: Wallet
  };
  function MobileApp({
    initialTab = 'home'
  }) {
    const [tab, setTab] = React.useState(initialTab);
    const Screen = SCREENS[tab];
    return /*#__PURE__*/React.createElement("div", {
      style: {
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-app)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        overflowY: 'auto',
        paddingTop: 50,
        paddingBottom: 8
      }
    }, /*#__PURE__*/React.createElement(Screen, null)), /*#__PURE__*/React.createElement("nav", {
      style: {
        flex: 'none',
        display: 'flex',
        borderTop: '1px solid var(--border)',
        background: 'rgba(13,15,21,0.85)',
        backdropFilter: 'blur(12px)',
        padding: '8px 8px 30px'
      }
    }, TABS.map(([id, label, ic]) => {
      const on = tab === id;
      return /*#__PURE__*/React.createElement("button", {
        key: id,
        onClick: () => setTab(id),
        style: {
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          padding: '6px 0',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          color: on ? 'var(--brand-text)' : 'var(--text-500)'
        }
      }, /*#__PURE__*/React.createElement(Icon, {
        name: ic,
        size: 22,
        strokeWidth: on ? 2.4 : 2
      }), /*#__PURE__*/React.createElement("span", {
        style: {
          font: `${on ? 600 : 500} 10px var(--font-sans)`
        }
      }, label));
    })));
  }
  window.MobileApp = MobileApp;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile_app/screens.jsx", error: String((e && e.message) || e) }); }

// ui_kits/trading_app/Bots.jsx
try { (() => {
/* Apex Trader UI kit — AI Bots screen. */
(function () {
  const DS = window.ApexTraderDesignSystem_cd55a5;
  const {
    Card,
    Button,
    Badge,
    Tag,
    PriceChange,
    Sparkline,
    Switch,
    Icon,
    IconButton,
    Avatar,
    StatCard
  } = DS;
  const A = window.APEX;
  function Copilot() {
    return /*#__PURE__*/React.createElement(Card, {
      variant: "glow"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start'
      }
    }, /*#__PURE__*/React.createElement(Avatar, {
      name: "AI",
      square: true,
      brand: true,
      size: "lg"
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        font: '600 16px var(--font-sans)',
        color: 'var(--text-900)'
      }
    }, "Apex Copilot"), /*#__PURE__*/React.createElement(Badge, {
      tone: "brand",
      solid: true
    }, "Beta")), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: '5px 0 14px',
        font: '13px var(--font-sans)',
        color: 'var(--text-500)',
        lineHeight: 1.5
      }
    }, "Describe a strategy and Copilot builds, backtests and deploys it. Try \u201CBuy the dip on ETH when RSI < 30, take profit at +4%.\u201D"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        background: 'var(--bg-inset)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '6px 6px 6px 14px'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "sparkles",
      size: 18
    }), /*#__PURE__*/React.createElement("input", {
      placeholder: "Describe your strategy\u2026",
      style: {
        flex: 1,
        border: 'none',
        outline: 'none',
        background: 'transparent',
        color: 'var(--text-900)',
        font: '14px var(--font-sans)'
      }
    }), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      iconRight: /*#__PURE__*/React.createElement(Icon, {
        name: "arrow-up-right",
        size: 16
      })
    }, "Generate")))));
  }
  function BotCard({
    bot
  }) {
    const [on, setOn] = React.useState(bot.status === 'live');
    return /*#__PURE__*/React.createElement(Card, {
      interactive: true
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 11
      }
    }, /*#__PURE__*/React.createElement(Avatar, {
      name: bot.name,
      square: true,
      brand: true
    }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        font: '600 15px var(--font-sans)',
        color: 'var(--text-900)'
      }
    }, bot.name), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginTop: 3
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        font: '12px var(--font-mono)',
        color: 'var(--text-500)'
      }
    }, bot.pair), /*#__PURE__*/React.createElement(Tag, {
      size: "sm"
    }, bot.tag)))), /*#__PURE__*/React.createElement(Switch, {
      checked: on,
      onChange: e => setOn(e.target.checked),
      size: "sm"
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        margin: '16px 0 4px'
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        font: '10px var(--font-sans)',
        letterSpacing: '.1em',
        textTransform: 'uppercase',
        color: 'var(--text-400)'
      }
    }, "30d return"), /*#__PURE__*/React.createElement("div", {
      style: {
        font: '600 24px var(--font-mono)',
        color: bot.pnl >= 0 ? 'var(--up-500)' : 'var(--down-500)',
        letterSpacing: '-0.02em'
      }
    }, bot.pnl >= 0 ? '+' : '−', Math.abs(bot.pnl).toFixed(1), "%")), /*#__PURE__*/React.createElement(Sparkline, {
      data: bot.spark,
      width: 110,
      height: 40,
      tone: bot.pnl >= 0 ? 'up' : 'down'
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3,1fr)',
        gap: 8,
        padding: '14px 0',
        margin: '12px 0',
        borderTop: '1px solid var(--border-soft)',
        borderBottom: '1px solid var(--border-soft)'
      }
    }, [['Allocated', '$' + A.fmt(bot.alloc, 0)], ['Trades', bot.trades], ['Win rate', bot.win + '%']].map(([k, v]) => /*#__PURE__*/React.createElement("div", {
      key: k
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        font: '10px var(--font-sans)',
        letterSpacing: '.08em',
        textTransform: 'uppercase',
        color: 'var(--text-400)'
      }
    }, k), /*#__PURE__*/React.createElement("div", {
      style: {
        font: '13px var(--font-mono)',
        color: 'var(--text-900)',
        marginTop: 2
      }
    }, v)))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(Badge, {
      tone: on ? 'up' : 'neutral',
      dot: true
    }, on ? 'Live' : 'Paused'), /*#__PURE__*/React.createElement("span", {
      style: {
        font: '11px var(--font-sans)',
        color: 'var(--text-400)'
      }
    }, "\xB7 ", bot.risk, " risk"), /*#__PURE__*/React.createElement("div", {
      style: {
        marginLeft: 'auto',
        display: 'flex',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "ghost",
      iconLeft: /*#__PURE__*/React.createElement(Icon, {
        name: "sliders",
        size: 14
      })
    }, "Tune"), /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "secondary"
    }, "Details"))));
  }
  function Bots() {
    const live = A.bots.filter(b => b.status === 'live').length;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 16
      }
    }, /*#__PURE__*/React.createElement(Copilot, null), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4,1fr)',
        gap: 14
      }
    }, /*#__PURE__*/React.createElement(StatCard, {
      label: "Bots running",
      value: live,
      unit: `/ ${A.bots.length}`,
      icon: /*#__PURE__*/React.createElement(Icon, {
        name: "bot",
        size: 16
      })
    }), /*#__PURE__*/React.createElement(StatCard, {
      label: "Capital deployed",
      value: "$15.2K",
      delta: 4.4
    }), /*#__PURE__*/React.createElement(StatCard, {
      label: "Total bot P&L",
      value: "+$842",
      delta: 5.1
    }), /*#__PURE__*/React.createElement(StatCard, {
      label: "Avg win rate",
      value: "71",
      unit: "%",
      delta: 1.8
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }
    }, /*#__PURE__*/React.createElement("h2", {
      style: {
        font: '600 17px var(--font-sans)',
        color: 'var(--text-900)'
      }
    }, "Your strategies"), /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      iconLeft: /*#__PURE__*/React.createElement(Icon, {
        name: "plus",
        size: 16
      })
    }, "New strategy")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 14
      }
    }, A.bots.map(b => /*#__PURE__*/React.createElement(BotCard, {
      key: b.name,
      bot: b
    }))));
  }
  window.Bots = Bots;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/trading_app/Bots.jsx", error: String((e && e.message) || e) }); }

// ui_kits/trading_app/Chart.jsx
try { (() => {
/* Apex Trader UI kit — chart visualizations (SVG, kit-level). */

function AreaChart({
  data,
  width = 760,
  height = 240,
  color = 'var(--brand)',
  animate = true
}) {
  const pad = 6;
  const min = Math.min(...data),
    max = Math.max(...data);
  const range = max - min || 1;
  const stepX = (width - pad * 2) / (data.length - 1);
  const pts = data.map((v, i) => [pad + i * stepX, height - pad - (v - min) / range * (height - pad * 2)]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1][0]},${height} L${pts[0][0]},${height} Z`;
  const gid = 'ac' + Math.round(min);
  const last = pts[pts.length - 1];
  return /*#__PURE__*/React.createElement("svg", {
    width: "100%",
    viewBox: `0 0 ${width} ${height}`,
    fill: "none",
    preserveAspectRatio: "none",
    style: {
      display: 'block'
    }
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: gid,
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0",
    stopColor: color,
    stopOpacity: "0.28"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "1",
    stopColor: color,
    stopOpacity: "0"
  }))), [0.25, 0.5, 0.75].map(g => /*#__PURE__*/React.createElement("line", {
    key: g,
    x1: "0",
    x2: width,
    y1: height * g,
    y2: height * g,
    stroke: "var(--line-soft)",
    strokeWidth: "1"
  })), /*#__PURE__*/React.createElement("path", {
    d: area,
    fill: `url(#${gid})`
  }), /*#__PURE__*/React.createElement("path", {
    d: line,
    stroke: color,
    strokeWidth: "2.25",
    strokeLinejoin: "round",
    strokeLinecap: "round",
    style: animate ? {
      strokeDasharray: 3000,
      strokeDashoffset: 3000,
      animation: 'apex-draw 1.1s var(--ease-out) forwards'
    } : undefined
  }), /*#__PURE__*/React.createElement("circle", {
    cx: last[0],
    cy: last[1],
    r: "4",
    fill: color
  }), /*#__PURE__*/React.createElement("circle", {
    cx: last[0],
    cy: last[1],
    r: "8",
    fill: color,
    opacity: "0.2"
  }));
}
function CandleChart({
  candles,
  width = 760,
  height = 300
}) {
  const pad = 8;
  const hi = Math.max(...candles.map(c => c.h));
  const lo = Math.min(...candles.map(c => c.l));
  const range = hi - lo || 1;
  const y = v => pad + (1 - (v - lo) / range) * (height - pad * 2);
  const slot = (width - pad * 2) / candles.length;
  const cw = Math.max(3, slot * 0.58);
  return /*#__PURE__*/React.createElement("svg", {
    width: "100%",
    viewBox: `0 0 ${width} ${height}`,
    fill: "none",
    style: {
      display: 'block'
    }
  }, [0.2, 0.4, 0.6, 0.8].map(g => /*#__PURE__*/React.createElement("line", {
    key: g,
    x1: "0",
    x2: width,
    y1: height * g,
    y2: height * g,
    stroke: "var(--line-soft)",
    strokeWidth: "1"
  })), candles.map((c, i) => {
    const x = pad + i * slot + slot / 2;
    const up = c.c >= c.o;
    const col = up ? 'var(--up-500)' : 'var(--down-500)';
    const yo = y(c.o),
      yc = y(c.c);
    const top = Math.min(yo, yc);
    const bh = Math.max(2, Math.abs(yc - yo));
    return /*#__PURE__*/React.createElement("g", {
      key: i,
      style: {
        opacity: 0,
        animation: `apex-fade .5s var(--ease-out) forwards`,
        animationDelay: `${i * 12}ms`
      }
    }, /*#__PURE__*/React.createElement("line", {
      x1: x,
      x2: x,
      y1: y(c.h),
      y2: y(c.l),
      stroke: col,
      strokeWidth: "1.4"
    }), /*#__PURE__*/React.createElement("rect", {
      x: x - cw / 2,
      y: top,
      width: cw,
      height: bh,
      rx: "1.5",
      fill: col
    }));
  }));
}
function Donut({
  data,
  size = 168,
  thickness = 22
}) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: `0 0 ${size} ${size}`
  }, /*#__PURE__*/React.createElement("g", {
    transform: `rotate(-90 ${size / 2} ${size / 2})`
  }, data.map((d, i) => {
    const len = d.pct / 100 * c;
    const seg = /*#__PURE__*/React.createElement("circle", {
      key: i,
      cx: size / 2,
      cy: size / 2,
      r: r,
      fill: "none",
      stroke: d.color,
      strokeWidth: thickness,
      strokeDasharray: `${len} ${c - len}`,
      strokeDashoffset: -offset,
      strokeLinecap: "butt"
    });
    offset += len;
    return seg;
  })));
}
Object.assign(window, {
  AreaChart,
  CandleChart,
  Donut
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/trading_app/Chart.jsx", error: String((e && e.message) || e) }); }

// ui_kits/trading_app/Dashboard.jsx
try { (() => {
/* Apex Trader UI kit — Dashboard screen. */
(function () {
  const DS = window.ApexTraderDesignSystem_cd55a5;
  const {
    StatCard,
    Card,
    Tabs,
    Button,
    Input,
    Tag,
    Badge,
    PriceChange,
    Sparkline,
    Icon,
    IconButton
  } = DS;
  const {
    CandleChart
  } = window;
  const A = window.APEX;
  function ChartPanel() {
    const [tf, setTf] = React.useState('1D');
    const [pair, setPair] = React.useState('BTC/USDT');
    const coin = A.coins[0];
    return /*#__PURE__*/React.createElement(Card, {
      flush: true
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '16px 18px',
        borderBottom: '1px solid var(--border)',
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 11
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 34,
        height: 34,
        borderRadius: '50%',
        background: 'var(--brand-surface)',
        border: '1px solid var(--brand-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--brand-text)',
        font: '700 13px var(--font-mono)'
      }
    }, "\u20BF"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        font: '600 16px var(--font-sans)',
        color: 'var(--text-900)'
      }
    }, pair), /*#__PURE__*/React.createElement(Badge, {
      tone: "neutral"
    }, "Spot")), /*#__PURE__*/React.createElement("span", {
      style: {
        font: '11px var(--font-sans)',
        color: 'var(--text-400)'
      }
    }, "Bitcoin"))), /*#__PURE__*/React.createElement("div", {
      style: {
        marginLeft: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        font: '600 24px var(--font-mono)',
        color: 'var(--text-900)',
        letterSpacing: '-0.02em'
      }
    }, "$", A.fmt(coin.price)), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 10
      }
    }, /*#__PURE__*/React.createElement(PriceChange, {
      value: coin.chg,
      percent: true
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        marginLeft: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(Tabs, {
      variant: "pill",
      items: ['15m', '1H', '4H', '1D', '1W'],
      value: tf,
      onChange: setTf
    }), /*#__PURE__*/React.createElement(IconButton, {
      label: "Indicators"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "sliders",
      size: 18
    })), /*#__PURE__*/React.createElement(IconButton, {
      label: "Expand"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "external-link",
      size: 18
    })))), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '10px 8px 4px'
      }
    }, /*#__PURE__*/React.createElement(CandleChart, {
      candles: A.candles,
      height: 264
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 22,
        padding: '6px 18px 16px',
        font: '12px var(--font-mono)',
        color: 'var(--text-500)'
      }
    }, /*#__PURE__*/React.createElement("span", null, "O ", /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--text-700)'
      }
    }, "66,980")), /*#__PURE__*/React.createElement("span", null, "H ", /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--up-500)'
      }
    }, "67,840")), /*#__PURE__*/React.createElement("span", null, "L ", /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--down-500)'
      }
    }, "66,210")), /*#__PURE__*/React.createElement("span", null, "Vol ", /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--text-700)'
      }
    }, "1.84B"))));
  }
  function OrderPanel() {
    const [side, setSide] = React.useState('buy');
    const [amt, setAmt] = React.useState('0.25');
    const buy = side === 'buy';
    return /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 6,
        padding: 4,
        background: 'var(--bg-inset)',
        borderRadius: 'var(--radius-md)',
        marginBottom: 16
      }
    }, ['buy', 'sell'].map(s => /*#__PURE__*/React.createElement("button", {
      key: s,
      onClick: () => setSide(s),
      style: {
        padding: '9px',
        border: 'none',
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
        font: '600 13px var(--font-sans)',
        textTransform: 'capitalize',
        background: side === s ? s === 'buy' ? 'var(--up-soft)' : 'var(--down-soft)' : 'transparent',
        color: side === s ? s === 'buy' ? 'var(--up-500)' : 'var(--down-500)' : 'var(--text-500)',
        boxShadow: side === s ? `inset 0 0 0 1px ${s === 'buy' ? 'var(--up-line)' : 'var(--down-line)'}` : 'none'
      }
    }, s))), /*#__PURE__*/React.createElement(Tabs, {
      variant: "line",
      items: ['Market', 'Limit', 'Stop'],
      value: "Market",
      onChange: () => {}
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 13,
        marginTop: 16
      }
    }, /*#__PURE__*/React.createElement(Input, {
      label: "Price",
      mono: true,
      suffix: "USDT",
      defaultValue: "Market",
      disabled: true
    }), /*#__PURE__*/React.createElement(Input, {
      label: "Amount",
      mono: true,
      suffix: "BTC",
      value: amt,
      onChange: e => setAmt(e.target.value)
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 6
      }
    }, ['25%', '50%', '75%', 'Max'].map(p => /*#__PURE__*/React.createElement(Tag, {
      key: p,
      clickable: true,
      size: "sm"
    }, p))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        font: '12px var(--font-sans)',
        color: 'var(--text-500)'
      }
    }, /*#__PURE__*/React.createElement("span", null, "Order value"), /*#__PURE__*/React.createElement("span", {
      style: {
        font: '12px var(--font-mono)',
        color: 'var(--text-900)'
      }
    }, "$", A.fmt(0.25 * A.coins[0].price))), /*#__PURE__*/React.createElement(Button, {
      variant: buy ? 'success' : 'danger',
      block: true,
      size: "lg"
    }, buy ? 'Buy' : 'Sell', " BTC")));
  }
  function Watchlist() {
    return /*#__PURE__*/React.createElement(Card, {
      title: "Watchlist",
      actions: /*#__PURE__*/React.createElement(IconButton, {
        label: "Add"
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "plus",
        size: 16
      }))
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        margin: '0 -6px'
      }
    }, A.coins.slice(0, 6).map(c => /*#__PURE__*/React.createElement("div", {
      key: c.sym,
      className: "apex-hoverrow",
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 6px',
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        font: '600 12px var(--font-mono)',
        color: 'var(--text-900)',
        width: 44
      }
    }, c.sym), /*#__PURE__*/React.createElement(Sparkline, {
      data: c.spark,
      width: 64,
      height: 22,
      fill: false
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        marginLeft: 'auto',
        textAlign: 'right'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        font: '13px var(--font-mono)',
        color: 'var(--text-900)'
      }
    }, "$", A.fmtPrice(c.price)), /*#__PURE__*/React.createElement(PriceChange, {
      value: c.chg,
      percent: true,
      size: "sm",
      showArrow: false
    }))))));
  }
  function Positions() {
    const cols = ['Asset', 'Side', 'Size', 'Entry', 'Mark', 'PnL'];
    return /*#__PURE__*/React.createElement(Card, {
      title: "Open positions",
      subtitle: "4 active",
      flush: true,
      actions: /*#__PURE__*/React.createElement(Tabs, {
        variant: "line",
        items: [{
          value: 'p',
          label: 'Positions',
          count: 4
        }, {
          value: 'o',
          label: 'Orders',
          count: 2
        }, {
          value: 'h',
          label: 'History'
        }],
        value: "p",
        onChange: () => {}
      })
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        overflowX: 'auto'
      }
    }, /*#__PURE__*/React.createElement("table", {
      style: {
        width: '100%',
        borderCollapse: 'collapse',
        font: '13px var(--font-sans)'
      }
    }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, cols.map((c, i) => /*#__PURE__*/React.createElement("th", {
      key: c,
      style: {
        textAlign: i > 1 ? 'right' : 'left',
        padding: '10px 18px',
        font: '500 11px var(--font-sans)',
        letterSpacing: '.06em',
        textTransform: 'uppercase',
        color: 'var(--text-400)',
        borderBottom: '1px solid var(--border)'
      }
    }, c)), /*#__PURE__*/React.createElement("th", {
      style: {
        borderBottom: '1px solid var(--border)'
      }
    }))), /*#__PURE__*/React.createElement("tbody", null, A.positions.map(p => /*#__PURE__*/React.createElement("tr", {
      key: p.sym,
      style: {
        borderBottom: '1px solid var(--border-soft)'
      }
    }, /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '13px 18px'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        font: '600 13px var(--font-mono)',
        color: 'var(--text-900)'
      }
    }, p.sym), /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--text-400)',
        marginLeft: 4
      }
    }, "/USDT")), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '13px 18px'
      }
    }, /*#__PURE__*/React.createElement(Badge, {
      tone: p.side === 'Long' ? 'up' : 'down'
    }, p.side)), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '13px 18px',
        textAlign: 'right',
        font: '13px var(--font-mono)',
        color: 'var(--text-700)'
      }
    }, p.qty), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '13px 18px',
        textAlign: 'right',
        font: '13px var(--font-mono)',
        color: 'var(--text-700)'
      }
    }, "$", A.fmt(p.entry)), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '13px 18px',
        textAlign: 'right',
        font: '13px var(--font-mono)',
        color: 'var(--text-900)'
      }
    }, "$", A.fmt(p.mark)), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '13px 18px',
        textAlign: 'right'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        font: '13px var(--font-mono)',
        color: p.pnl >= 0 ? 'var(--up-500)' : 'var(--down-500)'
      }
    }, p.pnl >= 0 ? '+' : '−', "$", A.fmt(Math.abs(p.pnl))), /*#__PURE__*/React.createElement(PriceChange, {
      value: p.side === 'Short' ? p.pnlPct : p.pnlPct,
      percent: true,
      size: "sm",
      showArrow: false
    })), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '13px 18px',
        textAlign: 'right'
      }
    }, /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "ghost"
    }, "Close"))))))));
  }
  function Dashboard() {
    const eq = A.equity;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 16
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 14
      }
    }, /*#__PURE__*/React.createElement(StatCard, {
      label: "Portfolio value",
      value: "$48,210",
      delta: 2.41,
      data: eq,
      icon: /*#__PURE__*/React.createElement(Icon, {
        name: "wallet",
        size: 16
      })
    }), /*#__PURE__*/React.createElement(StatCard, {
      label: "24h P&L",
      value: "+$1,204",
      delta: 2.56,
      sub: "across 4 positions"
    }), /*#__PURE__*/React.createElement(StatCard, {
      label: "AI bots P&L",
      value: "+$842",
      delta: 5.1,
      icon: /*#__PURE__*/React.createElement(Icon, {
        name: "bot",
        size: 16
      })
    }), /*#__PURE__*/React.createElement(StatCard, {
      label: "Win rate",
      value: "68",
      unit: "%",
      delta: 3.1,
      data: A.coins[2].spark
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1fr) 312px',
        gap: 16,
        alignItems: 'start'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement(ChartPanel, null), /*#__PURE__*/React.createElement(Positions, null)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 16
      }
    }, /*#__PURE__*/React.createElement(OrderPanel, null), /*#__PURE__*/React.createElement(Watchlist, null))));
  }
  window.Dashboard = Dashboard;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/trading_app/Dashboard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/trading_app/Portfolio.jsx
try { (() => {
/* Apex Trader UI kit — Portfolio screen. */
(function () {
  const DS = window.ApexTraderDesignSystem_cd55a5;
  const {
    Card,
    Button,
    Badge,
    Tabs,
    PriceChange,
    Sparkline,
    Icon,
    IconButton,
    StatCard
  } = DS;
  const {
    AreaChart,
    Donut
  } = window;
  const A = window.APEX;
  function EquityCard() {
    const [tf, setTf] = React.useState('1M');
    return /*#__PURE__*/React.createElement(Card, {
      flush: true
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        padding: '18px 20px 8px',
        flexWrap: 'wrap',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        font: '11px var(--font-sans)',
        letterSpacing: '.1em',
        textTransform: 'uppercase',
        color: 'var(--text-400)'
      }
    }, "Total balance"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginTop: 4
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        font: '700 32px var(--font-mono)',
        color: 'var(--text-900)',
        letterSpacing: '-0.02em'
      }
    }, "$48,210.34"), /*#__PURE__*/React.createElement(PriceChange, {
      value: 2.41,
      percent: true,
      pill: true
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        font: '13px var(--font-mono)',
        color: 'var(--up-500)',
        marginTop: 4
      }
    }, "+$1,204.18 ", /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--text-400)'
      }
    }, "this month"))), /*#__PURE__*/React.createElement(Tabs, {
      variant: "pill",
      items: ['1D', '1W', '1M', '1Y', 'All'],
      value: tf,
      onChange: setTf
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '8px 6px 12px'
      }
    }, /*#__PURE__*/React.createElement(AreaChart, {
      data: A.equity,
      height: 220
    })));
  }
  function AllocationCard() {
    return /*#__PURE__*/React.createElement(Card, {
      title: "Allocation"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 18
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'relative',
        flex: 'none'
      }
    }, /*#__PURE__*/React.createElement(Donut, {
      data: A.allocation
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        font: '10px var(--font-sans)',
        letterSpacing: '.1em',
        textTransform: 'uppercase',
        color: 'var(--text-400)'
      }
    }, "Assets"), /*#__PURE__*/React.createElement("span", {
      style: {
        font: '700 22px var(--font-mono)',
        color: 'var(--text-900)'
      }
    }, "8"))), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 9
      }
    }, A.allocation.map(a => /*#__PURE__*/React.createElement("div", {
      key: a.sym,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 9
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 9,
        height: 9,
        borderRadius: 3,
        background: a.color,
        flex: 'none'
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        font: '600 12px var(--font-mono)',
        color: 'var(--text-900)',
        width: 46
      }
    }, a.sym), /*#__PURE__*/React.createElement("span", {
      style: {
        font: '12px var(--font-sans)',
        color: 'var(--text-500)'
      }
    }, a.pct, "%"), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 'auto',
        font: '12px var(--font-mono)',
        color: 'var(--text-700)'
      }
    }, "$", A.fmt(a.value, 0)))))));
  }
  function Holdings() {
    const cols = ['Asset', 'Balance', 'Price', '24h', 'Value', 'Allocation'];
    return /*#__PURE__*/React.createElement(Card, {
      title: "Holdings",
      flush: true,
      actions: /*#__PURE__*/React.createElement(Button, {
        size: "sm",
        variant: "ghost",
        iconLeft: /*#__PURE__*/React.createElement(Icon, {
          name: "filter",
          size: 14
        })
      }, "Filter")
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        overflowX: 'auto'
      }
    }, /*#__PURE__*/React.createElement("table", {
      style: {
        width: '100%',
        borderCollapse: 'collapse'
      }
    }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, cols.map((c, i) => /*#__PURE__*/React.createElement("th", {
      key: c,
      style: {
        textAlign: i > 0 ? 'right' : 'left',
        padding: '10px 20px',
        font: '500 11px var(--font-sans)',
        letterSpacing: '.06em',
        textTransform: 'uppercase',
        color: 'var(--text-400)',
        borderBottom: '1px solid var(--border)'
      }
    }, c)))), /*#__PURE__*/React.createElement("tbody", null, A.coins.slice(0, 6).map((c, i) => {
      const bal = [0.412, 8.30, 64.0, 220.0, 310.0, 4200.0][i];
      const val = bal * c.price;
      const alloc = [42, 23, 16, 7, 6, 6][i];
      return /*#__PURE__*/React.createElement("tr", {
        key: c.sym,
        style: {
          borderBottom: '1px solid var(--border-soft)'
        }
      }, /*#__PURE__*/React.createElement("td", {
        style: {
          padding: '13px 20px'
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          font: '600 11px var(--font-mono)',
          color: 'var(--text-700)'
        }
      }, c.sym[0]), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
        style: {
          font: '600 13px var(--font-mono)',
          color: 'var(--text-900)'
        }
      }, c.sym), /*#__PURE__*/React.createElement("div", {
        style: {
          font: '11px var(--font-sans)',
          color: 'var(--text-400)'
        }
      }, c.name)))), /*#__PURE__*/React.createElement("td", {
        style: {
          padding: '13px 20px',
          textAlign: 'right',
          font: '13px var(--font-mono)',
          color: 'var(--text-700)'
        }
      }, bal), /*#__PURE__*/React.createElement("td", {
        style: {
          padding: '13px 20px',
          textAlign: 'right',
          font: '13px var(--font-mono)',
          color: 'var(--text-900)'
        }
      }, "$", A.fmtPrice(c.price)), /*#__PURE__*/React.createElement("td", {
        style: {
          padding: '13px 20px',
          textAlign: 'right'
        }
      }, /*#__PURE__*/React.createElement(PriceChange, {
        value: c.chg,
        percent: true,
        size: "sm",
        showArrow: false
      })), /*#__PURE__*/React.createElement("td", {
        style: {
          padding: '13px 20px',
          textAlign: 'right',
          font: '13px var(--font-mono)',
          color: 'var(--text-900)'
        }
      }, "$", A.fmt(val, 0)), /*#__PURE__*/React.createElement("td", {
        style: {
          padding: '13px 20px',
          textAlign: 'right'
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          justifyContent: 'flex-end'
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          width: 56,
          height: 6,
          borderRadius: 3,
          background: 'var(--bg-elevated)',
          overflow: 'hidden'
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          width: alloc + '%',
          height: '100%',
          background: 'var(--brand)',
          borderRadius: 3
        }
      })), /*#__PURE__*/React.createElement("span", {
        style: {
          font: '12px var(--font-mono)',
          color: 'var(--text-500)',
          width: 30
        }
      }, alloc, "%"))));
    })))));
  }
  function Portfolio() {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 16
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4,1fr)',
        gap: 14
      }
    }, /*#__PURE__*/React.createElement(StatCard, {
      label: "Total balance",
      value: "$48,210",
      delta: 2.41
    }), /*#__PURE__*/React.createElement(StatCard, {
      label: "All-time P&L",
      value: "+$8,940",
      delta: 22.8,
      icon: /*#__PURE__*/React.createElement(Icon, {
        name: "trending-up",
        size: 16
      })
    }), /*#__PURE__*/React.createElement(StatCard, {
      label: "Best performer",
      value: "DOGE",
      sub: "+8.12% today"
    }), /*#__PURE__*/React.createElement(StatCard, {
      label: "Realized P&L",
      value: "+$3,120",
      delta: 4.0
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1.5fr) 1fr',
        gap: 16,
        alignItems: 'start'
      }
    }, /*#__PURE__*/React.createElement(EquityCard, null), /*#__PURE__*/React.createElement(AllocationCard, null)), /*#__PURE__*/React.createElement(Holdings, null));
  }
  window.Portfolio = Portfolio;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/trading_app/Portfolio.jsx", error: String((e && e.message) || e) }); }

// ui_kits/trading_app/Shell.jsx
try { (() => {
/* Apex Trader UI kit — app shell: sidebar + top bar. Composes DS primitives. */
const {
  Icon,
  IconButton,
  Button,
  Avatar,
  Badge
} = window.ApexTraderDesignSystem_cd55a5;
const NAV = [{
  id: 'dashboard',
  label: 'Dashboard',
  icon: 'layout-dashboard'
}, {
  id: 'markets',
  label: 'Markets',
  icon: 'candlestick'
}, {
  id: 'bots',
  label: 'AI Bots',
  icon: 'bot',
  badge: '3'
}, {
  id: 'portfolio',
  label: 'Portfolio',
  icon: 'pie-chart'
}, {
  id: 'orders',
  label: 'Orders',
  icon: 'repeat'
}];
function Sidebar({
  active,
  onNav
}) {
  return /*#__PURE__*/React.createElement("aside", {
    style: {
      width: 'var(--sidebar-w)',
      flex: 'none',
      height: '100%',
      borderRight: '1px solid var(--border)',
      background: 'var(--bg-inset)',
      display: 'flex',
      flexDirection: 'column',
      padding: '0 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      height: 'var(--topbar-h)',
      padding: '0 6px'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-mark.svg",
    width: "30",
    height: "30",
    alt: ""
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '700 17px var(--font-sans)',
      letterSpacing: '-0.02em',
      color: 'var(--text-900)'
    }
  }, "APEX ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 300,
      color: 'var(--text-500)'
    }
  }, "Trader"))), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 10px var(--font-sans)',
      letterSpacing: '.14em',
      textTransform: 'uppercase',
      color: 'var(--text-400)',
      padding: '14px 8px 8px'
    }
  }, "Trade"), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, NAV.map(n => {
    const on = active === n.id;
    return /*#__PURE__*/React.createElement("button", {
      key: n.id,
      onClick: () => onNav(n.id),
      className: 'apex-nav-btn' + (on ? ' is-active' : ''),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '10px 10px',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        font: '500 14px var(--font-sans)',
        textAlign: 'left'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: n.icon,
      size: 18
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1
      }
    }, n.label), n.badge && /*#__PURE__*/React.createElement(Badge, {
      tone: on ? 'brand' : 'neutral',
      solid: on
    }, n.badge));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'auto',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      border: '1px solid var(--brand-border)',
      background: 'var(--violet-soft)',
      borderRadius: 'var(--radius-lg)',
      padding: 14,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      color: 'var(--brand-text)',
      font: '600 13px var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles",
    size: 16
  }), " Apex Copilot"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '7px 0 11px',
      font: '12px var(--font-sans)',
      color: 'var(--text-500)',
      lineHeight: 1.45
    }
  }, "Ask the AI to build or tune a strategy in plain English."), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "primary",
    block: true
  }, "Open Copilot")), /*#__PURE__*/React.createElement("button", {
    onClick: () => onNav('settings'),
    className: 'apex-nav-btn' + (active === 'settings' ? ' is-active' : ''),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11,
      width: '100%',
      padding: '10px',
      border: 'none',
      borderRadius: 'var(--radius-md)',
      cursor: 'pointer',
      font: '500 14px var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "settings",
    size: 18
  }), " Settings")));
}
function TopBar({
  title
}) {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      height: 'var(--topbar-h)',
      flex: 'none',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '0 22px',
      background: 'rgba(9,11,16,0.7)',
      backdropFilter: 'blur(8px)',
      position: 'sticky',
      top: 0,
      zIndex: 5
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      font: '600 18px var(--font-sans)',
      letterSpacing: '-0.01em',
      color: 'var(--text-900)'
    }
  }, title), /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      marginLeft: 14,
      height: 38,
      padding: '0 13px',
      background: 'var(--bg-inset)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      color: 'var(--text-400)',
      width: 280,
      maxWidth: '26vw'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search",
    size: 16
  }), /*#__PURE__*/React.createElement("input", {
    placeholder: "Search markets, bots\u2026",
    style: {
      border: 'none',
      outline: 'none',
      background: 'transparent',
      color: 'var(--text-900)',
      font: '14px var(--font-sans)',
      width: '100%'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '11px var(--font-mono)',
      color: 'var(--text-300)',
      border: '1px solid var(--border)',
      borderRadius: 4,
      padding: '1px 5px'
    }
  }, "/")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: 'auto',
      display: 'flex',
      alignItems: 'center',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '10px var(--font-sans)',
      letterSpacing: '.1em',
      textTransform: 'uppercase',
      color: 'var(--text-400)'
    }
  }, "Available"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 14px var(--font-mono)',
      color: 'var(--text-900)'
    }
  }, "$5,785.40 ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-500)',
      fontWeight: 400
    }
  }, "USDT"))), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    iconLeft: /*#__PURE__*/React.createElement(Icon, {
      name: "plus",
      size: 16
    })
  }, "Deposit"), /*#__PURE__*/React.createElement(IconButton, {
    variant: "solid",
    label: "Alerts"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "bell",
    size: 18
  })), /*#__PURE__*/React.createElement(Avatar, {
    name: "Maya Chen",
    status: "online",
    size: "sm"
  })));
}
Object.assign(window, {
  Sidebar,
  TopBar,
  NAV
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/trading_app/Shell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/trading_app/data.js
try { (() => {
/* Apex Trader — mock market data for the UI kit (deterministic, no network). */
(function () {
  function series(seed, n, vol, drift) {
    let v = seed,
      out = [];
    let r = seed * 9301 + 49297;
    const rnd = () => {
      r = (r * 9301 + 49297) % 233280;
      return r / 233280;
    };
    for (let i = 0; i < n; i++) {
      v = Math.max(v * (1 + (rnd() - 0.5) * vol + drift), seed * 0.4);
      out.push(v);
    }
    return out;
  }
  function candles(seed, n, vol, drift) {
    const closes = series(seed, n, vol, drift);
    let prev = seed;
    return closes.map(c => {
      const o = prev;
      prev = c;
      const hi = Math.max(o, c) * (1 + Math.random() * vol * 0.5);
      const lo = Math.min(o, c) * (1 - Math.random() * vol * 0.5);
      return {
        o,
        c,
        h: hi,
        l: lo
      };
    });
  }
  const coins = [{
    sym: 'BTC',
    name: 'Bitcoin',
    price: 67412.05,
    chg: 2.41,
    spark: series(60, 32, 0.03, 0.004)
  }, {
    sym: 'ETH',
    name: 'Ethereum',
    price: 3184.90,
    chg: 1.12,
    spark: series(50, 32, 0.035, 0.002)
  }, {
    sym: 'SOL',
    name: 'Solana',
    price: 172.40,
    chg: 5.84,
    spark: series(40, 32, 0.05, 0.006)
  }, {
    sym: 'AVAX',
    name: 'Avalanche',
    price: 38.21,
    chg: -1.93,
    spark: series(45, 32, 0.04, -0.003)
  }, {
    sym: 'LINK',
    name: 'Chainlink',
    price: 17.84,
    chg: 3.27,
    spark: series(38, 32, 0.045, 0.004)
  }, {
    sym: 'MATIC',
    name: 'Polygon',
    price: 0.7212,
    chg: -0.74,
    spark: series(52, 32, 0.04, -0.001)
  }, {
    sym: 'DOGE',
    name: 'Dogecoin',
    price: 0.1584,
    chg: 8.12,
    spark: series(36, 32, 0.06, 0.008)
  }, {
    sym: 'ADA',
    name: 'Cardano',
    price: 0.4631,
    chg: 0.42,
    spark: series(48, 32, 0.038, 0.0005)
  }];
  const bots = [{
    name: 'Momentum v3',
    pair: 'BTC/USDT',
    tag: 'Trend',
    status: 'live',
    pnl: 12.4,
    alloc: 5000,
    trades: 184,
    win: 68,
    risk: 'Medium',
    spark: series(50, 30, 0.03, 0.006)
  }, {
    name: 'Grid Scalper',
    pair: 'ETH/USDT',
    tag: 'Range',
    status: 'live',
    pnl: 6.8,
    alloc: 3200,
    trades: 942,
    win: 74,
    risk: 'Low',
    spark: series(48, 30, 0.02, 0.003)
  }, {
    name: 'Mean Reversion',
    pair: 'SOL/USDT',
    tag: 'Counter',
    status: 'paused',
    pnl: -2.1,
    alloc: 1800,
    trades: 311,
    win: 52,
    risk: 'High',
    spark: series(46, 30, 0.05, -0.002)
  }, {
    name: 'DCA Accumulator',
    pair: 'BTC/USDT',
    tag: 'DCA',
    status: 'live',
    pnl: 9.3,
    alloc: 4000,
    trades: 96,
    win: 100,
    risk: 'Low',
    spark: series(44, 30, 0.018, 0.004)
  }, {
    name: 'Breakout Hunter',
    pair: 'DOGE/USDT',
    tag: 'Trend',
    status: 'paused',
    pnl: 3.7,
    alloc: 1200,
    trades: 58,
    win: 61,
    risk: 'High',
    spark: series(40, 30, 0.06, 0.002)
  }];
  const positions = [{
    sym: 'BTC',
    side: 'Long',
    qty: 0.412,
    entry: 65820,
    mark: 67412.05,
    pnl: 656.2,
    pnlPct: 2.41
  }, {
    sym: 'ETH',
    side: 'Long',
    qty: 8.30,
    entry: 3150.0,
    mark: 3184.90,
    pnl: 289.7,
    pnlPct: 1.12
  }, {
    sym: 'SOL',
    side: 'Long',
    qty: 64.0,
    entry: 162.8,
    mark: 172.40,
    pnl: 614.4,
    pnlPct: 5.84
  }, {
    sym: 'AVAX',
    side: 'Short',
    qty: 120.0,
    entry: 39.50,
    mark: 38.21,
    pnl: 154.8,
    pnlPct: 1.93
  }];
  const allocation = [{
    sym: 'BTC',
    pct: 42,
    value: 20248,
    color: '#7B61FF'
  }, {
    sym: 'ETH',
    pct: 23,
    value: 11088,
    color: '#29D7D7'
  }, {
    sym: 'SOL',
    pct: 16,
    value: 7714,
    color: '#4D6BFF'
  }, {
    sym: 'USDT',
    pct: 12,
    value: 5785,
    color: '#21D08A'
  }, {
    sym: 'Other',
    pct: 7,
    value: 3375,
    color: '#3A4150'
  }];
  window.APEX = {
    coins,
    bots,
    positions,
    allocation,
    candles: candles(420, 56, 0.02, 0.003),
    equity: series(40000, 40, 0.02, 0.006),
    fmt: (n, d = 2) => Number(n).toLocaleString('en-US', {
      minimumFractionDigits: d,
      maximumFractionDigits: d
    }),
    fmtPrice: n => n >= 100 ? Number(n).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) : Number(n).toLocaleString('en-US', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    })
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/trading_app/data.js", error: String((e && e.message) || e) }); }

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.ICON_NAMES = __ds_scope.ICON_NAMES;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.PriceChange = __ds_scope.PriceChange;

__ds_ns.Sparkline = __ds_scope.Sparkline;

__ds_ns.StatCard = __ds_scope.StatCard;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Tabs = __ds_scope.Tabs;

})();
