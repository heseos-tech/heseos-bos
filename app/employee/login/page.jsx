'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function EmployeeLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const raw = await res.text();
      let data = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { /* non-JSON response, fall through to generic error */ }
      if (!res.ok) throw new Error(data.error || `Login failed (${res.status})`);
      router.push('/employee');
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
        <div className="auth-sub">Employee interface — pre-sales &amp; sales engineers</div>
        <form onSubmit={submit}>
          <div className="auth-field">
            <label className="lf-label">Email</label>
            <input className="lf-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@heseos.com" required />
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
