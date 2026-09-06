'use client';
// Profile → Bank Details. Purely a place for a partner to record where a settled payout should
// go — see app/api/admin/payouts: there is no payment gateway anywhere in this app, an admin
// always pays a partner some other way (bank transfer, UPI, cash) and just logs it here
// afterwards, so these fields exist only so that admin has somewhere to look the details up
// when that happens. Nothing here ever moves money.
import { useState, useEffect, useCallback } from 'react';
import { ScreenHeader, TextField, Button } from './ui';
import { IconBank, IconUser } from './icons';

const emptyBank = { accountHolderName: '', bankName: '', accountNumber: '', ifsc: '', upiId: '' };

export default function BankDetailsScreen() {
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState(emptyBank);
  const [saved, setSaved] = useState(emptyBank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const load = useCallback(() => {
    fetch('/api/partner/profile').then((r) => (r.ok ? r.json() : null)).then((p) => {
      if (!p) return;
      const b = { ...emptyBank, ...(p.bankDetails || {}) };
      setForm(b);
      setSaved(b);
      setLoaded(true);
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })); }
  function flash(msg) { setToast(msg); setTimeout(() => setToast(''), 2500); }

  const dirty = Object.keys(emptyBank).some((k) => (form[k] || '') !== (saved[k] || ''));

  async function save() {
    setError(''); setSaving(true);
    try {
      const res = await fetch('/api/partner/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankDetails: {
            accountHolderName: form.accountHolderName.trim(),
            bankName: form.bankName.trim(),
            accountNumber: form.accountNumber.trim(),
            ifsc: form.ifsc.trim().toUpperCase(),
            upiId: form.upiId.trim(),
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save your bank details');
      const b = { ...emptyBank, ...(data.bankDetails || {}) };
      setForm(b);
      setSaved(b);
      flash('Bank details saved');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <ScreenHeader title="Bank Details" backHref="/partner/home?tab=profile" />

      <div style={{ padding: '0 16px' }}>
        {!loaded ? (
          <div className="hp-empty"><div className="hp-empty-sub">Loading…</div></div>
        ) : (
          <div className="hp-card">
            <div className="hp-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconBank size={17} /> For Receiving Payouts
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--hp-text-soft)', lineHeight: 1.5, marginBottom: 14 }}>
              We settle payouts by bank transfer or UPI, not through this app — these details just tell us where to send it.
            </div>

            <TextField
              label="Account Holder Name"
              icon={<IconUser size={18} />}
              value={form.accountHolderName}
              onChange={(e) => set('accountHolderName', e.target.value)}
              placeholder="As per bank records"
            />
            <TextField
              label="Bank Name"
              value={form.bankName}
              onChange={(e) => set('bankName', e.target.value)}
              placeholder="e.g. HDFC Bank"
            />
            <TextField
              label="Account Number"
              value={form.accountNumber}
              onChange={(e) => set('accountNumber', e.target.value.replace(/[^0-9]/g, ''))}
              inputMode="numeric"
              placeholder="Account number"
            />
            <TextField
              label="IFSC Code"
              value={form.ifsc}
              onChange={(e) => set('ifsc', e.target.value.toUpperCase())}
              placeholder="e.g. HDFC0001234"
              style={{ textTransform: 'uppercase' }}
            />
            <TextField
              label="UPI ID (optional)"
              value={form.upiId}
              onChange={(e) => set('upiId', e.target.value)}
              placeholder="yourname@bank"
            />

            {error && <div className="hp-error">{error}</div>}
            <Button block onClick={save} disabled={saving || !dirty} style={{ marginTop: 4 }}>
              {saving ? 'Saving…' : 'Save Bank Details'}
            </Button>
          </div>
        )}
      </div>

      {toast && <div className="hp-toast">{toast}</div>}
    </>
  );
}
