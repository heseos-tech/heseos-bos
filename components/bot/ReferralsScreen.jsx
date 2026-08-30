'use client';
import { useEffect, useState } from 'react';
import { Topbar } from './ConsoleShell';
import { IconShare } from './icons';

export default function ReferralsScreen() {
  const [referrals, setReferrals] = useState(null);

  useEffect(() => {
    fetch('/api/bot/referrals').then((r) => r.json()).then(setReferrals);
  }, []);

  return (
    <>
      <Topbar title="Referrals" />
      <div className="bc-page">
        <div className="bc-card">
          <div className="bc-card-title">Where your leads are coming from</div>
          <div className="bc-card-sub">Every place your bot's WhatsApp link or QR code is shared.</div>
        </div>
        <div className="bc-stat-grid">
          {(referrals || []).map((r) => (
            <div className="bc-stat-card" key={r.source}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--bc-accent)' }}><IconShare size={16} /></div>
              <div className="bc-stat-val">{r.leads}</div>
              <div className="bc-stat-label">{r.source} · {r.conversions} converted</div>
            </div>
          ))}
        </div>
        {referrals && referrals.length === 0 && <div className="bc-empty">No referral sources set up yet.</div>}
      </div>
    </>
  );
}
