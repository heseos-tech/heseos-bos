'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, TextField } from '@/components/partner/ui';
import { IconPhone, IconLock, LogoGoogle, LogoWhatsApp } from '@/components/partner/icons';

export default function PartnerLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/partner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });
      const raw = await res.text();
      let data = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { /* non-JSON error body */ }
      if (!res.ok) throw new Error(data.error || `Login failed (${res.status})`);
      router.push('/partner/home');
      router.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function comingSoon(label) {
    setToast(`${label} sign-in is coming soon`);
    setTimeout(() => setToast(''), 2200);
  }

  return (
    <div className="hp-root">
      <div className="hp-hero">
        <div className="hp-hero-bg" style={{ backgroundImage: "url('/Login_screen.png')" }} />
        <div className="hp-hero-scrim-full" />
        <div className="hp-hero-content" style={{ justifyContent: 'flex-end' }}>
          <div className="hp-brand" style={{ position: 'absolute', top: 28, left: 22 }}>
            <span className="hp-brand-mark">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M4 14a8 8 0 0 1 16 0" /><path d="M7 17.2a5 5 0 0 1 10 0" /><circle cx="12" cy="20" r="1.4" fill="#fff" stroke="none" /></svg>
            </span>
            <div className="hp-brand-text">
              <span className="hp-brand-name">HESEOS</span>
              <span className="hp-brand-tag">Lighting Ahead</span>
            </div>
          </div>

          <div>
            <h1 className="hp-h2">Welcome Back!</h1>
            <p className="hp-sub" style={{ marginTop: 6, marginBottom: 22 }}>Login to continue</p>

            <form onSubmit={submit}>
              <TextField icon={<IconPhone size={18} />} placeholder="Mobile Number" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" required />
              <TextField icon={<IconLock size={18} />} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />

              <div style={{ textAlign: 'right', marginBottom: 16 }}>
                <button type="button" className="hp-link-accent" style={{ background: 'none', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' }} onClick={() => comingSoon('Password reset')}>Forgot Password?</button>
              </div>

              {error && <div className="hp-error">{error}</div>}

              <Button type="submit" block disabled={loading}>{loading ? 'Signing in…' : 'Login'}</Button>
            </form>

            <div className="hp-divider-row">
              <span className="hp-divider-line" /><span className="hp-divider-text">or continue with</span><span className="hp-divider-line" />
            </div>

            <div className="hp-social-row">
              <button type="button" className="hp-btn-social" onClick={() => comingSoon('Google')}><LogoGoogle /> Google</button>
              <button type="button" className="hp-btn-social" onClick={() => comingSoon('WhatsApp')}><LogoWhatsApp /> WhatsApp</button>
            </div>

            <p className="hp-footnote">Don&rsquo;t have an account? <Link href="/partner/signup" className="hp-link-accent">Sign Up</Link></p>
          </div>
        </div>
      </div>
      {toast && <div className="hp-toast">{toast}</div>}
    </div>
  );
}
