'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { IconUser, IconLock, IconEye, IconEyeOff, IconWhatsApp } from './icons';

const FEATURES = [
  { icon: <IconWhatsApp size={17} />, title: 'WhatsApp First', desc: 'Meet customers on the app they already use every day.' },
  { icon: '🤖', title: 'AI Eligibility & FAQ Engine', desc: 'Instantly answers customers and shares a ready report.' },
  { icon: '📊', title: 'Live Lead Panel & Inbox', desc: 'Every conversation becomes a tracked lead in one place.' },
  { icon: '🔒', title: 'Secure & Fully White-label', desc: 'Runs under your brand, on your own WhatsApp number.' },
];

const PHONE_LINES = [
  ['in', "Hello! How can we help you today?"],
  ['out', 'Check my eligibility'],
  ['in', "Here's what I can help you with 👇"],
];

export default function LoginMarketing() {
  const router = useRouter();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not sign you in');
      router.push('/bot/console/inbox');
      router.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bc-root bc-marketing">
      <div className="bc-marketing-left">
        <div className="bc-mkt-logo">
          <img src="/brand/lockup-navy.png" alt="Heseos" className="bc-mkt-logo-img" />
          <span className="bc-mkt-logo-tag">Bot Platform</span>
        </div>
        <h1 className="bc-mkt-h1">WhatsApp AI Bot Platform for <span>Growing Businesses</span></h1>
        <p className="bc-mkt-sub">White-labeled WhatsApp AI bots that qualify customers, capture every lead, and grow your business — live in minutes, no developer required.</p>

        {FEATURES.map((f) => (
          <div className="bc-feature-row" key={f.title}>
            <div className="bc-feature-icon">{f.icon}</div>
            <div>
              <div className="bc-feature-title">{f.title}</div>
              <div className="bc-feature-desc">{f.desc}</div>
            </div>
          </div>
        ))}

        <div className="bc-mkt-stats">
          <div className="bc-mkt-stat"><div className="bc-mkt-stat-val">24/7</div><div className="bc-mkt-stat-label">Always-on assistant</div></div>
          <div className="bc-mkt-stat"><div className="bc-mkt-stat-val">&lt;2 min</div><div className="bc-mkt-stat-label">Chat to qualified lead</div></div>
          <div className="bc-mkt-stat"><div className="bc-mkt-stat-val">100%</div><div className="bc-mkt-stat-label">White-labeled to you</div></div>
        </div>

        <div className="bc-phone-mock">
          <div className="bc-phone-screen">
            <div className="bc-phone-head"><span className="bc-phone-dot" /> Your Business</div>
            <div className="bc-phone-body">
              {PHONE_LINES.map(([dir, text], i) => (
                <div key={i} className={`bc-phone-bubble ${dir}`}>{text}</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bc-marketing-right">
        <form className="bc-login-card" onSubmit={submit}>
          <div className="bc-login-h1">Welcome back!</div>
          <div className="bc-login-sub">Sign in to access your Bot Console</div>
          {error && <div className="bc-form-error">{error}</div>}

          <div className="bc-field">
            <label>Login ID</label>
            <div className="bc-input-icon-wrap">
              <IconUser size={17} />
              <input className="bc-input" value={loginId} onChange={(e) => setLoginId(e.target.value)} placeholder="Enter your login ID" required />
            </div>
          </div>
          <div className="bc-field">
            <label>Password</label>
            <div className="bc-input-icon-wrap">
              <IconLock size={17} />
              <input className="bc-input" type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required />
              <button type="button" className="bc-input-eye" onClick={() => setShowPw((s) => !s)} tabIndex={-1} aria-label="Toggle password visibility">
                {showPw ? <IconEyeOff size={17} /> : <IconEye size={17} />}
              </button>
            </div>
          </div>

          <div className="bc-login-row">
            <label className="bc-checkbox-row">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me
            </label>
            <span className="bc-link-accent" style={{ cursor: 'default' }}>Forgot password?</span>
          </div>

          <button className="bc-btn bc-btn-primary bc-btn-block" type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Login →'}</button>

          <div className="bc-login-foot">New here? <Link href="/bot/signup" className="bc-link-accent">Get started free</Link></div>
          <div className="bc-login-copy">© {new Date().getFullYear()} Heseos Bot Platform. All rights reserved.</div>
        </form>
      </div>
    </div>
  );
}
