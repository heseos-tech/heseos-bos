'use client';
// Bot Configuration — the self-service editor: "self service bot configuration so we can make
// bot live on the go for anyone who wants our bot." Every field a tenant set at signup
// (app/bot/signup) is editable here, plus the Go Live / Pause switch that actually flips
// whether the bot is presented as live in the sidebar/console.
import { useState, useEffect } from 'react';
import { Topbar } from './ConsoleShell';
import { Switch, TextField, Badge } from './ui';
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
  const [qrWelcome, setQrWelcome] = useState(initialTenant.qrWelcomeMessage || {});
  const [menu, setMenu] = useState(initialTenant.menuOptions || []);
  const [activeLang, setActiveLang] = useState((initialTenant.languages || ['en'])[0]);
  const [qrActiveLang, setQrActiveLang] = useState((initialTenant.languages || ['en'])[0]);
  const [waPhoneNumberId, setWaPhoneNumberId] = useState(initialTenant.waPhoneNumberId || '');
  const [waAccessToken, setWaAccessToken] = useState(initialTenant.waAccessToken || '');
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // Real WhatsApp verification state — null means "not tested yet" (distinct from a failed
  // test), since the badge used to just check both fields were non-empty and would show
  // "Connected" for literally any typed-in garbage. See lib/botWhatsapp.js's
  // verifyBotCredentials and app/api/bot/config/verify/route.js.
  const [waCheck, setWaCheck] = useState(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => { setOrigin(window.location.origin); }, []);

  async function testConnection(phoneNumberId = waPhoneNumberId, token = waAccessToken) {
    if (!phoneNumberId || !token) { setWaCheck(null); return; }
    setChecking(true);
    try {
      const res = await fetch('/api/bot/config/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waPhoneNumberId: phoneNumberId, waAccessToken: token }),
      });
      setWaCheck(res.ok ? await res.json() : { ok: false, error: 'Could not reach the verification check.' });
    } catch {
      setWaCheck({ ok: false, error: 'Could not reach the verification check.' });
    } finally {
      setChecking(false);
    }
  }

  // Auto-test once on load if credentials were already saved from a previous visit — a token
  // can expire or get revoked on Meta's side at any time, silently, so "it worked when I saved
  // it" isn't good enough to keep showing green.
  useEffect(() => {
    if (initialTenant.waPhoneNumberId && initialTenant.waAccessToken) testConnection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function copy(value, key) {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(''), 1800);
    });
  }

  function toggleLanguage(code) {
    setLanguages((prev) => {
      const has = prev.includes(code);
      const next = has ? prev.filter((c) => c !== code) : [...prev, code];
      if (!next.length) return prev; // always keep at least one
      if (!has) setWelcome((w) => ({ ...w, [code]: w[code] || '' }));
      if (activeLang === code && has) setActiveLang(next[0]);
      if (qrActiveLang === code && has) setQrActiveLang(next[0]);
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
        body: JSON.stringify({ businessName, botName, brandColor, languages, welcomeMessage: welcome, qrWelcomeMessage: qrWelcome, menuOptions: menu, waPhoneNumberId, waAccessToken, ...extra }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTenant(updated);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        // The WhatsApp fields are always part of this payload, so re-verify against whatever
        // just got saved — catches "I just pasted a fresh token and it's still wrong" instantly
        // instead of leaving the stale badge state up.
        testConnection(waPhoneNumberId, waAccessToken);
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
        </div>

        <div className="bc-card">
          <div className="bc-card-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <IconWhatsApp size={18} /> WhatsApp Connection
            {checking ? (
              <Badge tone="amber">Checking…</Badge>
            ) : waCheck?.ok ? (
              <Badge tone="green">Connected{waCheck.displayPhoneNumber ? ` — ${waCheck.displayPhoneNumber}` : ''}</Badge>
            ) : waCheck && waCheck.ok === false ? (
              <Badge tone="red">Not connected</Badge>
            ) : waPhoneNumberId && waAccessToken ? (
              <Badge tone="gray">Untested</Badge>
            ) : (
              <Badge tone="amber">Not connected</Badge>
            )}
          </div>
          <div className="bc-card-sub">
            Connect your own WhatsApp number so this bot can actually send and receive messages. Generate a Phone Number ID
            and a permanent Access Token in your Meta Business Manager (WhatsApp → API Setup), paste them below, then add the
            webhook URL and verify token to your Meta App's Webhooks configuration.
          </div>
          <div className="bc-wizard-row2">
            <TextField label="WhatsApp Phone Number ID" value={waPhoneNumberId} onChange={(e) => { setWaPhoneNumberId(e.target.value); setWaCheck(null); }} placeholder="e.g. 109876543210987" />
            <TextField label="Access Token" type="password" value={waAccessToken} onChange={(e) => { setWaAccessToken(e.target.value); setWaCheck(null); }} placeholder="Permanent access token from Meta" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: -6, marginBottom: 4 }}>
            <button type="button" className="bc-btn bc-btn-outline bc-btn-sm" onClick={() => testConnection()} disabled={checking || !waPhoneNumberId || !waAccessToken}>
              {checking ? 'Testing…' : 'Test Connection'}
            </button>
            {waCheck && waCheck.ok === false && <span style={{ color: 'var(--bc-red)', fontSize: 12.5, fontWeight: 600 }}>{waCheck.error || 'Meta rejected these credentials.'}</span>}
            {waCheck?.ok && <span style={{ color: '#15803d', fontSize: 12.5, fontWeight: 600 }}>Verified live with Meta{waCheck.verifiedName ? ` as "${waCheck.verifiedName}"` : ''}.</span>}
          </div>
          <div className="bc-field">
            <label>Webhook URL — paste into your Meta App's Webhooks config</label>
            <div className="bc-copy-row">
              <code style={{ flex: 1, wordBreak: 'break-all' }}>{origin ? `${origin}/api/bot/webhook` : '/api/bot/webhook'}</code>
              <button type="button" className="bc-btn bc-btn-outline bc-btn-sm" onClick={() => copy(`${origin}/api/bot/webhook`, 'url')}>{copied === 'url' ? 'Copied' : 'Copy'}</button>
            </div>
          </div>
          <div className="bc-field">
            <label>Verify token — enter this as the "Verify token" alongside the URL above</label>
            <div className="bc-copy-row">
              <code style={{ flex: 1, wordBreak: 'break-all' }}>{tenant.waVerifyToken}</code>
              <button type="button" className="bc-btn bc-btn-outline bc-btn-sm" onClick={() => copy(tenant.waVerifyToken, 'token')}>{copied === 'token' ? 'Copied' : 'Copy'}</button>
            </div>
          </div>
          <div className="bc-hint">Until this is connected, your bot's messages are recorded here but won't actually reach customers on WhatsApp.</div>
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
          <div className="bc-card-title">QR / Link Welcome Message <span style={{ fontWeight: 500, opacity: 0.6 }}>(optional)</span></div>
          <div className="bc-card-sub">Sent instead of the welcome message above when someone starts chatting by scanning a QR code or tapping a partner/referral link — a chance to acknowledge where they came from. Leave a language blank to just use your regular welcome message there.</div>
          <div className="bc-lang-tabs">
            {languages.map((code) => (
              <button key={code} type="button" className={`bc-lang-tab${qrActiveLang === code ? ' active' : ''}`} onClick={() => setQrActiveLang(code)}>
                {(LANGUAGES.find((l) => l.code === code) || {}).label || code}
              </button>
            ))}
          </div>
          <textarea
            className="bc-textarea"
            value={qrWelcome[qrActiveLang] || ''}
            onChange={(e) => setQrWelcome((w) => ({ ...w, [qrActiveLang]: e.target.value }))}
            placeholder="Welcome! Thanks for scanning our QR code 🙌…"
          />
          <div className="bc-hint">Blank = falls back to your regular welcome message automatically.</div>
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
