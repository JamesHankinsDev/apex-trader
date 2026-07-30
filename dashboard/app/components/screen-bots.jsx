/* Apex Trader — Bots / automation home screen. Exports window.BotsScreen. */
(function () {
  const DS = window.ApexTraderDesignSystem_cd55a5;
  const { Icon, Avatar, Badge, Sparkline } = DS;
  const A = window.APEXAPP;

  const RISK_TONE = { Low: 'var(--up-500)', Medium: 'var(--warning-500)', High: 'var(--down-500)' };

  function BotCard({ b, nav }) {
    const live = b.status === 'live';
    return (
      <div onClick={() => nav.openBot(b.id)} style={{ background: 'var(--bg-surface)', border: `1px solid ${live ? 'var(--brand-border)' : 'var(--border)'}`, borderRadius: 'var(--radius-lg)', padding: 14, cursor: 'pointer', boxShadow: 'var(--inset-top)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <Avatar name={b.name} square brand size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: '600 14px var(--font-sans)', color: 'var(--text-900)' }}>{b.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 3 }}>
              <span style={{ font: '12px var(--font-mono)', color: 'var(--text-500)' }}>{b.pair}</span>
              <Badge tone={live ? 'up' : 'neutral'} dot>{live ? 'Live' : 'Paused'}</Badge>
            </div>
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <DS.Switch checked={live} onChange={() => nav.toggleBot(b.id)} size="sm" />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 13 }}>
          <div style={{ display: 'flex', gap: 18 }}>
            <div>
              <div style={{ font: '10px var(--font-sans)', color: 'var(--text-400)', textTransform: 'uppercase', letterSpacing: '.06em' }}>30d</div>
              <div style={{ font: '600 17px var(--font-mono)', color: b.pnl30 >= 0 ? 'var(--up-500)' : 'var(--down-500)' }}>{b.pnl30 >= 0 ? '+' : '−'}{Math.abs(b.pnl30).toFixed(1)}%</div>
            </div>
            <div>
              <div style={{ font: '10px var(--font-sans)', color: 'var(--text-400)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Capital</div>
              <div style={{ font: '600 17px var(--font-mono)', color: 'var(--text-900)' }}>${A.fmtCompact(b.cfg.capital)}</div>
            </div>
            <div>
              <div style={{ font: '10px var(--font-sans)', color: 'var(--text-400)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Risk</div>
              <div style={{ font: '600 13px var(--font-sans)', color: RISK_TONE[b.cfg.risk], marginTop: 2 }}>{b.cfg.risk}</div>
            </div>
          </div>
          <Sparkline data={b.spark} width={84} height={34} tone={b.pnl30 >= 0 ? 'up' : 'down'} />
        </div>
      </div>
    );
  }

  function BotsScreen({ nav, t, version }) {
    const live = A.bots.filter((b) => b.status === 'live');
    const deployed = live.reduce((s, b) => s + b.cfg.capital, 0);
    const combined = live.reduce((s, b) => s + b.pnlUsd, 0);

    return (
      <div style={{ paddingBottom: 8 }}>
        <window.ScreenHead title="AI Bots" sub="Automated strategies trading for you" action={
          <button onClick={() => nav.openDeploy()} aria-label="Deploy bot" style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--brand)', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: 'var(--glow-brand)' }}>
            <Icon name="plus" size={20} />
          </button>
        } />

        {/* summary */}
        <window.Section>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {[
              ['Deployed', '$' + A.fmtCompact(deployed), 'var(--text-900)'],
              ['30d P&L', (combined >= 0 ? '+$' : '−$') + A.fmt(Math.abs(combined), 0), combined >= 0 ? 'var(--up-500)' : 'var(--down-500)'],
              ['Live bots', String(live.length), 'var(--brand-text)'],
            ].map(([l, v, c]) => (
              <div key={l} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '12px 13px' }}>
                <div style={{ font: '10px var(--font-sans)', color: 'var(--text-400)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{l}</div>
                <div style={{ font: '700 17px var(--font-mono)', color: c, marginTop: 5 }}>{v}</div>
              </div>
            ))}
          </div>
        </window.Section>

        {/* copilot (tweakable) */}
        {t.showCopilot && (
          <window.Section style={{ marginTop: 14 }}>
            <button onClick={() => nav.openDeploy()} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', border: '1px solid var(--brand-border)', background: 'linear-gradient(150deg, var(--violet-soft), transparent 65%), var(--bg-surface)', borderRadius: 'var(--radius-lg)', padding: 14, cursor: 'pointer', boxShadow: 'var(--glow-brand-soft)' }}>
              <span style={{ color: 'var(--brand-text)' }}><Icon name="sparkles" size={22} /></span>
              <div style={{ flex: 1 }}>
                <div style={{ font: '600 14px var(--font-sans)', color: 'var(--text-900)' }}>Build with Copilot</div>
                <div style={{ font: '12px var(--font-sans)', color: 'var(--text-500)' }}>Describe a strategy in plain English</div>
              </div>
              <Icon name="chevron-right" size={18} />
            </button>
          </window.Section>
        )}

        {/* bot list */}
        <window.SubHead>Your bots <span style={{ font: '12px var(--font-mono)', color: 'var(--text-400)', fontWeight: 400 }}>· {A.bots.length}</span></window.SubHead>
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {A.bots.map((b) => <BotCard key={b.id} b={b} nav={nav} />)}
        </div>
      </div>
    );
  }

  window.BotsScreen = BotsScreen;
})();
