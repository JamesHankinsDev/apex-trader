/* Apex Trader — coin detail sheet content. Exports window.CoinDetail. */
(function () {
  const { useState } = React;
  const DS = window.ApexTraderDesignSystem_cd55a5;
  const { Icon, Button, Badge } = DS;
  const A = window.APEXAPP;

  function Chip({ active, onClick, children }) {
    return (
      <button onClick={onClick} style={{
        flex: 1, padding: '7px 0', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
        font: '600 12px var(--font-mono)',
        background: active ? 'var(--brand-surface)' : 'transparent',
        color: active ? 'var(--brand-text)' : 'var(--text-500)',
      }}>{children}</button>
    );
  }

  function CoinDetail({ sym, chartStyle = 'area', onAutomate }) {
    const c = A.bySym[sym];
    const { useLive, LivePrice, LiveDelta, AreaChart, CandleChart } = window;
    const live = useLive(sym);
    const [style, setStyle] = useState(chartStyle);
    const [tf, setTf] = useState('1M');
    const [side, setSide] = useState(null); // 'buy'|'sell' toast

    const hi = Math.max(...c.closes), lo = Math.min(...c.closes);
    const sliceN = { '1W': 12, '1M': 28, '3M': 44, 'All': 56 }[tf];
    const closes = c.closes.slice(-sliceN);
    const candles = c.candles.slice(-sliceN);

    return (
      <div style={{ paddingBottom: 8 }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          {window.CoinGlyph ? <window.CoinGlyph c={c} size={44} /> : null}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ font: '700 17px var(--font-sans)', color: 'var(--text-900)' }}>{c.name}</span>
              <Badge tone="neutral">{c.sym}</Badge>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 3 }}>
              <LivePrice sym={sym} style={{ font: '700 20px var(--font-mono)', color: 'var(--text-900)' }} />
              <LiveDelta sym={sym} size="sm" pill />
            </div>
          </div>
        </div>

        {/* chart style + timeframe */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <div style={{ display: 'inline-flex', background: 'var(--bg-inset)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 3 }}>
            {[['area', 'Line'], ['candle', 'Candles']].map(([v, l]) => (
              <button key={v} onClick={() => setStyle(v)} style={{
                padding: '6px 12px', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                font: '600 12px var(--font-sans)', display: 'flex', alignItems: 'center', gap: 5,
                background: style === v ? 'var(--bg-elevated)' : 'transparent',
                color: style === v ? 'var(--text-900)' : 'var(--text-500)',
              }}><Icon name={v === 'area' ? 'activity' : 'candlestick'} size={14} />{l}</button>
            ))}
          </div>
        </div>

        <div style={{ background: 'var(--bg-inset)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '12px 10px 8px' }}>
          {style === 'area'
            ? <AreaChart data={closes} width={320} height={150} color={c.color} />
            : <CandleChart candles={candles} width={320} height={150} />}
          <div style={{ display: 'flex', gap: 6, marginTop: 8, padding: '0 2px' }}>
            {['1W', '1M', '3M', 'All'].map((t) => <Chip key={t} active={tf === t} onClick={() => setTf(t)}>{t}</Chip>)}
          </div>
        </div>

        {/* stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
          {[
            ['Market cap', '$' + A.fmtCompact(c.mcap)],
            ['Period high', '$' + A.fmtPrice(hi)],
            ['Period low', '$' + A.fmtPrice(lo)],
            ['Your holdings', c.held ? `${A.fmt(c.held, c.held < 1 ? 4 : 2)} ${c.sym}` : '—'],
          ].map(([l, v]) => (
            <div key={l} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '11px 13px' }}>
              <div style={{ font: '11px var(--font-sans)', color: 'var(--text-400)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{l}</div>
              <div style={{ font: '15px var(--font-mono)', color: 'var(--text-900)', marginTop: 5 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* automate hint */}
        <button onClick={() => onAutomate && onAutomate(c)} style={{
          width: '100%', marginTop: 12, display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left',
          padding: '13px 14px', background: 'var(--violet-soft)', border: '1px solid var(--brand-border)',
          borderRadius: 'var(--radius-lg)', cursor: 'pointer', color: 'inherit',
        }}>
          <span style={{ color: 'var(--brand-text)' }}><Icon name="bot" size={20} /></span>
          <div style={{ flex: 1 }}>
            <div style={{ font: '600 13px var(--font-sans)', color: 'var(--text-900)' }}>Automate {c.sym} with a bot</div>
            <div style={{ font: '12px var(--font-sans)', color: 'var(--text-500)' }}>Let an AI strategy trade this pair for you</div>
          </div>
          <Icon name="chevron-right" size={18} />
        </button>

        {/* buy / sell */}
        <div style={{ display: 'flex', gap: 10, marginTop: 14, position: 'sticky', bottom: 0 }}>
          <Button variant="success" block onClick={() => setSide('buy')}>Buy {c.sym}</Button>
          <Button variant="danger" block onClick={() => setSide('sell')} disabled={!c.held}>Sell {c.sym}</Button>
        </div>
        {side && (
          <div style={{ marginTop: 10, padding: '10px 13px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', border: '1px solid var(--border)', font: '13px var(--font-sans)', color: 'var(--text-500)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="info" size={15} />
            <span>Order ticket for {side === 'buy' ? 'buying' : 'selling'} {c.sym} would open here — this is a prototype.</span>
          </div>
        )}
      </div>
    );
  }

  window.CoinDetail = CoinDetail;
})();
