'use client';
// The self-service onboarding wizard — "self service bot configuration so we can make bot live
// on the go for anyone who wants our bot." Three short steps end with a working, populated bot
// console (see app/api/auth/bot/register, which also seeds a demo Inbox via lib/botMock.js).
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { INDUSTRIES, LANGUAGES, industryByKey, fillTemplate } from '@/lib/botPresets';
import { IconArrowLeft, IconCheck } from './icons';

const BRAND_COLORS = ['#D9481E', '#0f172a', '#2563eb', '#7c3aed', '#16a34a', '#dc2626', '#14b8a6'];
const STEP_LABELS = ['Business & Contact', 'Bot Persona & Voice', 'Create Your Login'];

export default function SignupWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState('home_automation');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [botName, setBotName] = useState('');
  const [brandColor, setBrandColor] = useState(BRAND_COLORS[0]);
  const [languages, setLanguages] = useState(['en']);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [menuOptions, setMenuOptions] = useState(industryByKey('home_automation').menuOptions.map((m, i) => ({ id: `menu_${i + 1}`, label: m.label, icon: m.icon })));

  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  function applyIndustryDefaults(key) {
    const preset = industryByKey(key);
    setIndustry(key);
    setMenuOptions(preset.menuOptions.map((m, i) => ({ id: `menu_${i + 1}`, label: m.label, icon: m.icon })));
    setWelcomeMessage('');
  }

  function toggleLanguage(code) {
    setLanguages((prev) => {
      if (prev.includes(code)) return prev.length > 1 ? prev.filter((c) => c !== code) : prev;
      return [...prev, code];
    });
  }

  function goNext() {
    setError('');
    if (step === 1) {
      if (!businessName.trim() || !contactName.trim()) { setError('Please fill in your business name and your name.'); return; }
      if (!botName) setBotName(`${businessName.split(' ')[0]} Mitra`);
    }
    if (step === 2 && !welcomeMessage.trim()) {
      setWelcomeMessage(fillTemplate(industryByKey(industry).sampleWelcome, { botName: botName || `${businessName.split(' ')[0]} Mitra`, businessName }));
    }
    setStep((s) => Math.min(3, s + 1));
  }
  function goBack() {
    setError('');
    setStep((s) => Math.max(1, s - 1));
  }

  async function launch() {
    setError('');
    if (loginId.trim().length < 4) return setError('Login ID must be at least 4 characters.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirm) return setError('Passwords do not match.');

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/bot/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName, industry, contactName, email, phone, botName, brandColor, languages,
          welcomeMessage, menuOptions, loginId, password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not create your account');
      router.push('/bot/console/inbox');
      router.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bc-root bc-wizard-shell">
      <div className="bc-wizard">
        <div className="bc-wizard-logo">
          <img src="/brand/lockup-navy.png" alt="Heseos" className="bc-wizard-logo-img" />
          <span className="bc-wizard-logo-tag">Bot Platform</span>
        </div>
        <Link href="/bot" className="bc-link-accent" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 18, fontSize: 13 }}>
          <IconArrowLeft size={16} /> Back to login
        </Link>
        <div className="bc-wizard-step-label">Step {step} of 3 · {STEP_LABELS[step - 1]}</div>
        <div className="bc-wizard-steps">
          {[1, 2, 3].map((n) => <div key={n} className={`bc-wizard-step${n <= step ? ' done' : ''}`} />)}
        </div>

        <div className="bc-wizard-card">
          {error && <div className="bc-form-error">{error}</div>}

          {step === 1 && (
            <>
              <div className="bc-wizard-h2">Tell us about your business</div>
              <div className="bc-wizard-sub">This is what your bot will introduce itself as on WhatsApp.</div>
              <div className="bc-field"><label>Business name</label><input className="bc-input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Aurora Interiors" /></div>
              <div className="bc-field">
                <label>Industry</label>
                <div className="bc-industry-grid">
                  {INDUSTRIES.map((i) => (
                    <button type="button" key={i.key} className={`bc-industry-card${industry === i.key ? ' active' : ''}`} onClick={() => applyIndustryDefaults(i.key)}>
                      {i.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="bc-wizard-row2">
                <div className="bc-field"><label>Your name</label><input className="bc-input" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Your full name" /></div>
                <div className="bc-field"><label>Work email</label><input className="bc-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com" /></div>
              </div>
              <div className="bc-field"><label>Mobile number</label><input className="bc-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile number" /></div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="bc-wizard-h2">Give your bot a voice</div>
              <div className="bc-wizard-sub">Every field here is editable later in Bot Configuration.</div>
              <div className="bc-wizard-row2">
                <div className="bc-field"><label>Bot name</label><input className="bc-input" value={botName} onChange={(e) => setBotName(e.target.value)} placeholder="e.g. Aura" /></div>
                <div className="bc-field">
                  <label>Brand color</label>
                  <div className="bc-color-row">
                    {BRAND_COLORS.map((c) => (
                      <button key={c} type="button" className={`bc-color-swatch${brandColor === c ? ' active' : ''}`} style={{ background: c }} onClick={() => setBrandColor(c)} aria-label={c} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="bc-field">
                <label>Languages your bot speaks</label>
                <div className="bc-checklist">
                  {LANGUAGES.map((l) => (
                    <button type="button" key={l.code} className={`bc-check-pill${languages.includes(l.code) ? ' active' : ''}`} onClick={() => toggleLanguage(l.code)}>
                      {languages.includes(l.code) && <IconCheck size={13} />} {l.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="bc-field">
                <label>Welcome message (English)</label>
                <textarea className="bc-textarea" value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} placeholder="Namaste 🙏 I'm your bot…" />
              </div>
              <div className="bc-field">
                <label>Quick menu</label>
                {menuOptions.map((m, i) => (
                  <div className="bc-menu-row" key={m.id}>
                    <div className="bc-menu-icon">{m.icon}</div>
                    <input className="bc-input" value={m.label} onChange={(e) => setMenuOptions((prev) => prev.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))} />
                  </div>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="bc-wizard-h2">Create your login</div>
              <div className="bc-wizard-sub">You'll use this to come back to your Bot Console anytime.</div>
              <div className="bc-wizard-row2">
                <div className="bc-field"><label>Login ID</label><input className="bc-input" value={loginId} onChange={(e) => setLoginId(e.target.value)} placeholder="yourbusiness" /></div>
                <div />
              </div>
              <div className="bc-wizard-row2">
                <div className="bc-field"><label>Password</label><input className="bc-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <div className="bc-field"><label>Confirm password</label><input className="bc-input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
              </div>

              <div className="bc-card" style={{ background: 'var(--bc-bg)', marginTop: 8 }}>
                <div className="bc-card-title" style={{ marginBottom: 10 }}>Review</div>
                <div className="bc-summary-row"><span className="bc-summary-key">Business</span><span className="bc-summary-val">{businessName}</span></div>
                <div className="bc-summary-row"><span className="bc-summary-key">Industry</span><span className="bc-summary-val">{industryByKey(industry).label}</span></div>
                <div className="bc-summary-row"><span className="bc-summary-key">Bot name</span><span className="bc-summary-val">{botName}</span></div>
                <div className="bc-summary-row"><span className="bc-summary-key">Languages</span><span className="bc-summary-val">{languages.map((c) => (LANGUAGES.find((l) => l.code === c) || {}).label).join(', ')}</span></div>
              </div>
            </>
          )}

          <div className="bc-wizard-foot">
            {step > 1 ? <button className="bc-btn bc-btn-outline" onClick={goBack}>Back</button> : <div />}
            {step < 3 ? (
              <button className="bc-btn bc-btn-primary" onClick={goNext}>Continue</button>
            ) : (
              <button className="bc-btn bc-btn-primary" onClick={launch} disabled={submitting}>{submitting ? 'Launching…' : 'Launch my bot 🚀'}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
