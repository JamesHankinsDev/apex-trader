/* Apex Trader — bot configuration controls, config sheet, and deploy flow.
   Exports window.BotConfig, window.DeployFlow. */
(function () {
  const { useState } = React;
  const DS = window.ApexTraderDesignSystem_cd55a5;
  const { Icon, Button, Badge, Switch, Avatar, Select } = DS;
  const A = window.APEXAPP;

  // one-time slider styling (brand accent + custom thumb)
  (function ensure() {
    if (document.getElementById('apex-range-css')) return;
    const el = document.createElement('style');
    el.id = 'apex-range-css';
    el.textContent = `
      .apex-range{ -webkit-appearance:none; appearance:none; width:100%; height:6px; border-radius:99px;
        background:var(--bg-inset); border:1px solid var(--border); outline:none; cursor:pointer; }
      .apex-range::-webkit-slider-thumb{ -webkit-appearance:none; width:22px; height:22px; border-radius:50%;
        background:var(--brand); border:3px solid var(--bg-raised); box-shadow:var(--glow-brand); cursor:grab; margin-top:-1px; }
      .apex-range::-moz-range-thumb{ width:18px; height:18px; border-radius:50%; background:var(--brand);
        border:3px solid var(--bg-raised); box-shadow:var(--glow-brand); cursor:grab; }
      .apex-range:active::-webkit-slider-thumb{ cursor:grabbing; transform:scale(1.06); }
    `;
    document.head.appendChild(el);
  })();

  function Segmented({ value, options, onChange, tone }) {
    return (
      <div style={{ display: 'flex', background: 'var(--bg-inset)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 3, gap: 3 }}>
        {options.map((o) => {
          const v = typeof o === 'string' ? o : o.value;
          const l = typeof o === 'string' ? o : o.label;
          const on = value === v;
          return (
            <button key={v} onClick={() => onChange(v)} style={{
              flex: 1, padding: '8px 4px', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              font: '600 12.5px var(--font-sans)', whiteSpace: 'nowrap',
              background: on ? 'var(--bg-elevated)' : 'transparent',
              color: on ? (tone || 'var(--text-900)') : 'var(--text-500)',
              boxShadow: on ? 'var(--shadow-1)' : 'none', transition: 'all .15s var(--ease-out)',
            }}>{l}</button>
          );
        })}
      </div>
    );
  }

  function Field({ label, value, hint, children, icon }) {
    return (
      <div style={{ marginBottom: 17 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, font: '600 13px var(--font-sans)', color: 'var(--text-700)' }}>
            {icon && <span style={{ color: 'var(--text-500)', display: 'flex' }}><Icon name={icon} size={15} /></span>}{label}
          </span>
          {value != null && <span style={{ font: '600 14px var(--font-mono)', color: 'var(--text-900)' }}>{value}</span>}
        </div>
        {children}
        {hint && <div style={{ font: '11.5px var(--font-sans)', color: 'var(--text-400)', marginTop: 7, lineHeight: 1.4 }}>{hint}</div>}
      </div>
    );
  }

  function Slider({ value, min, max, step = 1, onChange }) {
    const pct = ((value - min) / (max - min)) * 100;
    return (
      <input type="range" className="apex-range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(+e.target.value)}
        style={{ background: `linear-gradient(90deg, var(--brand) ${pct}%, var(--bg-inset) ${pct}%)` }} />
    );
  }

  const RISK_TONE = { Low: 'var(--up-500)', Medium: 'var(--warning-500)', High: 'var(--down-500)' };

  function StatTile({ label, value, color }) {
    return (
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '11px 12px' }}>
        <div style={{ font: '10px var(--font-sans)', color: 'var(--text-400)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
        <div style={{ font: '600 16px var(--font-mono)', color: color || 'var(--text-900)', marginTop: 5 }}>{value}</div>
      </div>
    );
  }

  // ---- the bot config sheet ---------------------------------------------
  function BotConfig({ bot, onApply, onToggleStatus, onClose }) {
    const { AreaChart, MiniArea } = window;
    const [cfg, setCfg] = useState({ ...bot.cfg });
    const [live, setLive] = useState(bot.status === 'live');
    const [saved, setSaved] = useState(false);
    const set = (k, v) => { setCfg((c) => ({ ...c, [k]: v })); setSaved(false); };

    const maxCap = 10000;
    const liquidation = (cfg.capital * (cfg.maxDrawdown / 100));

    return (
      <div style={{ paddingBottom: 4 }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <Avatar name={bot.name} square brand size={46} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: '700 17px var(--font-sans)', color: 'var(--text-900)' }}>{bot.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
              <span style={{ font: '12px var(--font-mono)', color: 'var(--text-500)' }}>{bot.pair}</span>
              <Badge tone={live ? 'up' : 'neutral'} dot>{live ? 'Live' : 'Paused'}</Badge>
              <span style={{ font: '11px var(--font-sans)', color: RISK_TONE[cfg.risk] }}>{cfg.risk} risk</span>
            </div>
          </div>
          <Switch checked={live} onChange={(e) => { setLive(e.target.checked); onToggleStatus(bot, e.target.checked); }} />
        </div>

        <div style={{ font: '12.5px var(--font-sans)', color: 'var(--text-500)', lineHeight: 1.5, marginBottom: 14 }}>{bot.blurb}</div>

        {/* performance */}
        <div style={{ background: 'var(--bg-inset)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '12px 12px 6px', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ font: '11px var(--font-sans)', color: 'var(--text-400)', textTransform: 'uppercase', letterSpacing: '.08em' }}>30-day return</span>
            <span style={{ font: '700 18px var(--font-mono)', color: bot.pnl30 >= 0 ? 'var(--up-500)' : 'var(--down-500)' }}>{bot.pnl30 >= 0 ? '+' : '−'}{Math.abs(bot.pnl30).toFixed(1)}%</span>
          </div>
          <AreaChart data={bot.spark} width={320} height={70} grid={false} color={bot.pnl30 >= 0 ? 'var(--up-500)' : 'var(--down-500)'} />
        </div>

        {/* backtest stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 6 }}>
          <StatTile label="Win rate" value={bot.win + '%'} />
          <StatTile label="Trades" value={bot.trades} />
          <StatTile label="Sharpe" value={bot.sharpe.toFixed(2)} />
        </div>
        <div style={{ font: '11px var(--font-sans)', color: 'var(--text-400)', margin: '4px 2px 18px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="info" size={13} /> Backtested over 90 days. Past performance doesn’t guarantee future results.
        </div>

        {/* ===== CONFIG ===== */}
        <div style={{ font: '11px var(--font-sans)', fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--brand-text)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
          <Icon name="sliders" size={14} /> Strategy configuration
        </div>

        <Field label="Capital allocation" icon="dollar-sign" value={'$' + A.fmt(cfg.capital, 0)} hint={`Allocated from your $${A.fmt(A.cashUSDT)} available cash. The bot only trades with this amount.`}>
          <Slider value={cfg.capital} min={100} max={maxCap} step={100} onChange={(v) => set('capital', v)} />
          <div style={{ display: 'flex', justifyContent: 'space-between', font: '11px var(--font-mono)', color: 'var(--text-400)', marginTop: 5 }}>
            <span>$100</span><span>${A.fmtCompact(maxCap)}</span>
          </div>
        </Field>

        <Field label="Risk level" icon="gauge" hint="Higher risk lets the bot take larger, more frequent positions.">
          <Segmented value={cfg.risk} options={['Low', 'Medium', 'High']} onChange={(v) => set('risk', v)} tone={RISK_TONE[cfg.risk]} />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Stop loss" icon="shield" value={cfg.stopLoss ? '−' + cfg.stopLoss + '%' : 'Off'}>
            <Slider value={cfg.stopLoss} min={0} max={20} step={0.5} onChange={(v) => set('stopLoss', v)} />
          </Field>
          <Field label="Take profit" icon="trending-up" value={cfg.takeProfit ? '+' + cfg.takeProfit + '%' : 'Off'}>
            <Slider value={cfg.takeProfit} min={0} max={30} step={0.5} onChange={(v) => set('takeProfit', v)} />
          </Field>
        </div>

        <Field label="Trade frequency" icon="clock" hint="How often the bot looks for and acts on opportunities.">
          <Segmented value={cfg.frequency} options={['Scalp', 'Intraday', 'Swing', 'Daily']} onChange={(v) => set('frequency', v)} />
        </Field>

        <Field label="Trading hours" icon="clock">
          <Segmented value={cfg.hours} options={[{ value: '24/7', label: 'Always on (24/7)' }, { value: 'Custom', label: 'Custom window' }]} onChange={(v) => set('hours', v)} />
          {cfg.hours === 'Custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <Select size="sm" options={['00:00', '06:00', '08:00', '09:30', '12:00']} defaultValue="08:00" />
              <span style={{ color: 'var(--text-400)' }}><Icon name="arrow-up-right" size={14} /></span>
              <Select size="sm" options={['16:00', '18:00', '20:00', '22:00', '23:59']} defaultValue="22:00" />
            </div>
          )}
        </Field>

        {/* max drawdown — safety */}
        <div style={{ background: 'var(--warning-soft)', border: '1px solid rgba(255,176,32,0.35)', borderRadius: 'var(--radius-lg)', padding: 14, marginBottom: 16 }}>
          <Field label="Max drawdown safety stop" icon="alert-triangle" value={cfg.maxDrawdown + '%'} hint={null}>
            <Slider value={cfg.maxDrawdown} min={5} max={40} step={1} onChange={(v) => set('maxDrawdown', v)} />
          </Field>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, font: '12px var(--font-sans)', color: 'var(--text-700)', marginTop: -4 }}>
            <Icon name="lock" size={14} style={{ color: 'var(--warning-500)' }} />
            <span>Auto-pauses if losses reach <b style={{ fontFamily: 'var(--font-mono)', color: 'var(--warning-500)' }}>${A.fmt(liquidation, 0)}</b> ({cfg.maxDrawdown}% of capital).</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'start' }}>
          <Field label="Order type" icon="repeat">
            <Segmented value={cfg.orderType} options={['Market', 'Limit']} onChange={(v) => set('orderType', v)} />
          </Field>
          <div style={{ marginBottom: 17 }}>
            <div style={{ font: '600 13px var(--font-sans)', color: 'var(--text-700)', marginBottom: 9, display: 'flex', alignItems: 'center', gap: 7 }}><Icon name="activity" size={15} style={{ color: 'var(--text-500)' }} />Trailing stop</div>
            <div style={{ height: 44, display: 'flex', alignItems: 'center', padding: '0 12px', background: 'var(--bg-inset)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
              <Switch checked={cfg.trailing} onChange={(e) => set('trailing', e.target.checked)} label={cfg.trailing ? 'On' : 'Off'} size="sm" />
            </div>
          </div>
        </div>

        {/* footer actions */}
        <div style={{ position: 'sticky', bottom: 0, background: 'linear-gradient(to top, var(--bg-raised) 70%, transparent)', paddingTop: 8, marginTop: 4 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant={live ? 'secondary' : 'secondary'} onClick={() => { setLive(!live); onToggleStatus(bot, !live); }} iconLeft={<Icon name={live ? 'pause' : 'play'} size={16} />}>
              {live ? 'Pause' : 'Resume'}
            </Button>
            <Button variant="primary" block onClick={() => { onApply(bot, cfg); setSaved(true); }} iconLeft={<Icon name="check" size={16} />}>
              {saved ? 'Saved' : 'Save changes'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ---- deploy new bot flow ----------------------------------------------
  function DeployFlow({ presetPair, showCopilot, onDeploy, onClose }) {
    const [step, setStep] = useState('pick'); // pick | configure
    const [tpl, setTpl] = useState(null);
    const [copilotText, setCopilotText] = useState('');
    const [pair, setPair] = useState(presetPair || 'BTC/USDT');
    const [capital, setCapital] = useState(1000);
    const [risk, setRisk] = useState('Low');

    const pairs = A.coins.map((c) => c.sym + '/USDT');

    if (step === 'configure') {
      return (
        <div style={{ paddingBottom: 8 }}>
          <button onClick={() => setStep('pick')} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-500)', font: '13px var(--font-sans)', marginBottom: 14, padding: 0 }}>
            <Icon name="chevron-left" size={16} /> Back
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 16 }}>
            <span style={{ width: 42, height: 42, borderRadius: 11, background: 'var(--brand-surface)', border: '1px solid var(--brand-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-text)' }}>
              <Icon name={tpl ? tpl.icon : 'sparkles'} size={20} />
            </span>
            <div>
              <div style={{ font: '700 16px var(--font-sans)', color: 'var(--text-900)' }}>{tpl ? tpl.name : 'Custom strategy'}</div>
              <div style={{ font: '12px var(--font-sans)', color: 'var(--text-500)' }}>{tpl ? tpl.desc : 'Generated from your description'}</div>
            </div>
          </div>

          <Field label="Trading pair" icon="candlestick">
            <Select options={pairs} value={pair} onChange={(e) => setPair(e.target.value)} />
          </Field>
          <Field label="Capital" icon="dollar-sign" value={'$' + A.fmt(capital, 0)} hint={`From your $${A.fmt(A.cashUSDT)} available cash.`}>
            <Slider value={capital} min={100} max={5000} step={100} onChange={setCapital} />
          </Field>
          <Field label="Risk level" icon="gauge">
            <Segmented value={risk} options={['Low', 'Medium', 'High']} onChange={setRisk} tone={RISK_TONE[risk]} />
          </Field>

          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 13, font: '12.5px var(--font-sans)', color: 'var(--text-500)', lineHeight: 1.5, marginBottom: 16 }}>
            Deploy {tpl ? tpl.name : 'this strategy'} on <b style={{ color: 'var(--text-900)', fontFamily: 'var(--font-mono)' }}>{pair}</b> with <b style={{ color: 'var(--text-900)', fontFamily: 'var(--font-mono)' }}>${A.fmt(capital, 0)}</b>? You can pause or adjust it anytime.
          </div>
          <Button variant="primary" block size="lg" iconLeft={<Icon name="zap" size={17} />}
            onClick={() => onDeploy({ tpl, pair, capital, risk })}>Deploy bot</Button>
        </div>
      );
    }

    return (
      <div style={{ paddingBottom: 8 }}>
        {showCopilot && (
          <div style={{ background: 'linear-gradient(150deg, var(--violet-soft), transparent 70%), var(--bg-surface)', border: '1px solid var(--brand-border)', borderRadius: 'var(--radius-lg)', padding: 15, marginBottom: 16, boxShadow: 'var(--glow-brand-soft)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ color: 'var(--brand-text)' }}><Icon name="sparkles" size={18} /></span>
              <span style={{ font: '600 14px var(--font-sans)', color: 'var(--text-900)' }}>Build with Copilot</span>
            </div>
            <textarea value={copilotText} onChange={(e) => setCopilotText(e.target.value)} rows={2}
              placeholder="e.g. Buy SOL when it dips 5% and sell at 8% profit"
              style={{ width: '100%', resize: 'none', background: 'var(--bg-inset)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '11px 12px', color: 'var(--text-900)', font: '13.5px var(--font-sans)', outline: 'none', boxSizing: 'border-box' }} />
            <Button variant="primary" block style={{ marginTop: 10 }} iconLeft={<Icon name="cpu" size={16} />}
              onClick={() => { setTpl(null); setStep('configure'); }}>Generate strategy</Button>
          </div>
        )}

        <div style={{ font: '11px var(--font-sans)', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-400)', marginBottom: 12 }}>Or start from a template</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {A.templates.map((t) => (
            <button key={t.id} onClick={() => { setTpl(t); setStep('configure'); }} style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
              background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 14, cursor: 'pointer',
            }}>
              <span style={{ width: 40, height: 40, borderRadius: 11, flex: 'none', background: 'var(--bg-elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-text)' }}>
                <Icon name={t.icon} size={19} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ font: '600 14px var(--font-sans)', color: 'var(--text-900)' }}>{t.name}</span>
                  <Badge tone={t.risk === 'Low' ? 'up' : t.risk === 'High' ? 'down' : 'warning'}>{t.risk}</Badge>
                </div>
                <div style={{ font: '12px var(--font-sans)', color: 'var(--text-500)', marginTop: 3, lineHeight: 1.4 }}>{t.desc}</div>
              </div>
              <Icon name="chevron-right" size={18} />
            </button>
          ))}
        </div>
      </div>
    );
  }

  Object.assign(window, { BotConfig, DeployFlow });
})();
