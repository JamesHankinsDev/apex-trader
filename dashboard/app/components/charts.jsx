/* Apex Trader — charts + live-data React components.
   Exports to window: useLive, useTickerValue, LivePrice, LiveDelta, LiveBalance,
   AreaChart, CandleChart, Donut, Bars, MiniArea. */
(function () {
  const { useState, useEffect, useRef } = React;

  // ---- live hooks --------------------------------------------------------
  // Re-render on every tick. Cheap enough for ~12 symbols in a prototype.
  function useLive(sym) {
    const [, force] = useState(0);
    useEffect(() => window.ApexLive.subscribe(() => force((x) => x + 1)), [sym]);
    return window.ApexLive.get(sym);
  }
  function useTickerValue(getter) {
    const [v, setV] = useState(getter);
    useEffect(() => window.ApexLive.subscribe(() => setV(getter())), []);
    return v;
  }

  // flash helper: toggles .apex-tick-up/down on the node when `tick` changes
  function useFlash(tick, dir) {
    const ref = useRef(null);
    const first = useRef(true);
    useEffect(() => {
      if (first.current) { first.current = false; return; }
      const el = ref.current; if (!el) return;
      const cls = dir > 0 ? 'apex-tick-up' : 'apex-tick-down';
      el.classList.remove('apex-tick-up', 'apex-tick-down');
      void el.offsetWidth; // restart animation
      el.classList.add(cls);
    }, [tick]);
    return ref;
  }

  function LivePrice({ sym, prefix = '$', style, className }) {
    const s = useLive(sym);
    const ref = useFlash(s.tick, s.dir);
    return (
      <span ref={ref} className={className} style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', borderRadius: 4, padding: '0 2px', ...style }}>
        {prefix}{window.APEXAPP.fmtPrice(s.price)}
      </span>
    );
  }

  function LiveDelta({ sym, size = 'sm', percent = true, showArrow = true, pill = false }) {
    const { PriceChange } = window.ApexTraderDesignSystem_cd55a5;
    const s = useLive(sym);
    return <PriceChange value={+s.chg.toFixed(2)} percent={percent} size={size} showArrow={showArrow} pill={pill} />;
  }

  function LiveBalance({ style, className }) {
    const v = useTickerValue(() => window.ApexLive.portfolioValue());
    const tick = useTickerValue(() => window.ApexLive.tick());
    const prev = useRef(v);
    const dir = v >= prev.current ? 1 : -1;
    useEffect(() => { prev.current = v; });
    const ref = useFlash(tick, dir);
    return (
      <span ref={ref} className={className} style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', borderRadius: 6, ...style }}>
        ${window.APEXAPP.fmt(v)}
      </span>
    );
  }

  // ---- charts ------------------------------------------------------------
  function AreaChart({ data, width = 360, height = 150, color = 'var(--brand)', animate = true, grid = true, fillId }) {
    const pad = 6;
    const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
    const stepX = (width - pad * 2) / (data.length - 1);
    const pts = data.map((v, i) => [pad + i * stepX, height - pad - ((v - min) / range) * (height - pad * 2)]);
    const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const area = `${line} L${pts[pts.length - 1][0]},${height} L${pts[0][0]},${height} Z`;
    const gid = fillId || 'ac-' + Math.random().toString(36).slice(2, 7);
    const last = pts[pts.length - 1];
    return (
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} fill="none" preserveAspectRatio="none" style={{ display: 'block' }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.30" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {grid && [0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1="0" x2={width} y1={height * g} y2={height * g} stroke="var(--line-soft)" strokeWidth="1" />
        ))}
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} stroke={color} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round"
          style={animate ? { strokeDasharray: 2600, strokeDashoffset: 2600, animation: 'apex-draw 1.05s var(--ease-out) forwards' } : undefined} />
        <circle cx={last[0]} cy={last[1]} r="3.5" fill={color} />
        <circle cx={last[0]} cy={last[1]} r="7" fill={color} opacity="0.18" />
      </svg>
    );
  }

  function CandleChart({ candles, width = 360, height = 200, animate = true }) {
    const pad = 8;
    const hi = Math.max(...candles.map((c) => c.h));
    const lo = Math.min(...candles.map((c) => c.l));
    const range = hi - lo || 1;
    const y = (v) => pad + (1 - (v - lo) / range) * (height - pad * 2);
    const slot = (width - pad * 2) / candles.length;
    const cw = Math.max(2.5, slot * 0.6);
    return (
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} fill="none" style={{ display: 'block' }}>
        {[0.2, 0.4, 0.6, 0.8].map((g) => (
          <line key={g} x1="0" x2={width} y1={height * g} y2={height * g} stroke="var(--line-soft)" strokeWidth="1" />
        ))}
        {candles.map((c, i) => {
          const x = pad + i * slot + slot / 2;
          const up = c.c >= c.o;
          const col = up ? 'var(--up-500)' : 'var(--down-500)';
          const yo = y(c.o), yc = y(c.c);
          const top = Math.min(yo, yc);
          const bh = Math.max(1.5, Math.abs(yc - yo));
          return (
            <g key={i}>
              <line x1={x} x2={x} y1={y(c.h)} y2={y(c.l)} stroke={col} strokeWidth="1.3" />
              <rect x={x - cw / 2} y={top} width={cw} height={bh} rx="1.2" fill={col} />
            </g>
          );
        })}
      </svg>
    );
  }

  function Donut({ data, size = 150, thickness = 20, children }) {
    const r = (size - thickness) / 2;
    const c = 2 * Math.PI * r;
    let offset = 0;
    return (
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            {data.map((d, i) => {
              const len = (d.pct / 100) * c;
              const seg = (
                <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none"
                  stroke={d.color} strokeWidth={thickness}
                  strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset}
                  strokeLinecap="butt"
                  style={{ transition: 'stroke-dasharray .6s var(--ease-out)' }} />
              );
              offset += len;
              return seg;
            })}
          </g>
        </svg>
        {children && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            {children}
          </div>
        )}
      </div>
    );
  }

  function Bars({ data, width = 360, height = 120, gap = 5 }) {
    // data: [{v, label, up}]  -> vertical P&L bars (green up / red down), zero baseline
    const max = Math.max(...data.map((d) => Math.abs(d.v))) || 1;
    const bw = (width - gap * (data.length - 1)) / data.length;
    const mid = height / 2;
    return (
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} fill="none" style={{ display: 'block' }}>
        <line x1="0" x2={width} y1={mid} y2={mid} stroke="var(--line)" strokeWidth="1" />
        {data.map((d, i) => {
          const h = (Math.abs(d.v) / max) * (mid - 6);
          const x = i * (bw + gap);
          const up = d.v >= 0;
          return (
            <rect key={i} x={x} y={up ? mid - h : mid} width={bw} height={Math.max(1.5, h)} rx="2"
              fill={up ? 'var(--up-500)' : 'var(--down-500)'} opacity="0.92" />
          );
        })}
      </svg>
    );
  }

  function MiniArea({ data, color = 'var(--brand)', height = 40 }) {
    const w = 120, pad = 2;
    const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
    const sx = (w - pad * 2) / (data.length - 1);
    const pts = data.map((v, i) => [pad + i * sx, height - pad - ((v - min) / range) * (height - pad * 2)]);
    const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const area = `${line} L${pts[pts.length - 1][0]},${height} L${pts[0][0]},${height} Z`;
    const gid = 'ma-' + Math.random().toString(36).slice(2, 7);
    return (
      <svg width="100%" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.28" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} stroke={color} strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    );
  }

  Object.assign(window, {
    useLive, useTickerValue, LivePrice, LiveDelta, LiveBalance,
    AreaChart, CandleChart, Donut, Bars, MiniArea,
  });
})();
