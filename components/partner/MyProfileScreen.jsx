'use client';
// Profile → My Profile. Name and phone stay fixed here (phone is the login identifier, changing
// it is a support-desk job, not self-service) — everything else here is self-service: the
// partner's own name, their business's name, their category, their address, and an optional
// GST number (for partners who are registered businesses). Category writes
// to the same `type` field Admin → Partners already filters and reports by (lib/formOptions.js's
// PARTNER_CATEGORY); city/pincode/state/addressLine likewise write to the same flat fields
// Admin → Partners already has a City column for (components/admin/PartnersPage.jsx) — so
// filling this in from here is exactly what shows up there too.
import { useState, useEffect, useCallback } from 'react';
import { ScreenHeader, TextField, SelectField, Button } from './ui';
import { IconBuilding, IconTag, IconUser, IconPhone, IconMapPin, IconFile } from './icons';
import { PARTNER_CATEGORY } from '@/lib/formOptions';

const PINCODE_RE = /^\d{6}$/;
const GST_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]$/;

function formatJoined(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

// `partner.businessName` is the pre-existing field name (Admin → Partners and elsewhere already
// read it) — it's just labelled "Partner Name" here now, alongside a genuinely new, separate
// "Partner Business Name" (`shopName`) for partners whose shop/company name differs from their
// own name. Renaming the field key itself would mean touching every other place that reads
// it, so the label changes, the storage doesn't.
export default function MyProfileScreen() {
  const [partner, setPartner] = useState(null);
  const [partnerName, setPartnerName] = useState('');
  const [shopName, setShopName] = useState('');
  const [category, setCategory] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [pincode, setPincode] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const load = useCallback(() => {
    fetch('/api/partner/profile').then((r) => (r.ok ? r.json() : null)).then((p) => {
      if (!p) return;
      setPartner(p);
      setPartnerName(p.businessName || '');
      setShopName(p.shopName || '');
      setCategory(PARTNER_CATEGORY.some((c) => c.v === p.type) ? p.type : '');
      setAddressLine(p.addressLine || '');
      setPincode(p.pincode || '');
      setCity(p.city || '');
      setState(p.state || '');
      setGstNumber(p.gstNumber || '');
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  function flash(msg) { setToast(msg); setTimeout(() => setToast(''), 2500); }

  const dirty = partner && (
    partnerName.trim() !== (partner.businessName || '')
    || shopName.trim() !== (partner.shopName || '')
    || category !== (PARTNER_CATEGORY.some((c) => c.v === partner.type) ? partner.type : '')
    || addressLine.trim() !== (partner.addressLine || '')
    || pincode.trim() !== (partner.pincode || '')
    || city.trim() !== (partner.city || '')
    || state.trim() !== (partner.state || '')
    || gstNumber.trim() !== (partner.gstNumber || '')
  );

  async function save() {
    if (!partnerName.trim()) { setError('Partner name cannot be empty'); return; }
    if (!category) { setError('Please choose your partner category'); return; }
    if (pincode.trim() && !PINCODE_RE.test(pincode.trim())) { setError('Pincode must be 6 digits'); return; }
    if (gstNumber.trim() && !GST_RE.test(gstNumber.trim().toUpperCase())) { setError('That doesn\u2019t look like a valid GSTIN (e.g. 22AAAAA0000A1Z5)'); return; }
    setError(''); setSaving(true);
    try {
      const res = await fetch('/api/partner/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: partnerName.trim(),
          shopName: shopName.trim(),
          type: category,
          addressLine: addressLine.trim(),
          pincode: pincode.trim(),
          city: city.trim(),
          state: state.trim(),
          gstNumber: gstNumber.trim().toUpperCase(),
        }),
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
              <div className="hp-card-title">Partner Details</div>
              <TextField
                label="Partner Name"
                icon={<IconUser size={18} />}
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
                placeholder="Your name"
              />
              <TextField
                label="Partner Business Name"
                icon={<IconBuilding size={18} />}
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder='e.g. "Sharma Electricals"'
              />
              <SelectField
                label="Partner Category"
                icon={<IconTag size={18} />}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                options={PARTNER_CATEGORY}
                placeholder="Select your category"
              />
              <TextField
                label="Address Line"
                icon={<IconMapPin size={18} />}
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
                placeholder="Shop / building, street, area"
              />
              <TextField
                label="Pincode"
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                inputMode="numeric"
                maxLength={6}
                placeholder="560034"
              />
              <TextField
                label="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Pune"
              />
              <TextField
                label="State"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="e.g. Maharashtra"
              />
              <TextField
                label="GST Number (optional)"
                icon={<IconFile size={18} />}
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value.toUpperCase().slice(0, 15))}
                placeholder="22AAAAA0000A1Z5"
                maxLength={15}
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
