/* Apex Trader — app shell: tab nav, overlays, tweaks, device scaling, mount. */
(function () {
  const { useState, useEffect, useRef } = React;
  const DS = window.ApexTraderDesignSystem_cd55a5;
  const { Icon } = DS;
  const A = window.APEXAPP;

  // ---- accent theming ----------------------------------------------------
  const ACCENTS = {
    '#7B61FF': { text: '#B7AAFF', hover: '#9783FF', press: '#6849F0', rgb: '123,97,255' },
    '#4D6BFF': { text: '#Aac0ff', hover: '#6E86FF', press: '#3A56E0', rgb: '77,107,255' },
    '#29D7D7': { text: '#8DEDED', hover: '#4FE0E0', press: '#1FB3B3', rgb: '41,215,215' },
    '#B061FF': { text: '#D9B7FF', hover: '#C283FF', press: '#9A47F0', rgb: '176,97,255' },
  };
  function applyAccent(hex) {
    const a = ACCENTS[hex] || ACCENTS['#7B61FF'];
    const r = document.documentElement.style;
    r.setProperty('--brand', hex);
    r.setProperty('--brand-hover', a.hover);
    r.setProperty('--brand-press', a.press);
    r.setProperty('--brand-text', a.text);
    r.setProperty('--violet-soft', `rgba(${a.rgb},0.13)`);
    r.setProperty('--violet-line', `rgba(${a.rgb},0.40)`);
    r.setProperty('--violet-glow', `rgba(${a.rgb},0.35)`);
    r.setProperty('--glow-brand', `0 6px 22px rgba(${a.rgb},0.40)`);
  }

  // ---- bottom nav --------------------------------------------------------
  const TABS = [
    ['home', 'Home', 'home'],
    ['assets', 'Assets', 'wallet'],
    ['market', 'Market', 'candlestick'],
    ['bots', 'Bots', 'bot'],
    ['performance', 'Stats', 'bar-chart'],
  ];

  function BottomNav({ tab, onTab }) {
    return (
      <nav style={{ flex: 'none', display: 'flex', borderTop: '1px solid var(--border)', background: 'rgba(9,11,16,0.86)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', padding: '8px 6px 30px' }}>
        {TABS.map(([id, label, ic]) => {
          const on = tab === id;
          return (
            <button key={id} onClick={() => onTab(id)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '6px 0', border: 'none', background: 'transparent', cursor: 'pointer', color: on ? 'var(--brand-text)' : 'var(--text-500)' }}>
              <Icon name={ic} size={22} strokeWidth={on ? 2.4 : 2} />
              <span style={{ font: `${on ? 600 : 500} 10px var(--font-sans)` }}>{label}</span>
            </button>
          );
        })}
      </nav>
    );
  }

  const SCREENS = {
    home: () => window.HomeScreen, assets: () => window.AssetsScreen, market: () => window.MarketScreen,
    bots: () => window.BotsScreen, performance: () => window.PerformanceScreen,
  };

  // ---- insights overlay --------------------------------------------------
  function InsightsList({ nav }) {
    const Card = window.ApexInsightCard;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 8 }}>
        {A.insights.map((ins) => <Card key={ins.id} ins={ins} wide onAct={(i) => nav.actInsight(i)} />)}
      </div>
    );
  }

  // ---- the app -----------------------------------------------------------
  function App() {
    const { useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakToggle, TweakColor } = window;
    const [t, setTweak] = useTweaks(window.TWEAK_DEFAULTS);
    const chartStyle = t.chartView === 'Candle' ? 'candle' : 'area';

    const [tab, setTab] = useState('home');
    const [overlay, setOverlay] = useState(null);
    const [, setVersion] = useState(0);
    const [toast, setToast] = useState(null);
    const lastRef = useRef(null);
    if (overlay) lastRef.current = overlay;
    const ov = overlay || lastRef.current;
    const bump = () => setVersion((v) => v + 1);

    useEffect(() => { applyAccent(t.accent); }, [t.accent]);

    const nav = {
      go: (x) => { setOverlay(null); setTab(x); },
      openCoin: (sym) => setOverlay({ kind: 'coin', sym }),
      openBot: (id) => setOverlay({ kind: 'bot', id }),
      openDeploy: (presetPair) => setOverlay({ kind: 'deploy', presetPair }),
      openInsights: () => setOverlay({ kind: 'insights' }),
      toast: (msg) => { setToast(msg); clearTimeout(nav._tt); nav._tt = setTimeout(() => setToast(null), 2400); },
      toggleBot: (id) => { const b = A.bots.find((x) => x.id === id); if (b) { b.status = b.status === 'live' ? 'paused' : 'live'; bump(); nav.toast(b.status === 'live' ? `${b.name} resumed` : `${b.name} paused — no open orders affected`); } },
      applyBot: (b, cfg) => { b.cfg = { ...cfg }; b.risk = cfg.risk; bump(); nav.toast('Configuration saved'); },
      toggleBotStatus: (b, on) => { b.status = on ? 'live' : 'paused'; bump(); },
      actInsight: (ins) => {
        const route = { i1: () => nav.openCoin('SOL'), i2: () => nav.go('assets'), i3: () => nav.openBot('meanrev'), i4: () => nav.openDeploy() };
        (route[ins.id] || (() => nav.go('bots')))();
      },
      deploy: (data) => {
        const seed = Array.from({ length: 30 }, (_, i) => 1 + Math.sin(i / 4) * 0.04 + i * 0.005);
        A.bots.unshift({
          id: 'bot-' + Date.now(), name: data.tpl ? data.tpl.name : 'Custom strategy', pair: data.pair,
          type: data.tpl ? data.tpl.name : 'Custom', status: 'live', pnl30: 0, pnlUsd: 0, win: 0, trades: 0, sharpe: 0,
          risk: data.risk, spark: seed, blurb: 'Newly deployed — gathering performance data over the next few cycles.',
          cfg: { capital: data.capital, risk: data.risk, stopLoss: 4, takeProfit: 8, frequency: 'Intraday', hours: '24/7', maxDrawdown: 15, orderType: 'Limit', trailing: false },
        });
        setOverlay(null); setTab('bots'); bump(); nav.toast('Strategy deployed. Now managing 1 position.');
      },
    };

    const Screen = SCREENS[tab]();
    const sheetTitle = ov && { coin: ov.sym && (A.bySym[ov.sym] ? A.bySym[ov.sym].name : ov.sym), bot: 'Configure bot', deploy: 'Deploy a bot', insights: 'AI insights' }[ov.kind];

    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-app)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingTop: 48, paddingBottom: 6 }} key={tab}>
          {Screen ? <Screen nav={nav} t={{ chartStyle, showCopilot: t.showCopilot }} /> : null}
        </div>
        <BottomNav tab={tab} onTab={nav.go} />

        {/* overlays */}
        <window.BottomSheet open={!!overlay} onClose={() => setOverlay(null)} title={sheetTitle}>
          {ov && ov.kind === 'coin' && <window.CoinDetail sym={ov.sym} chartStyle={chartStyle} onAutomate={(c) => setOverlay({ kind: 'deploy', presetPair: c.sym + '/USDT' })} />}
          {ov && ov.kind === 'bot' && (() => { const b = A.bots.find((x) => x.id === ov.id); return b ? <window.BotConfig bot={b} onApply={nav.applyBot} onToggleStatus={nav.toggleBotStatus} /> : null; })()}
          {ov && ov.kind === 'deploy' && <window.DeployFlow presetPair={ov.presetPair} showCopilot={t.showCopilot} onDeploy={nav.deploy} />}
          {ov && ov.kind === 'insights' && <InsightsList nav={nav} />}
        </window.BottomSheet>

        {/* toast */}
        {toast && (
          <div style={{ position: 'absolute', left: 16, right: 16, bottom: 86, zIndex: 80, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'var(--ink-700)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-pill)', boxShadow: 'var(--shadow-3)', font: '13px var(--font-sans)', color: 'var(--text-900)' }}>
              <Icon name="check" size={15} style={{ color: 'var(--brand-text)' }} />{toast}
            </div>
          </div>
        )}

        {/* tweaks */}
        <TweaksPanel>
          <TweakSection label="Chart" />
          <TweakRadio label="Default chart" value={t.chartView || 'Line'} options={['Line', 'Candle']} onChange={(v) => setTweak('chartView', v)} />
          <TweakSection label="AI" />
          <TweakToggle label="Show AI Copilot" value={t.showCopilot} onChange={(v) => setTweak('showCopilot', v)} />
          <TweakSection label="Brand" />
          <TweakColor label="Accent" value={t.accent} options={['#7B61FF', '#4D6BFF', '#29D7D7', '#B061FF']} onChange={(v) => setTweak('accent', v)} />
        </TweaksPanel>
      </div>
    );
  }

  // ---- device + scaling --------------------------------------------------
  function Stage() {
    const { IOSDevice } = window;
    const [scale, setScale] = useState(1);
    useEffect(() => {
      const fit = () => {
        const s = Math.min(1, (window.innerHeight - 36) / 844, (window.innerWidth - 24) / 390);
        setScale(s);
      };
      fit();
      window.addEventListener('resize', fit);
      return () => window.removeEventListener('resize', fit);
    }, []);
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}>
          <IOSDevice dark width={390} height={844}>
            <App />
          </IOSDevice>
        </div>
      </div>
    );
  }

  function mount() {
    if (window.IOSDevice && window.HomeScreen && window.useTweaks && window.BotConfig) {
      ReactDOM.createRoot(document.getElementById('root')).render(<Stage />);
    } else { setTimeout(mount, 40); }
  }
  mount();
})();
