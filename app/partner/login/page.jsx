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
        <div className="hp-hero-bg" style={{ backgroundImage: "url('/Login_screen.webp')" }} />
        <div className="hp-hero-scrim-full" />
        {/* space-between (not flex-end) so the logo can be a normal, non-absolutely-positioned
            flex child again — it used to be pinned with a hardcoded `top: 28`, which ignored
            env(safe-area-inset-top) entirely and sat too high / got clipped under the status
            bar on notch/Dynamic-Island iPhones. As a normal child it inherits .hp-hero-content's
            own safe-area-aware padding-top (see partner-app.css) instead of a fixed pixel value,
            and space-between keeps the form flush at the bottom exactly like flex-end did when
            the logo didn't count toward layout (align-self/flex-none for it already exists in
            partner-app.css, added for exactly this normal-flow case). */}
        <div className="hp-hero-content" style={{ justifyContent: 'space-between', paddingBottom: 18 }}>
          <img src="/brand/lockup-white.png" alt="Heseos — Lighting Ahead" className="hp-brand-logo" />

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
