'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function PartnerLoginPage() {
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      router.push('/partner');
      router.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <Image src="/brand/lockup-navy.png" alt="Heseos" width={282} height={64} style={{ height: 34, width: 'auto', marginBottom: 4 }} />
        <div className="auth-sub">Partner portal — add and track your leads</div>
        <form onSubmit={submit}>
          <div className="auth-field">
            <label className="lf-label">Phone number</label>
            <input className="lf-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile number" required />
          </div>
          <div className="auth-field">
            <label className="lf-label">Password</label>
            <input className="lf-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          {error && <div className="lf-error" style={{ marginBottom: 10 }}>{error}</div>}
          <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 6 }} disabled={loading} type="submit">
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
