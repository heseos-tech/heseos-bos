'use client';
// Profile → Delete Account (Partner and Installer apps — links come from useAppBase()).
// Re-asks for the password, then calls /api/partner/delete-account. Google Play requires an
// in-app way to delete the account for any app that lets people create one.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ScreenHeader, TextField, Button, useAppBase } from './ui';
import { IconAlertTriangle, IconLock } from './icons';

export default function DeleteAccountScreen() {
  const base = useAppBase();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/partner/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const raw = await res.text();
      let data = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { /* non-JSON error body */ }
      if (!res.ok) throw new Error(data.error || `Could not delete the account (${res.status})`);
      router.replace(`${base}/login`);
      router.refresh();
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }

  return (
    <>
      <ScreenHeader title="Delete Account" backHref={`${base}/home?tab=profile`} />
      <div style={{ padding: '0 16px' }}>
        <div className="hp-card">
          <div className="hp-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ff8484' }}>
            <IconAlertTriangle size={17} /> Delete my account
          </div>
          <div style={{ fontSize: 13, color: 'var(--hp-text-soft)', lineHeight: 1.6, marginBottom: 14 }}>
            This permanently deletes your profile — your name, mobile number, password, address, city and bank details — and you will be logged out. This can&rsquo;t be undone.
            <ul style={{ margin: '10px 0 0', paddingLeft: 18 }}>
              <li>Leads you referred stay with Heseos as business records, shown as &ldquo;Deleted partner&rdquo;.</li>
              <li>Your QR code and referral link stop working.</li>
              <li>Installation jobs you claimed but haven&rsquo;t finished go back to other installers.</li>
              <li>If you have unpaid earnings, we can&rsquo;t delete the account until they are settled.</li>
            </ul>
          </div>

          <TextField
            icon={<IconLock size={18} />}
            type="password"
            label="Enter your password to confirm"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />

          <div className="hp-check-row" onClick={() => setConfirm((c) => !c)} style={{ cursor: 'pointer' }}>
            <span className={`hp-checkbox${confirm ? ' checked' : ''}`}>{confirm && <span style={{ color: '#fff', fontSize: 12, lineHeight: 1 }}>✓</span>}</span>
            <span className="hp-check-label">I understand my account and data will be permanently deleted.</span>
          </div>

          {error && <div className="hp-error">{error}</div>}

          <Button block disabled={loading || !password || !confirm} onClick={submit} style={{ background: '#ef4444', marginTop: 4 }}>
            {loading ? 'Deleting…' : 'Delete My Account'}
          </Button>
        </div>
      </div>
    </>
  );
}
