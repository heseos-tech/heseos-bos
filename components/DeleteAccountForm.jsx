'use client';
// Public "delete my account" form — the URL Google Play shows on the Partner / Installer app
// listings (https://…/delete-account). Same endpoint as the in-app screen, but identifies the
// account by mobile number + password so it works even after the app has been uninstalled.
import { useState } from 'react';

const input = { width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #D1D5DB', fontSize: 15, marginBottom: 12, boxSizing: 'border-box', background: '#fff', color: '#111827' };

export default function DeleteAccountForm() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/partner/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });
      const raw = await res.text();
      let data = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { /* non-JSON error body */ }
      if (!res.ok) throw new Error(data.error || `Could not delete the account (${res.status})`);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div style={{ padding: '18px 20px', borderRadius: 12, background: '#ECFDF5', border: '1px solid #6EE7B7', color: '#065F46', fontSize: 15, lineHeight: 1.6 }}>
        Your account and its personal data have been deleted. You can close this page.
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ maxWidth: 420 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Mobile number you registered with</label>
      <input style={input} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" autoComplete="tel" placeholder="10-digit mobile number" required />
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Password</label>
      <input style={input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="Your account password" required />
      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14, margin: '4px 0 16px', cursor: 'pointer' }}>
        <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} style={{ marginTop: 3 }} />
        <span>I understand my account and personal data will be permanently deleted.</span>
      </label>
      {error && <div style={{ color: '#B91C1C', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{error}</div>}
      <button type="submit" disabled={loading || !confirm || !phone || !password}
        style={{ padding: '12px 22px', borderRadius: 999, border: 'none', background: loading || !confirm || !phone || !password ? '#FCA5A5' : '#DC2626', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
        {loading ? 'Deleting…' : 'Delete my account'}
      </button>
    </form>
  );
}
