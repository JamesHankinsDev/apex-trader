/* Apex Trader — Market (all assets) screen. Exports window.MarketScreen. */
(function () {
  const { useState } = React;
  const DS = window.ApexTraderDesignSystem_cd55a5;
  const { Icon, Tag } = DS;
  const A = window.APEXAPP;

  const FILTERS = ['All', 'Gainers', 'Losers', 'Held'];

  function MarketScreen({ nav, t }) {
    const { CoinRow } = window;
    const [q, setQ] = useState('');
    const [seg, setSeg] = useState('All');

    let list = A.coins.slice();
    if (seg === 'Gainers') list = list.filter((c) => c.chg > 0).sort((a, b) => b.chg - a.chg);
    else if (seg === 'Losers') list = list.filter((c) => c.chg < 0).sort((a, b) => a.chg - b.chg);
    else if (seg === 'Held') list = list.filter((c) => c.held);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      list = list.filter((c) => c.sym.toLowerCase().includes(s) || c.name.toLowerCase().includes(s));
    }

    return (
      <div style={{ paddingBottom: 8 }}>
        <window.ScreenHead title="Market" sub="12 assets · live prices" />

        <window.Section>
          <label style={{ display: 'flex', alignItems: 'center', gap: 9, height: 44, padding: '0 13px', background: 'var(--bg-inset)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-400)' }}>
            <Icon name="search" size={18} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search coins" style={{ border: 'none', outline: 'none', background: 'transparent', color: 'var(--text-900)', font: '15px var(--font-sans)', width: '100%' }} />
            {q && <button onClick={() => setQ('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-500)', display: 'flex' }}><Icon name="x" size={16} /></button>}
          </label>
        </window.Section>

        <window.Section style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {FILTERS.map((s) => <Tag key={s} clickable selected={seg === s} onClick={() => setSeg(s)}>{s}</Tag>)}
          </div>
        </window.Section>

        {/* column header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 16px 6px', font: '11px var(--font-sans)', color: 'var(--text-400)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
          <span>Asset</span>
          <span style={{ marginLeft: 'auto' }}>Price · 24h</span>
        </div>

        <div>
          {list.length === 0 && (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-400)', font: '14px var(--font-sans)' }}>
              No coins match “{q}”.
            </div>
          )}
          {list.map((c, i) => (
            <div key={c.sym} style={{ borderTop: i ? '1px solid var(--border-soft)' : 'none' }}>
              <CoinRow c={c} onClick={() => nav.openCoin(c.sym)} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  window.MarketScreen = MarketScreen;
})();
