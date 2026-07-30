/* Apex Trader — Home dashboard. Exports window.HomeScreen. */
(function () {
  const { useState } = React;
  const DS = window.ApexTraderDesignSystem_cd55a5;
  const { Icon, Avatar, PriceChange, Badge, Sparkline } = DS;
  const A = window.APEXAPP;

  const TONE = {
    opportunity: { c: 'var(--brand-text)', bg: 'var(--brand-surface)', bd: 'var(--brand-border)' },
    risk:        { c: 'var(--warning-500)', bg: 'var(--warning-soft)', bd: 'rgba(255,176,32,0.4)' },
    info:        { c: 'var(--info-500)', bg: 'var(--info-soft)', bd: 'rgba(77,168,255,0.4)' },
  };

  function InsightCard({ ins, onAct, wide }) {
    const tone = TONE[ins.tone] || TONE.info;
    return (
      <div style={{
        flex: 'none', width: wide ? '100%' : 260, scrollSnapAlign: 'start',
        background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
        padding: 15, boxShadow: 'var(--inset-top)', display: 'flex', flexDirection: 'column', gap: 9,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 30, height: 30, borderRadius: 9, background: tone.bg, border: `1px solid ${tone.bd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: tone.c }}>
            <Icon name={ins.icon} size={16} />
          </span>
          <span style={{ font: '11px var(--font-sans)', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: tone.c }}>{ins.tag}</span>
          <span className="apex-pulse" style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: 'var(--brand)' }} />
        </div>
        <div style={{ font: '600 14px var(--font-sans)', color: 'var(--text-900)', letterSpacing: '-0.01em' }}>{ins.title}</div>
        <div style={{ font: '12.5px var(--font-sans)', color: 'var(--text-500)', lineHeight: 1.45 }}>{ins.body}</div>
        <button onClick={() => onAct(ins)} style={{ alignSelf: 'flex-start', marginTop: 2, padding: 0, background: 'none', border: 'none', cursor: 'pointer', font: '600 13px var(--font-sans)', color: 'var(--brand-text)', display: 'flex', alignItems: 'center', gap: 4 }}>
          {ins.cta} <Icon name="chevron-right" size={15} />
        </button>
      </div>
    );
  }

  function HomeScreen({ nav, t }) {
    const { LiveBalance, AreaChart, useTickerValue, CoinRow } = window;
    const [tf, setTf] = useState('1W');
    const dayPnl = useTickerValue(() => {
      // delta vs 24h open across holdings
      let now = A.cashUSDT, base = A.cashUSDT;
      A.coins.forEach((c) => { if (c.held) { now += c.held * window.ApexLive.get(c.sym).price; base += c.held * c.open24; } });
      return { abs: now - base, pct: ((now - base) / base) * 100 };
    });
    const equity = A.equityFor(tf);
    const actions = [['plus', 'Deposit', () => nav.toast('Deposit flow')], ['repeat', 'Trade', () => nav.go('market')], ['bot', 'Bots', () => nav.go('bots')], ['sparkles', 'Insights', () => nav.openInsights()]];
    const liveBots = A.bots.filter((b) => b.status === 'live');

    return (
      <div style={{ paddingBottom: 8 }}>
        {/* top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 16px 6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <img src="assets/logo-mark.svg" width="26" height="26" alt="" />
            <span style={{ font: '700 16px var(--font-sans)', color: 'var(--text-900)', letterSpacing: '-0.02em' }}>Apex</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => nav.openInsights()} aria-label="Alerts" style={{ position: 'relative', width: 38, height: 38, borderRadius: '50%', background: 'var(--bg-surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-500)', cursor: 'pointer' }}>
              <Icon name="bell" size={18} />
              <span style={{ position: 'absolute', top: 8, right: 9, width: 7, height: 7, borderRadius: '50%', background: 'var(--brand)', border: '2px solid var(--bg-app)' }} />
            </button>
            <Avatar name="Alex Rivera" size={38} status="online" />
          </div>
        </div>

        {/* balance hero */}
        <div style={{ padding: '8px 16px 0' }}>
          <div style={{ border: '1px solid var(--brand-border)', background: 'linear-gradient(168deg, var(--violet-soft), transparent 58%), var(--bg-surface)', borderRadius: 'var(--radius-xl)', padding: 18, boxShadow: 'var(--glow-brand-soft)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ font: '11px var(--font-sans)', fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-400)' }}>Total balance</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, font: '11px var(--font-sans)', color: 'var(--up-500)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--up-500)' }} className="apex-pulse" />Live
              </span>
            </div>
            <LiveBalance style={{ display: 'block', font: '700 32px var(--font-mono)', color: 'var(--text-900)', letterSpacing: '-0.02em', marginTop: 6 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7 }}>
              <PriceChange value={+dayPnl.pct.toFixed(2)} percent pill size="sm" />
              <span style={{ font: '12px var(--font-mono)', color: dayPnl.abs >= 0 ? 'var(--up-500)' : 'var(--down-500)' }}>
                {dayPnl.abs >= 0 ? '+' : '−'}${A.fmt(Math.abs(dayPnl.abs))} today
              </span>
            </div>
            <div style={{ margin: '10px -4px 0' }}><AreaChart key={tf} data={equity} width={320} height={92} grid={false} /></div>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              {['1D', '1W', '1M', '1Y'].map((x) => (
                <button key={x} onClick={() => setTf(x)} style={{ flex: 1, padding: '6px', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', font: '600 12px var(--font-mono)', background: tf === x ? 'var(--brand-surface)' : 'transparent', color: tf === x ? 'var(--brand-text)' : 'var(--text-500)' }}>{x}</button>
              ))}
            </div>
          </div>
        </div>

        {/* quick actions */}
        <div style={{ padding: '14px 16px 0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
            {actions.map(([ic, lb, fn]) => (
              <button key={lb} onClick={fn} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: '13px 4px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', cursor: 'pointer' }}>
                <span style={{ color: 'var(--brand-text)' }}><Icon name={ic} size={20} /></span>
                <span style={{ font: '11px var(--font-sans)', color: 'var(--text-700)' }}>{lb}</span>
              </button>
            ))}
          </div>
        </div>

        {/* AI insights */}
        <window.SubHead action={<button onClick={() => nav.openInsights()} style={{ background: 'none', border: 'none', cursor: 'pointer', font: '13px var(--font-sans)', color: 'var(--brand-text)' }}>See all</button>}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="sparkles" size={15} style={{ color: 'var(--brand-text)' }} />AI insights</span>
        </window.SubHead>
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '0 16px 4px', scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}>
          {A.insights.map((ins) => <InsightCard key={ins.id} ins={ins} onAct={(i) => nav.actInsight(i)} />)}
        </div>

        {/* your assets */}
        <window.SubHead action={<button onClick={() => nav.go('assets')} style={{ background: 'none', border: 'none', cursor: 'pointer', font: '13px var(--font-sans)', color: 'var(--brand-text)' }}>See all</button>}>Your assets</window.SubHead>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', margin: '0 16px', overflow: 'hidden' }}>
          {A.coins.filter((c) => c.held).slice(0, 4).map((c, i) => (
            <div key={c.sym} style={{ borderTop: i ? '1px solid var(--border-soft)' : 'none' }}>
              <CoinRow c={c} showHolding onClick={() => nav.openCoin(c.sym)} dense />
            </div>
          ))}
        </div>

        {/* bots running */}
        <window.SubHead action={<button onClick={() => nav.go('bots')} style={{ background: 'none', border: 'none', cursor: 'pointer', font: '13px var(--font-sans)', color: 'var(--brand-text)' }}>Manage</button>}>Bots running</window.SubHead>
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {liveBots.slice(0, 2).map((b) => (
            <button key={b.id} onClick={() => nav.openBot(b.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '12px 14px', cursor: 'pointer' }}>
              <Avatar name={b.name} square brand size={38} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ font: '600 14px var(--font-sans)', color: 'var(--text-900)' }}>{b.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 2 }}>
                  <span style={{ font: '12px var(--font-mono)', color: 'var(--text-500)' }}>{b.pair}</span>
                  <Badge tone="up" dot>Live</Badge>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ font: '600 15px var(--font-mono)', color: b.pnl30 >= 0 ? 'var(--up-500)' : 'var(--down-500)' }}>{b.pnl30 >= 0 ? '+' : '−'}{Math.abs(b.pnl30).toFixed(1)}%</div>
                <div style={{ font: '10px var(--font-sans)', color: 'var(--text-400)' }}>30d</div>
              </div>
            </button>
          ))}
        </div>

        {/* recent automation */}
        <window.SubHead>Latest automated trades</window.SubHead>
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {A.activity.slice(0, 4).map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ width: 26, height: 26, borderRadius: 7, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: a.act === 'Bought' ? 'var(--up-soft)' : 'var(--down-soft)', color: a.act === 'Bought' ? 'var(--up-500)' : 'var(--down-500)' }}>
                <Icon name={a.act === 'Bought' ? 'arrow-down-right' : 'arrow-up-right'} size={14} />
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ font: '13px var(--font-sans)', color: 'var(--text-900)' }}>{a.act} <span style={{ fontFamily: 'var(--font-mono)' }}>{a.qty} {a.sym}</span></div>
                <div style={{ font: '11px var(--font-sans)', color: 'var(--text-400)' }}>{a.bot} · {a.t}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ font: '12px var(--font-mono)', color: 'var(--text-700)' }}>${A.fmtPrice(a.price)}</div>
                {a.pnl != null && <div style={{ font: '11px var(--font-mono)', color: a.pnl >= 0 ? 'var(--up-500)' : 'var(--down-500)' }}>{a.pnl >= 0 ? '+' : '−'}${A.fmt(Math.abs(a.pnl))}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  window.HomeScreen = HomeScreen;
  window.ApexInsightCard = InsightCard;
})();
