'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, TextField } from '@/components/partner/ui';
import { IconPhone, IconLock } from '@/components/partner/icons';

// Installer app sign-in — phone + password, same accounts as the Partner app (an installation
// partner is a partner of type 'installer' — they create their own account at /installer/signup,
// or Admin can add one). Accounts of any other type are sent on to the Partner app after signing in.
export default function InstallerLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      router.push(data.partner?.type === 'installer' ? '/installer/home' : '/partner/home');
      router.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="hp-root">
      <div className="hp-hero">
        <div className="hp-hero-bg" style={{ backgroundImage: "url('/Login_screen.webp')" }} />
        <div className="hp-hero-scrim-full" />
        <div className="hp-hero-content" style={{ justifyContent: 'space-between', paddingBottom: 18 }}>
          <img src="/brand/lockup-white.png" alt="Heseos — Lighting Ahead" className="hp-brand-logo" />
          <div>
            <h1 className="hp-h2">Installer Login</h1>
            <p className="hp-sub" style={{ marginTop: 6, marginBottom: 22 }}>Claim installation jobs &amp; track your earnings</p>
            <form onSubmit={submit}>
              <TextField icon={<IconPhone size={18} />} placeholder="Mobile Number" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" required />
              <TextField icon={<IconLock size={18} />} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              {error && <div className="hp-error">{error}</div>}
              <Button type="submit" block disabled={loading}>{loading ? 'Signing in…' : 'Login'}</Button>
            </form>
            <p className="hp-footnote">New installer? <Link href="/installer/signup" className="hp-link-accent">Create an account</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
}
