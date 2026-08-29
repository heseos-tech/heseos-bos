'use client';
import { IconWallet, IconGift, IconLeads, IconCheck, IconSpark } from './icons';
import { MOCK_PAYOUTS, HOW_YOU_EARN } from '@/lib/partnerMock';

export default function RewardsScreen({ earnings }) {
  return (
    <>
      <div className="hp-header" style={{ paddingBottom: 4 }}>
        <div className="hp-header-title" style={{ fontSize: 21, fontWeight: 800 }}>Rewards &amp; Earnings</div>
      </div>

      <div className="hp-earn-hero">
        <div className="hp-earn-icon"><IconWallet size={22} /></div>
        <div className="hp-earn-label">Total Earnings</div>
        <div className="hp-earn-val">₹{earnings.total.toLocaleString('en-IN')}</div>
        <div className="hp-earn-period">This Month</div>
      </div>

      <div className="hp-card">
        <div className="hp-card-title">Earnings Breakdown</div>
        <div className="hp-breakdown-row"><span className="hp-breakdown-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><IconLeads size={15} /> Leads Punched</span><span className="hp-breakdown-val">₹{earnings.fromLeads.toLocaleString('en-IN')}</span></div>
        <div className="hp-breakdown-row"><span className="hp-breakdown-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><IconCheck size={15} /> Leads Converted</span><span className="hp-breakdown-val">₹{earnings.fromConversions.toLocaleString('en-IN')}</span></div>
        <div className="hp-breakdown-row"><span className="hp-breakdown-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><IconSpark size={15} /> Bonuses</span><span className="hp-breakdown-val">₹{earnings.bonus.toLocaleString('en-IN')}</span></div>
      </div>

      <div className="hp-section-head" style={{ marginTop: 4 }}>
        <div className="hp-section-title">Payout History</div>
      </div>
      <div className="hp-card" style={{ marginTop: 0 }}>
        {MOCK_PAYOUTS.map((p, i) => (
          <div key={i} className="hp-payout-row">
            <span className="hp-payout-date">{p.date}</span>
            <span className="hp-payout-amt">₹{p.amount.toLocaleString('en-IN')}</span>
            <span className="hp-payout-status">{p.status}</span>
          </div>
        ))}
      </div>

      <div className="hp-card">
        <div className="hp-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><IconGift size={17} /> How You Earn</div>
        {HOW_YOU_EARN.map((h) => (
          <div key={h.title} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', marginBottom: 3 }}>{h.title}</div>
            <div style={{ fontSize: 12.5, color: 'var(--hp-text-soft)', lineHeight: 1.55 }}>{h.desc}</div>
          </div>
        ))}
      </div>
    </>
  );
}
