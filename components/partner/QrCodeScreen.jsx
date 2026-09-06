'use client';
// Partner's pre-printed QR codes — the "on the spot" onboarding step. Heseos hands a partner a
// physical QR sticker (see app/api/admin/attribution/blank-qr and lib/attribution.js's
// createBlankPartnerQrCodes for how admin pre-prints a batch of these) and the partner types the
// code printed on it here to link it to their account; every scan from then on is credited to
// them exactly like the referral link is (components/partner/ReferAndEarnScreen.jsx). A partner
// can link more than one code — e.g. a second sticker for a second shop.
import { useState, useCallback, useEffect } from 'react';
import { ScreenHeader, TextField, Button } from './ui';
import { IconQrCode, IconCopy } from './icons';

function QrCodeCard({ code }) {
  const [copied, setCopied] = useState(false);
  const f = code.funnel || { visits: 0, leads: 0, converted: 0 };

  async function copy() {
    if (!code.url) return;
    try {
      await navigator.clipboard.writeText(code.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked — the input above is still there to long-press */ }
  }

  return (
    <div className="hp-card">
      <div className="hp-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <IconQrCode size={17} /> {code.label || 'QR Code'}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--hp-text-soft)', marginBottom: 12 }}>
        Code <strong style={{ color: '#fff', letterSpacing: 0.5 }}>{code.id}</strong>
        {code.claimedAt && ` · linked ${new Date(code.claimedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
      </div>

      {code.url && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <div className="hp-input-wrap" style={{ flex: 1 }}>
            <input className="hp-input" readOnly value={code.url} onFocus={(e) => e.target.select()} style={{ fontSize: 12, paddingLeft: 14 }} />
          </div>
          <button className="hp-btn hp-btn-ghost" onClick={copy} style={{ padding: '10px 14px' }}><IconCopy size={16} /></button>
        </div>
      )}
      {copied && <div style={{ fontSize: 12, color: 'var(--hp-text-soft)', marginTop: -4, marginBottom: 10 }}>Copied!</div>}

      <div className="hp-stat-grid">
        <div className="hp-stat-card"><div className="hp-stat-val">{f.visits}</div><div className="hp-stat-label">Scans</div></div>
        <div className="hp-stat-card"><div className="hp-stat-val">{f.leads}</div><div className="hp-stat-label">Leads</div></div>
        <div className="hp-stat-card"><div className="hp-stat-val">{f.converted}</div><div className="hp-stat-label">Converted</div></div>
      </div>
    </div>
  );
}

export default function QrCodeScreen() {
  const [data, setData] = useState(null);
  const [codeInput, setCodeInput] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const load = useCallback(() => {
    fetch('/api/partner/attribution/qr').then((r) => (r.ok ? r.json() : null)).then(setData);
  }, []);
  useEffect(() => { load(); }, [load]);

  function flash(msg) { setToast(msg); setTimeout(() => setToast(''), 2500); }

  async function claim() {
    const code = codeInput.trim();
    if (!code) return;
    setError(''); setClaiming(true);
    try {
      const res = await fetch('/api/partner/attribution/qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Could not link that code — please try again.');
      setCodeInput('');
      flash('QR code linked!');
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setClaiming(false);
    }
  }

  const codes = data?.codes || [];

  return (
    <>
      <ScreenHeader title="QR Code" backHref="/partner/home?tab=profile" />

      <div style={{ padding: '0 16px' }}>
        <div className="hp-card">
          <div className="hp-card-title">Link a QR code</div>
          <div style={{ fontSize: 12.5, color: 'var(--hp-text-soft)', lineHeight: 1.5, marginBottom: 12 }}>
            Heseos gives you a printed QR sticker for your shop counter or standee. Enter the code printed on it below — every scan from then on is credited to you.
          </div>
          <TextField
            placeholder="e.g. QP7F3K9A"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            style={{ letterSpacing: 1 }}
          />
          {error && <div className="hp-error">{error}</div>}
          <Button block onClick={claim} disabled={claiming || !codeInput.trim()} style={{ marginTop: 4 }}>
            {claiming ? 'Linking…' : 'Link This Code'}
          </Button>
        </div>

        {data === null ? (
          <div className="hp-empty"><div className="hp-empty-sub">Loading…</div></div>
        ) : codes.length === 0 ? (
          <div className="hp-empty">
            <div className="hp-empty-icon"><IconQrCode size={24} /></div>
            <div className="hp-empty-title">No QR code linked yet</div>
            <div className="hp-empty-sub">Enter the code from your sticker above to get started.</div>
          </div>
        ) : (
          codes.map((c) => <QrCodeCard key={c.id} code={c} />)
        )}
      </div>

      {toast && <div className="hp-toast">{toast}</div>}
    </>
  );
}
