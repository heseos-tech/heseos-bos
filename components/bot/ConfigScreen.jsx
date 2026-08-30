'use client';
// Bot Configuration — the self-service editor: "self service bot configuration so we can make
// bot live on the go for anyone who wants our bot." Every field a tenant set at signup
// (app/bot/signup) is editable here, plus the Go Live / Pause switch that actually flips
// whether the bot is presented as live in the sidebar/console.
import { useState } from 'react';
import { Topbar } from './ConsoleShell';
import { Switch } from './ui';
import { LANGUAGES } from '@/lib/botPresets';
import { IconWhatsApp, IconCheck } from './icons';

const BRAND_COLORS = ['#D9481E', '#0f172a', '#2563eb', '#7c3aed', '#16a34a', '#dc2626', '#14b8a6'];

export default function ConfigScreen({ tenant: initialTenant }) {
  const [tenant, setTenant] = useState(initialTenant);
  const [businessName, setBusinessName] = useState(initialTenant.businessName || '');
  const [botName, setBotName] = useState(initialTenant.botName || '');
  const [brandColor, setBrandColor] = useState(initialTenant.brandColor || '#D9481E');
  const [languages, setLanguages] = useState(initialTenant.languages || ['en']);
  const [welcome, setWelcome] = useState(initialTenant.welcomeMessage || {});
  const [menu, setMenu] = useState(initialTenant.menuOptions || []);
  const [activeLang, setActiveLang] = useState((initialTenant.languages || ['en'])[0]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function toggleLanguage(code) {
    setLanguages((prev) => {
      const has = prev.includes(code);
      const next = has ? prev.filter((c) => c !== code) : [...prev, code];
      if (!next.length) return prev; // always keep at least one
      if (!has) setWelcome((w) => ({ ...w, [code]: w[code] || '' }));
      if (activeLang === code && has) setActiveLang(next[0]);
      return next;
    });
  }

  function updateMenuLabel(i, label) {
    setMenu((prev) => prev.map((m, idx) => (idx === i ? { ...m, label } : m)));
  }

  async function save(extra = {}) {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/bot/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName, botName, brandColor, languages, welcomeMessage: welcome, menuOptions: menu, ...extra }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTenant(updated);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } finally {
      setSaving(false);
    }
  }

  const isLive = tenant.status === 'live';

  return (
    <>
      <Topbar title="Bot Configuration" />
      <div className="bc-page" style={{ maxWidth: 720 }}>
        <div className={`bc-live-banner ${isLive ? 'on' : 'off'}`}>
          <div>
            <div className="bc-live-banner-title">{isLive ? '🟢 Your bot is live' : '🟠 Your bot is paused'}</div>
            <div className="bc-live-banner-sub">{isLive ? 'Responding to customers on WhatsApp right now.' : 'Turn it on to start receiving and replying to customers.'}</div>
          </div>
          <Switch checked={isLive} onChange={(v) => { const status = v ? 'live' : 'paused'; setTenant((t) => ({ ...t, status })); save({ status }); }} label="Go live" />
        </div>

        <div className="bc-card">
          <div className="bc-card-title">Business Profile</div>
          <div className="bc-card-sub">How your bot introduces itself and your business.</div>
          <div className="bc-wizard-row2">
            <div className="bc-field"><label>Business name</label><input className="bc-input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} /></div>
            <div className="bc-field"><label>Bot name</label><input className="bc-input" value={botName} onChange={(e) => setBotName(e.target.value)} /></div>
          </div>
          <div className="bc-field">
            <label>Brand color</label>
            <div className="bc-color-row">
              {BRAND_COLORS.map((c) => (
                <button key={c} type="button" className={`bc-color-swatch${brandColor === c ? ' active' : ''}`} style={{ background: c }} onClick={() => setBrandColor(c)} aria-label={c} />
              ))}
            </div>
          </div>
          <div className="bc-copy-row"><IconWhatsApp size={18} /> WhatsApp number connected: <code>{tenant.whatsappNumber}</code></div>
        </div>

        <div className="bc-card">
          <div className="bc-card-title">Welcome Message & Language</div>
          <div className="bc-card-sub">What your bot says the moment someone messages you, in each language you support.</div>
          <div className="bc-lang-tabs">
            {LANGUAGES.map((l) => {
              const active = languages.includes(l.code);
              return (
                <button key={l.code} type="button" className={`bc-lang-tab${active ? ' active' : ''}`} onClick={() => toggleLanguage(l.code)}>
                  {active && activeLang !== l.code ? '✓ ' : ''}{l.label}
                </button>
              );
            })}
          </div>
          <div className="bc-lang-tabs">
            {languages.map((code) => (
              <button key={code} type="button" className={`bc-lang-tab${activeLang === code ? ' active' : ''}`} onClick={() => setActiveLang(code)}>
                {(LANGUAGES.find((l) => l.code === code) || {}).label || code}
              </button>
            ))}
          </div>
          <textarea
            className="bc-textarea"
            value={welcome[activeLang] || ''}
            onChange={(e) => setWelcome((w) => ({ ...w, [activeLang]: e.target.value }))}
            placeholder="Namaste 🙏 I'm your bot…"
          />
          <div className="bc-hint">Use *asterisks* for bold, just like WhatsApp formatting.</div>
        </div>

        <div className="bc-card">
          <div className="bc-card-title">Quick Menu</div>
          <div className="bc-card-sub">The options your bot offers right after saying hello.</div>
          {menu.map((m, i) => (
            <div className="bc-menu-row" key={m.id || i}>
              <div className="bc-menu-icon">{m.icon}</div>
              <input className="bc-input" value={m.label} onChange={(e) => updateMenuLabel(i, e.target.value)} />
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button className="bc-btn bc-btn-primary" onClick={() => save()} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
          {saved && <span style={{ color: 'var(--bc-green)', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}><IconCheck size={16} /> Saved</span>}
        </div>
      </div>
    </>
  );
}
