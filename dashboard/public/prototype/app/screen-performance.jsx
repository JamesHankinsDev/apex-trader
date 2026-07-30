/* Apex Trader — Performance / history screen. Exports window.PerformanceScreen. */
(function () {
  const { useState } = React;
  const DS = window.ApexTraderDesignSystem_cd55a5;
  const { Icon, PriceChange } = DS;
  const A = window.APEXAPP;

  function closesToCandles(closes) {
    // group into ~ (n/24) buckets, build OHLC per bucket
    const target = 24;
    const size = Math.max(1, Math.round(closes.length / target));
    const out = [];
    for (let i = 0; i < closes.length; i += size) {
      const seg = closes.slice(i, i + size);
      if (!seg.length) continue;
      out.push({ o: seg[0], c: seg[seg.length - 1], h: Math.max(...seg), l: Math.min(...seg) });
    }
    return out;
  }

  const MONTHS = [
    { label: 'Jan', v: 4.2 }, { label: 'Feb', v: -1.8 }, { label: 'Mar', v: 6.1 },
    { label: 'Apr', v: 2.4 }, { label: 'May', v: -0.9 }, { label: 'Jun', v: 5.3 },
  ];

  function PerformanceScreen({ nav, t }) {
    const { AreaChart, CandleChart, Bars } = window;
    const [tf, setTf] = useState('1M');
    const [style, setStyle] = useState(t.chartStyle || 'area');
    React.useEffect(() => { setStyle(t.chartStyle || 'area'); }, [t.chartStyle]);

    const series = A.equityFor(tf);
    const ret = ((series[series.length - 1] / series[0]) - 1) * 100;
    const candles = closesToCandles(series);
    const held = A.coins.filter((c) => c.held);

    return (
      <div style={{ paddingBottom: 8 }}>
        <window.ScreenHead title="Performance" sub="How your portfolio is doing" />

        {/* hero chart */}
        <window.Section>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 16, boxShadow: 'var(--inset-top)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
              <div>
                <div style={{ font: '11px var(--font-sans)', color: 'var(--text-400)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{tf} return</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginTop: 5 }}>
                  <span style={{ font: '700 26px var(--font-mono)', color: ret >= 0 ? 'var(--up-500)' : 'var(--down-500)', letterSpacing: '-0.02em' }}>{ret >= 0 ? '+' : '−'}{Math.abs(ret).toFixed(2)}%</span>
                </div>
              </div>
              {/* chart style toggle (mirrors the Tweak) */}
              <div style={{ display: 'inline-flex', background: 'var(--bg-inset)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 3 }}>
                {[['area', 'activity'], ['candle', 'candlestick']].map(([v, ic]) => (
                  <button key={v} onClick={() => setStyle(v)} aria-label={v} style={{ width: 36, height: 30, border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: style === v ? 'var(--bg-elevated)' : 'transparent', color: style === v ? 'var(--text-900)' : 'var(--text-500)' }}>
                    <Icon name={ic} size={16} />
                  </button>
                ))}
              </div>
            </div>
            <div style={{ margin: '6px -2px 0' }}>
              {style === 'area'
                ? <AreaChart key={tf} data={series} width={320} height={158} color="var(--brand)" />
                : <CandleChart key={tf} candles={candles} width={320} height={158} />}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              {['1D', '1W', '1M', '3M', '1Y'].map((x) => (
                <button key={x} onClick={() => setTf(x)} style={{ flex: 1, padding: '7px', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', font: '600 12px var(--font-mono)', background: tf === x ? 'var(--brand-surface)' : 'transparent', color: tf === x ? 'var(--brand-text)' : 'var(--text-500)' }}>{x}</button>
              ))}
            </div>
          </div>
        </window.Section>

        {/* key metrics */}
        <window.Section style={{ marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {[
              ['All-time', '+38.6%', 'var(--up-500)'],
              ['Best day', '+8.1%', 'var(--up-500)'],
              ['Win days', '63%', 'var(--text-900)'],
            ].map(([l, v, c]) => (
              <div key={l} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '12px 13px' }}>
                <div style={{ font: '10px var(--font-sans)', color: 'var(--text-400)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{l}</div>
                <div style={{ font: '700 16px var(--font-mono)', color: c, marginTop: 5 }}>{v}</div>
              </div>
            ))}
          </div>
        </window.Section>

        {/* monthly P&L bars */}
        <window.SubHead>Monthly P&L</window.SubHead>
        <window.Section>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 16px 12px' }}>
            <Bars data={MONTHS} width={320} height={108} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              {MONTHS.map((m) => (
                <span key={m.label} style={{ flex: 1, textAlign: 'center', font: '10px var(--font-mono)', color: m.v >= 0 ? 'var(--up-500)' : 'var(--down-500)' }}>{m.label}</span>
              ))}
            </div>
          </div>
        </window.Section>

        {/* by asset grid */}
        <window.SubHead>By asset</window.SubHead>
        <window.Section>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {held.map((c) => {
              const r = ((c.closes[c.closes.length - 1] / c.closes[0]) - 1) * 100;
              return (
                <button key={c.sym} onClick={() => nav.openCoin(c.sym)} style={{ textAlign: 'left', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 13, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    {window.CoinGlyph ? <window.CoinGlyph c={c} size={26} /> : null}
                    <span style={{ font: '600 13px var(--font-mono)', color: 'var(--text-900)' }}>{c.sym}</span>
                    <span style={{ marginLeft: 'auto' }}><PriceChange value={+r.toFixed(1)} percent size="sm" showArrow={false} /></span>
                  </div>
                  <window.MiniArea data={c.spark} color={c.color} height={38} />
                </button>
              );
            })}
          </div>
        </window.Section>
      </div>
    );
  }

  window.PerformanceScreen = PerformanceScreen;
})();
