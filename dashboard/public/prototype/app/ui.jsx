/* Apex Trader — shared UI primitives for the mobile app.
   Exports to window: Eyebrow, Section, ScreenHead, SubHead, CoinGlyph,
   CoinRow, BottomSheet, RiskBadge, MetricRow. */
(function () {
  const { useState, useEffect } = React;
  const DS = window.ApexTraderDesignSystem_cd55a5;
  const { Icon, Sparkline, Badge } = DS;
  const A = window.APEXAPP;

  const Eyebrow = ({ children, style }) => (
    <div style={{ font: '11px var(--font-sans)', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text-400)', ...style }}>{children}</div>
  );

  const Section = ({ children, style }) => <div style={{ padding: '0 16px', ...style }}>{children}</div>;

  // big page title (sentence case per brand voice)
  const ScreenHead = ({ title, sub, action }) => (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '6px 16px 14px' }}>
      <div>
        <h1 style={{ font: '700 26px var(--font-sans)', color: 'var(--text-900)', letterSpacing: '-0.03em', lineHeight: 1.05 }}>{title}</h1>
        {sub && <div style={{ font: '13px var(--font-sans)', color: 'var(--text-500)', marginTop: 4 }}>{sub}</div>}
      </div>
      {action}
    </div>
  );

  const SubHead = ({ children, action, style }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 16px 10px', ...style }}>
      <h2 style={{ font: '600 15px var(--font-sans)', color: 'var(--text-900)', letterSpacing: '-0.01em' }}>{children}</h2>
      {action}
    </div>
  );

  function CoinGlyph({ c, size = 38 }) {
    return (
      <span style={{
        width: size, height: size, borderRadius: '50%', flex: 'none',
        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        font: `600 ${Math.round(size * 0.34)}px var(--font-mono)`, color: c.color,
        boxShadow: `inset 0 0 0 1px ${c.color}22`,
      }}>{c.sym[0]}</span>
    );
  }

  // a market/holding row: live price + delta + sparkline.
  function CoinRow({ c, onClick, showHolding = false, dense = false }) {
    const LivePrice = window.LivePrice, LiveDelta = window.LiveDelta, useLive = window.useLive;
    const live = useLive(c.sym);
    const holdValue = c.held ? c.held * live.price : 0;
    return (
      <button onClick={onClick} style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
        padding: dense ? '11px 16px' : '13px 16px', background: 'transparent', border: 'none',
        cursor: 'pointer', color: 'inherit',
      }}>
        <CoinGlyph c={c} />
        <div style={{ minWidth: 0 }}>
          <div style={{ font: '600 14px var(--font-mono)', color: 'var(--text-900)' }}>{c.sym}</div>
          <div style={{ font: '12px var(--font-sans)', color: 'var(--text-400)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 96 }}>
            {showHolding && c.held ? `${A.fmt(c.held, c.held < 1 ? 4 : c.held < 100 ? 2 : 0)} ${c.sym}` : c.name}
          </div>
        </div>
        <Sparkline data={c.spark} width={46} height={26} fill={false} />
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ font: '14px var(--font-mono)', color: 'var(--text-900)' }}>
            {showHolding && c.held ? <span>${A.fmt(holdValue)}</span> : <LivePrice sym={c.sym} />}
          </div>
          <div style={{ marginTop: 2 }}><LiveDelta sym={c.sym} size="sm" showArrow={false} /></div>
        </div>
      </button>
    );
  }

  function RiskBadge({ level }) {
    const tone = level === 'Low' ? 'up' : level === 'High' ? 'down' : 'warning';
    return <Badge tone={tone}>{level} risk</Badge>;
  }

  function MetricRow({ label, value, mono = true, color }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderTop: '1px solid var(--border-soft)' }}>
        <span style={{ font: '13px var(--font-sans)', color: 'var(--text-500)' }}>{label}</span>
        <span style={{ font: `${mono ? '14px var(--font-mono)' : '600 14px var(--font-sans)'}`, color: color || 'var(--text-900)' }}>{value}</span>
      </div>
    );
  }

  // Slide-up bottom sheet that overlays the phone content.
  function BottomSheet({ open, onClose, title, children, maxHeight = '90%' }) {
    const [mounted, setMounted] = useState(open);
    const [shown, setShown] = useState(false);
    const [closing, setClosing] = useState(false);
    useEffect(() => {
      if (open) {
        setMounted(true); setClosing(false);
        const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
        return () => cancelAnimationFrame(id);
      }
    }, [open]);
    if (!mounted) return null;
    const close = () => {
      setClosing(true); setShown(false);
      setTimeout(() => { setMounted(false); onClose && onClose(); }, 250);
    };
    const up = shown && !closing;
    return (
      <div style={{ position: 'absolute', inset: 0, zIndex: 70, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        <div onClick={close} style={{
          position: 'absolute', inset: 0, background: 'rgba(4,5,8,0.6)', backdropFilter: 'blur(2px)',
          opacity: up ? 1 : 0, transition: 'opacity .25s var(--ease-out)',
        }} />
        <div style={{
          position: 'relative', background: 'var(--bg-raised)', borderTop: '1px solid var(--border-strong)',
          borderRadius: '22px 22px 0 0', maxHeight, display: 'flex', flexDirection: 'column',
          boxShadow: '0 -24px 60px rgba(0,0,0,0.5)',
          transform: up ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform .26s var(--ease-out)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 0 2px' }}>
            <div style={{ width: 38, height: 4, borderRadius: 99, background: 'var(--ink-500)' }} />
          </div>
          {title && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 18px 12px' }}>
              <h3 style={{ font: '700 18px var(--font-sans)', color: 'var(--text-900)', letterSpacing: '-0.02em' }}>{title}</h3>
              <button onClick={close} aria-label="Close" style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-500)', cursor: 'pointer' }}>
                <Icon name="x" size={17} />
              </button>
            </div>
          )}
          <div style={{ overflowY: 'auto', padding: '0 18px calc(18px + env(safe-area-inset-bottom))', WebkitOverflowScrolling: 'touch' }}>
            {children}
          </div>
        </div>
      </div>
    );
  }

  Object.assign(window, { Eyebrow, Section, ScreenHead, SubHead, CoinGlyph, CoinRow, BottomSheet, RiskBadge, MetricRow });
})();
