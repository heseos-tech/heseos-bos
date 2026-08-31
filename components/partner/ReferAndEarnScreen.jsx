'use client';
// Partner self-service "Share & Earn" — auto-provisions this partner's own QR code + referral
// link on first visit (see app/api/partner/attribution and lib/attribution.js's
// getOrCreatePartnerLink) so there's nothing for an admin to set up. Any lead that comes in
// through either of these already shows up on Home/Leads/Rewards — those all read /api/leads
// scoped to this partner (app/api/leads/route.js), and a QR/referral lead gets partnerId set
// exactly like a lead this partner punched themselves.
import { useEffect, useState } from 'react';
import { ScreenHeader } from './ui';
import { IconCopy, IconShare, IconQrCode, IconLink, IconLeads, IconConversions } from './icons';

function LinkCard({ title, hint, icon, link, visitLabel, onToast }) {
  const Icon = icon;
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!link?.url) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { onToast('Could not copy — long-press the link instead'); }
  }

  async function share() {
    if (!link?.url) return;
    if (navigator.share) {
      try { await navigator.share({ title: 'Heseos Smart Home', text: 'Check out Heseos for smart home automation!', url: link.url }); }
      catch { /* user cancelled — not an error */ }
    } else {
      copy();
      onToast('Link copied — paste it anywhere');
    }
  }

  const f = link?.funnel || { visits: 0, leads: 0, converted: 0 };
  const qrImg = link?.url ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(link.url)}` : null;

  return (
    <div className="hp-card">
      <div className="hp-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon size={17} /> {title}</div>
      <div style={{ fontSize: 12.5, color: 'var(--hp-text-soft)', lineHeight: 1.5, marginBottom: 12 }}>{hint}</div>

      {icon === IconQrCode && qrImg && (
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <img src={qrImg} alt="Your QR code" width={160} height={160} style={{ borderRadius: 10, background: '#fff', padding: 8 }} />
        </div>
      )}

      {link?.url ? (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <div className="hp-input-wrap" style={{ flex: 1 }}>
              <input className="hp-input" readOnly value={link.url} onFocus={(e) => e.target.select()} style={{ fontSize: 12, paddingLeft: 14 }} />
            </div>
            <button className="hp-btn hp-btn-ghost" onClick={copy} style={{ padding: '10px 14px' }}><IconCopy size={16} /></button>
          </div>
          <button className="hp-btn hp-btn-primary hp-btn-block" onClick={share}><IconShare size={16} /> {copied ? 'Copied!' : 'Share'}</button>

          <div className="hp-stat-grid" style={{ marginTop: 14 }}>
            <div className="hp-stat-card"><div className="hp-stat-val">{f.visits}</div><div className="hp-stat-label">{visitLabel}</div></div>
            <div className="hp-stat-card"><div className="hp-stat-val">{f.leads}</div><div className="hp-stat-label">Leads</div></div>
            <div className="hp-stat-card"><div className="hp-stat-val">{f.converted}</div><div className="hp-stat-label">Converted</div></div>
          </div>
        </>
      ) : (
        <div className="hp-empty-sub">Setting up…</div>
      )}
    </div>
  );
}

export default function ReferAndEarnScreen() {
  const [data, setData] = useState(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    fetch('/api/partner/attribution').then((r) => (r.ok ? r.json() : null)).then(setData);
  }, []);

  function flash(msg) { setToast(msg); setTimeout(() => setToast(''), 2500); }

  return (
    <>
      <ScreenHeader title="Share & Earn" backHref="/partner/home" />

      <div style={{ padding: '0 16px' }}>
        {!data?.baseUrl && data !== null && (
          <div className="hp-card" style={{ borderColor: 'var(--hp-warn, #B7791F)' }}>
            <div className="hp-card-title">Link sharing isn&rsquo;t fully set up yet</div>
            <div style={{ fontSize: 12.5, color: 'var(--hp-text-soft)' }}>Ask Heseos to finish setting up the app&rsquo;s domain — your code has been created, but the shareable link can&rsquo;t be built yet.</div>
          </div>
        )}

        <LinkCard
          title="Your QR Code"
          hint="Print this on your shop counter, standee or visiting card. Every scan opens WhatsApp with your code attached, so any lead from it is credited to you."
          icon={IconQrCode}
          link={data?.qr}
          visitLabel="Scans"
          onToast={flash}
        />
        <LinkCard
          title="Your Referral Link"
          hint="Share this on WhatsApp status, stories or directly with a customer. Any lead from it shows up under your leads automatically."
          icon={IconLink}
          link={data?.referral}
          visitLabel="Clicks"
          onToast={flash}
        />
      </div>

      {toast && <div className="hp-toast">{toast}</div>}
    </>
  );
}
