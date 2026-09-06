'use client';
// Profile → My Profile. Name and phone are fixed here (phone is the login identifier, changing
// it is a support-desk job, not self-service) — this screen is for the two things a partner
// really does own: their business name and their partner category. Category writes to the same
// `type` field Admin → Partners already filters and reports by (lib/formOptions.js's
// PARTNER_CATEGORY), so setting it here is exactly what admin sees there too — new signups just
// start out uncategorised until they fill this in.
import { useState, useEffect, useCallback } from 'react';
import { ScreenHeader, TextField, SelectField, Button } from './ui';
import { IconBuilding, IconTag, IconUser, IconPhone } from './icons';
import { PARTNER_CATEGORY } from '@/lib/formOptions';

function formatJoined(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

export default function MyProfileScreen() {
  const [partner, setPartner] = useState(null);
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const load = useCallback(() => {
    fetch('/api/partner/profile').then((r) => (r.ok ? r.json() : null)).then((p) => {
      if (!p) return;
      setPartner(p);
      setBusinessName(p.businessName || '');
      setCategory(PARTNER_CATEGORY.some((c) => c.v === p.type) ? p.type : '');
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  function flash(msg) { setToast(msg); setTimeout(() => setToast(''), 2500); }

  const dirty = partner && (businessName.trim() !== (partner.businessName || '') || category !== (PARTNER_CATEGORY.some((c) => c.v === partner.type) ? partner.type : ''));

  async function save() {
    if (!businessName.trim()) { setError('Business name cannot be empty'); return; }
    if (!category) { setError('Please choose your partner category'); return; }
    setError(''); setSaving(true);
    try {
      const res = await fetch('/api/partner/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName: businessName.trim(), type: category }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save your profile');
      setPartner(data);
      flash('Profile updated');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <ScreenHeader title="My Profile" backHref="/partner/home?tab=profile" />

      <div style={{ padding: '0 16px' }}>
        {!partner ? (
          <div className="hp-empty"><div className="hp-empty-sub">Loading…</div></div>
        ) : (
          <>
            <div className="hp-card">
              <div className="hp-card-title">Business Details</div>
              <TextField
                label="Business Name"
                icon={<IconBuilding size={18} />}
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Sharma Electricals"
              />
              <SelectField
                label="Partner Category"
                icon={<IconTag size={18} />}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                options={PARTNER_CATEGORY}
                placeholder="Select your category"
              />
              {error && <div className="hp-error">{error}</div>}
              <Button block onClick={save} disabled={saving || !dirty} style={{ marginTop: 4 }}>
                {saving ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>

            <div className="hp-card">
              <div className="hp-card-title">Account</div>
              <div className="hp-detail-line" style={{ padding: '0 0 12px' }}><IconUser size={16} /> {partner.name || '—'}</div>
              <div className="hp-detail-line" style={{ padding: '0 0 12px' }}><IconPhone size={16} /> +91 {partner.phone || '—'}</div>
              <div className="hp-summary-row">
                <span className="hp-summary-label">Partner ID</span>
                <span className="hp-summary-val">{partner.id}</span>
              </div>
              <div className="hp-summary-row">
                <span className="hp-summary-label">Partner Since</span>
                <span className="hp-summary-val">{formatJoined(partner.createdAt)}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {toast && <div className="hp-toast">{toast}</div>}
    </>
  );
}
