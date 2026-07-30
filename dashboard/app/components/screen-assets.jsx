/* Apex Trader — Assets (holdings) screen. Exports window.AssetsScreen. */
(function () {
  const DS = window.ApexTraderDesignSystem_cd55a5;
  const { Icon, PriceChange } = DS;
  const A = window.APEXAPP;

  function AssetsScreen({ nav, t }) {
    const { Donut, useTickerValue, LiveBalance, CoinRow } = window;

    const alloc = useTickerValue(() => {
      const rows = [];
      let total = A.cashUSDT;
      A.coins.forEach((c) => { if (c.held) total += c.held * window.ApexLive.get(c.sym).price; });
      A.coins.forEach((c) => {
        if (!c.held) return;
        const v = c.held * window.ApexLive.get(c.sym).price;
        rows.push({ sym: c.sym, color: c.color, value: v, pct: (v / total) * 100 });
      });
      rows.push({ sym: 'USDT', color: '#3A4150', value: A.cashUSDT, pct: (A.cashUSDT / total) * 100 });
      rows.sort((a, b) => b.value - a.value);
      return { rows, total };
    });

    const pnl = useTickerValue(() => {
      let now = A.cashUSDT, base = A.cashUSDT;
      A.coins.forEach((c) => { if (c.held) { now += c.held * window.ApexLive.get(c.sym).price; base += c.held * c.open24; } });
      return { abs: now - base, pct: ((now - base) / base) * 100 };
    });
    const invested = alloc.total - A.cashUSDT;
    const held = A.coins.filter((c) => c.held);

    return (
      <div style={{ paddingBottom: 8 }}>
        <window.ScreenHead title="Assets" sub="Your portfolio holdings" action={
          <button onClick={() => nav.go('market')} style={{ height: 36, padding: '0 14px', borderRadius: 'var(--radius-md)', background: 'var(--brand)', border: 'none', color: '#fff', font: '600 13px var(--font-sans)', cursor: 'pointer', boxShadow: 'var(--glow-brand)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name="plus" size={15} />Add
          </button>
        } />

        {/* allocation */}
        <window.Section>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 18, boxShadow: 'var(--inset-top)' }}>
            <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
              <Donut data={alloc.rows} size={132} thickness={18}>
                <div style={{ font: '10px var(--font-sans)', color: 'var(--text-400)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Value</div>
                <LiveBalance style={{ font: '700 16px var(--font-mono)', color: 'var(--text-900)' }} />
              </Donut>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9 }}>
                {alloc.rows.map((r) => (
                  <div key={r.sym} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: r.color, flex: 'none' }} />
                    <span style={{ font: '600 12px var(--font-mono)', color: 'var(--text-900)', width: 42 }}>{r.sym}</span>
                    <span style={{ font: '12px var(--font-mono)', color: 'var(--text-500)', marginLeft: 'auto' }}>{r.pct.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </window.Section>

        {/* summary stats */}
        <window.Section style={{ marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 16px' }}>
              <div style={{ font: '11px var(--font-sans)', color: 'var(--text-400)', textTransform: 'uppercase', letterSpacing: '.06em' }}>24h profit / loss</div>
              <div style={{ font: '700 19px var(--font-mono)', color: pnl.abs >= 0 ? 'var(--up-500)' : 'var(--down-500)', marginTop: 6 }}>{pnl.abs >= 0 ? '+' : '−'}${A.fmt(Math.abs(pnl.abs))}</div>
              <div style={{ marginTop: 4 }}><PriceChange value={+pnl.pct.toFixed(2)} percent size="sm" /></div>
            </div>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 16px' }}>
              <div style={{ font: '11px var(--font-sans)', color: 'var(--text-400)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Invested · cash</div>
              <div style={{ font: '700 19px var(--font-mono)', color: 'var(--text-900)', marginTop: 6 }}>${A.fmtCompact(invested)}</div>
              <div style={{ font: '12px var(--font-mono)', color: 'var(--text-500)', marginTop: 4 }}>${A.fmt(A.cashUSDT)} USDT free</div>
            </div>
          </div>
        </window.Section>

        {/* holdings */}
        <window.SubHead>Holdings <span style={{ font: '12px var(--font-mono)', color: 'var(--text-400)', fontWeight: 400 }}>· {held.length}</span></window.SubHead>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', margin: '0 16px', overflow: 'hidden' }}>
          {held.map((c, i) => {
            const row = alloc.rows.find((r) => r.sym === c.sym);
            return (
              <div key={c.sym} style={{ borderTop: i ? '1px solid var(--border-soft)' : 'none' }}>
                <CoinRow c={c} showHolding onClick={() => nav.openCoin(c.sym)} />
                <div style={{ height: 3, margin: '0 16px 10px', borderRadius: 99, background: 'var(--bg-inset)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${row ? row.pct : 0}%`, background: c.color, borderRadius: 99, transition: 'width .5s var(--ease-out)' }} />
                </div>
              </div>
            );
          })}
          {/* cash row */}
          <div style={{ borderTop: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px' }}>
            <span style={{ width: 38, height: 38, borderRadius: '50%', flex: 'none', background: 'var(--bg-elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--up-500)' }}><Icon name="dollar-sign" size={18} /></span>
            <div>
              <div style={{ font: '600 14px var(--font-mono)', color: 'var(--text-900)' }}>USDT</div>
              <div style={{ font: '12px var(--font-sans)', color: 'var(--text-400)' }}>Available cash</div>
            </div>
            <div style={{ marginLeft: 'auto', font: '14px var(--font-mono)', color: 'var(--text-900)' }}>${A.fmt(A.cashUSDT)}</div>
          </div>
        </div>

        <window.Section style={{ marginTop: 14 }}>
          <button onClick={() => nav.openInsights()} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left', padding: '13px 14px', background: 'var(--violet-soft)', border: '1px solid var(--brand-border)', borderRadius: 'var(--radius-lg)', cursor: 'pointer', color: 'inherit' }}>
            <span style={{ color: 'var(--brand-text)' }}><Icon name="sparkles" size={20} /></span>
            <div style={{ flex: 1 }}>
              <div style={{ font: '600 13px var(--font-sans)', color: 'var(--text-900)' }}>2 insights about your portfolio</div>
              <div style={{ font: '12px var(--font-sans)', color: 'var(--text-500)' }}>You're concentrated in BTC · idle cash detected</div>
            </div>
            <Icon name="chevron-right" size={18} />
          </button>
        </window.Section>
      </div>
    );
  }

  window.AssetsScreen = AssetsScreen;
})();
