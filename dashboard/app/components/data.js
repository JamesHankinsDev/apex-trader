/* Apex Trader — mock data layer (deterministic, no network).
   Exposes window.APEXAPP with coins, holdings, bots, insights, activity,
   equity history, and helpers. A tiny live-price engine (window.ApexLive)
   jitters prices on an interval and notifies subscribers for tick-flash. */
(function () {
  // ---- deterministic series helpers -------------------------------------
  function makeRng(seed) {
    let r = seed * 9301 + 49297;
    return () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
  }
  function series(seed, n, vol, drift) {
    const rnd = makeRng(seed);
    let v = seed, out = [];
    for (let i = 0; i < n; i++) {
      v = Math.max(v * (1 + (rnd() - 0.5) * vol + drift), seed * 0.35);
      out.push(v);
    }
    return out;
  }
  function candlesFrom(closes, seed, vol) {
    const rnd = makeRng(seed + 7);
    let prev = closes[0];
    return closes.map((c) => {
      const o = prev; prev = c;
      const hi = Math.max(o, c) * (1 + rnd() * vol * 0.6);
      const lo = Math.min(o, c) * (1 - rnd() * vol * 0.6);
      return { o, c, h: hi, l: lo };
    });
  }

  // ---- coins -------------------------------------------------------------
  // held = quantity in the user's portfolio (0 = not held). color = chart hue.
  const C = [
    { sym: 'BTC',  name: 'Bitcoin',   price: 67412.05, chg: 2.41,  vol: 0.028, drift: 0.004,  held: 0.0800, color: '#F7931A' },
    { sym: 'ETH',  name: 'Ethereum',  price: 3184.90,  chg: 1.12,  vol: 0.034, drift: 0.002,  held: 1.2000, color: '#7B61FF' },
    { sym: 'SOL',  name: 'Solana',    price: 172.40,   chg: 5.84,  vol: 0.052, drift: 0.006,  held: 9.0000, color: '#29D7D7' },
    { sym: 'DOGE', name: 'Dogecoin',  price: 0.1584,   chg: 8.12,  vol: 0.061, drift: 0.008,  held: 4000.0, color: '#C2A633' },
    { sym: 'LINK', name: 'Chainlink', price: 17.84,    chg: 3.27,  vol: 0.045, drift: 0.004,  held: 0,      color: '#4D6BFF' },
    { sym: 'AVAX', name: 'Avalanche', price: 38.21,    chg: -1.93, vol: 0.041, drift: -0.003, held: 0,      color: '#FF4D6A' },
    { sym: 'MATIC',name: 'Polygon',   price: 0.7212,   chg: -0.74, vol: 0.040, drift: -0.001, held: 0,      color: '#8247E5' },
    { sym: 'ADA',  name: 'Cardano',   price: 0.4631,   chg: 0.42,  vol: 0.038, drift: 0.0006, held: 0,      color: '#3CC8C8' },
    { sym: 'XRP',  name: 'Ripple',    price: 0.6128,   chg: -2.34, vol: 0.039, drift: -0.002, held: 0,      color: '#5A7184' },
    { sym: 'DOT',  name: 'Polkadot',  price: 7.214,    chg: 4.11,  vol: 0.047, drift: 0.005,  held: 0,      color: '#E6007A' },
    { sym: 'ATOM', name: 'Cosmos',    price: 9.482,    chg: 1.88,  vol: 0.043, drift: 0.002,  held: 0,      color: '#6F7CBA' },
    { sym: 'NEAR', name: 'Near',      price: 6.071,    chg: 6.93,  vol: 0.055, drift: 0.007,  held: 0,      color: '#21D08A' },
  ];
  const coins = C.map((c, i) => {
    const closes = series(c.price * 0.82, 56, c.vol, c.drift);
    closes[closes.length - 1] = c.price;
    return {
      ...c,
      open24: c.price / (1 + c.chg / 100),
      spark: closes.slice(-24),
      closes,
      candles: candlesFrom(closes, (i + 1) * 31, c.vol),
      mcap: c.price * (c.sym === 'BTC' ? 19.7e6 : c.sym === 'ETH' ? 120e6 : 5e8 + i * 4e8),
    };
  });
  const bySym = Object.fromEntries(coins.map((c) => [c.sym, c]));

  // ---- cash + portfolio --------------------------------------------------
  const cashUSDT = 1085.40;

  // ---- equity history (180 daily points, ends near current total) --------
  const equityFull = (function () {
    const s = series(8600, 180, 0.022, 0.0042);
    // normalise the tail to a realistic "today" value
    return s;
  })();
  const equityIntraday = series(12100, 48, 0.006, 0.0009); // 1D, 30-min bars

  // ---- bots (automation engine) -----------------------------------------
  const bots = [
    {
      id: 'momentum', name: 'Momentum v3', pair: 'BTC/USDT', type: 'Trend following',
      status: 'live', pnl30: 12.4, pnlUsd: 612.80, win: 68, trades: 184, sharpe: 1.84,
      risk: 'Medium', spark: series(50, 30, 0.03, 0.006),
      blurb: 'Rides confirmed breakouts on the 4h timeframe, scaling in as trend strength builds.',
      cfg: { capital: 5000, risk: 'Medium', stopLoss: 4, takeProfit: 9, frequency: 'Intraday', hours: '24/7', maxDrawdown: 15, orderType: 'Limit', trailing: true },
    },
    {
      id: 'grid', name: 'Grid Scalper', pair: 'ETH/USDT', type: 'Range / grid',
      status: 'live', pnl30: 6.8, pnlUsd: 217.60, win: 74, trades: 942, sharpe: 2.10,
      risk: 'Low', spark: series(48, 30, 0.02, 0.003),
      blurb: 'Places a ladder of buy/sell orders inside a price band — profits from chop, not direction.',
      cfg: { capital: 3200, risk: 'Low', stopLoss: 3, takeProfit: 1.5, frequency: 'Scalp', hours: '24/7', maxDrawdown: 8, orderType: 'Limit', trailing: false },
    },
    {
      id: 'dca', name: 'DCA Accumulator', pair: 'BTC/USDT', type: 'Dollar-cost average',
      status: 'live', pnl30: 9.3, pnlUsd: 372.00, win: 100, trades: 96, sharpe: 1.55,
      risk: 'Low', spark: series(44, 30, 0.018, 0.004),
      blurb: 'Buys a fixed amount on schedule and on dips — slow, steady, low-stress accumulation.',
      cfg: { capital: 4000, risk: 'Low', stopLoss: 0, takeProfit: 0, frequency: 'Daily', hours: '24/7', maxDrawdown: 10, orderType: 'Market', trailing: false },
    },
    {
      id: 'meanrev', name: 'Mean Reversion', pair: 'SOL/USDT', type: 'Counter-trend',
      status: 'paused', pnl30: -2.1, pnlUsd: -37.80, win: 52, trades: 311, sharpe: 0.74,
      risk: 'High', spark: series(46, 30, 0.05, -0.002),
      blurb: 'Fades sharp moves, betting price snaps back to its average. Higher variance.',
      cfg: { capital: 1800, risk: 'High', stopLoss: 6, takeProfit: 5, frequency: 'Intraday', hours: 'Custom', maxDrawdown: 20, orderType: 'Market', trailing: true },
    },
    {
      id: 'breakout', name: 'Breakout Hunter', pair: 'DOGE/USDT', type: 'Volatility breakout',
      status: 'paused', pnl30: 3.7, pnlUsd: 44.40, win: 61, trades: 58, sharpe: 1.12,
      risk: 'High', spark: series(40, 30, 0.06, 0.002),
      blurb: 'Waits for a volatility squeeze then enters on the breakout candle. Few trades, big swings.',
      cfg: { capital: 1200, risk: 'High', stopLoss: 7, takeProfit: 14, frequency: 'Swing', hours: '24/7', maxDrawdown: 25, orderType: 'Limit', trailing: true },
    },
  ];

  // ---- strategy templates for "deploy new bot" --------------------------
  const templates = [
    { id: 't-dca', name: 'Steady DCA', icon: 'repeat', risk: 'Low', desc: 'Auto-buy on a schedule. Best for beginners building a position.' },
    { id: 't-grid', name: 'Grid bot', icon: 'layout-dashboard', risk: 'Low', desc: 'Profit from sideways chop with a ladder of orders.' },
    { id: 't-trend', name: 'Trend rider', icon: 'trending-up', risk: 'Medium', desc: 'Follow momentum; scale into confirmed breakouts.' },
    { id: 't-rev', name: 'Dip buyer', icon: 'activity', risk: 'High', desc: 'Counter-trend entries when price overshoots.' },
  ];

  // ---- AI insights layer -------------------------------------------------
  const insights = [
    { id: 'i1', tone: 'opportunity', icon: 'trending-up', tag: 'Opportunity',
      title: 'SOL momentum is building', body: 'Solana broke its 7-day high on rising volume. Momentum v3 is positioned to catch the move.', cta: 'View SOL' },
    { id: 'i2', tone: 'risk', icon: 'alert-triangle', tag: 'Risk',
      title: 'Portfolio is 43% Bitcoin', body: 'You’re concentrated in BTC. A small rebalance into stable assets would lower your drawdown risk.', cta: 'Rebalance' },
    { id: 'i3', tone: 'info', icon: 'gauge', tag: 'Health',
      title: 'Mean Reversion is underperforming', body: 'Down 2.1% over 30 days with a 52% win rate. Consider pausing or lowering its allocation.', cta: 'Review bot' },
    { id: 'i4', tone: 'opportunity', icon: 'zap', tag: 'Idea',
      title: 'Cash sitting idle', body: 'You have $1,085 in USDT not earning. A low-risk DCA bot could put it to work gradually.', cta: 'Deploy DCA' },
  ];

  // ---- automated activity feed ------------------------------------------
  const activity = [
    { t: '2m ago',  bot: 'Grid Scalper',    act: 'Sold', sym: 'ETH', qty: 0.21, price: 3186.40, pnl: 8.20 },
    { t: '14m ago', bot: 'Momentum v3',     act: 'Bought', sym: 'BTC', qty: 0.004, price: 67380.0, pnl: null },
    { t: '38m ago', bot: 'DCA Accumulator', act: 'Bought', sym: 'BTC', qty: 0.006, price: 67120.0, pnl: null },
    { t: '1h ago',  bot: 'Grid Scalper',    act: 'Bought', sym: 'ETH', qty: 0.21, price: 3168.10, pnl: null },
    { t: '2h ago',  bot: 'Momentum v3',     act: 'Sold', sym: 'BTC', qty: 0.003, price: 67510.0, pnl: 22.40 },
    { t: '4h ago',  bot: 'DCA Accumulator', act: 'Bought', sym: 'BTC', qty: 0.006, price: 66890.0, pnl: null },
  ];

  // ---- formatters --------------------------------------------------------
  const fmt = (n, d = 2) => Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmtPrice = (n) => n >= 1000
    ? Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : n >= 1 ? Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : Number(n).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  const fmtCompact = (n) => {
    const a = Math.abs(n);
    if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (a >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toFixed(0);
  };

  window.APEXAPP = {
    coins, bySym, bots, templates, insights, activity, cashUSDT,
    equityFull, equityIntraday,
    fmt, fmtPrice, fmtCompact,
    // timeframe -> equity slice
    equityFor(tf) {
      if (tf === '1D') return equityIntraday;
      const map = { '1W': 7, '1M': 30, '3M': 90, '1Y': 180 };
      const n = map[tf] || 30;
      return equityFull.slice(-n);
    },
  };

  // ===== live price engine ================================================
  window.ApexLive = (function () {
    const state = {};
    coins.forEach((c) => { state[c.sym] = { price: c.price, open: c.open24, chg: c.chg, dir: 0, tick: 0 }; });
    const subs = new Set();
    let tick = 0, timer = null;
    function step() {
      tick++;
      coins.forEach((c) => {
        const s = state[c.sym];
        const drift = (Math.random() - 0.5) * (c.vol * 0.16);
        const np = Math.max(s.price * (1 + drift), s.price * 0.5);
        s.dir = np >= s.price ? 1 : -1;
        s.price = np;
        s.chg = ((np - s.open) / s.open) * 100;
        s.tick = tick;
      });
      subs.forEach((fn) => fn(tick));
    }
    function start() { if (!timer) timer = setInterval(step, 2400); }
    function stop() { clearInterval(timer); timer = null; }
    start();
    return {
      state,
      get: (sym) => state[sym],
      tick: () => tick,
      subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
      portfolioValue() {
        let v = cashUSDT;
        coins.forEach((c) => { if (c.held) v += c.held * state[c.sym].price; });
        return v;
      },
      start, stop,
    };
  })();
})();
