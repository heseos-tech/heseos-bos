'use client';
// Installer app -> Earnings. Installation fees are tracked in the same payouts ledger Admin settles
// (Admin -> Payouts): a fee becomes "pending payout" when you complete a job and "paid" once Heseos
// has transferred it and marked it paid. Referral rewards (leads you punch in) sit on their own tab.
import Link from 'next/link';
import { useMemo } from 'react';
import { IconWallet, IconHistory, IconGift } from '@/components/partner/icons';
import { IconChevronRight } from '@/components/admin/icons';
import { useJobs, money, fmtDate } from './jobUtils';

export default function EarningsScreen() {
  const { mine, loading } = useJobs();
  const s = useMemo(() => {
    let upcoming = 0, pending = 0, paid = 0;
    for (const j of mine) {
      const fee = Number(j.fee) || 0;
      if (!j.done) upcoming += fee;
      else if (j.payoutStatus === 'paid') paid += fee;
      else pending += fee;
    }
    return { upcoming, pending, paid };
  }, [mine]);
  const done = mine.filter((j) => j.done);

  return (
    <>
      <div className="hp-header" style={{ paddingBottom: 4 }}>
        <div className="hp-header-title" style={{ fontSize: 21, fontWeight: 800 }}>Earnings</div>
      </div>

      <div className="hp-earn-hero" style={{ display: 'block' }}>
        <div className="hp-earn-icon"><IconWallet size={20} /></div>
        <div className="hp-earn-label">Installation fees — pending payout</div>
        <div className="hp-earn-val">{money(s.pending)}</div>
        <div className="hp-earn-period">{money(s.paid)} paid so far · {money(s.upcoming)} from jobs in progress</div>
      </div>

      <Link href="/installer/home?tab=referrals" className="hp-card" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
        <div className="hp-stat-icon" style={{ width: 38, height: 38, flexShrink: 0, margin: 0 }}><IconGift size={19} /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Referral rewards</div>
          <div style={{ fontSize: 12, color: 'var(--hp-text-soft)' }}>What you earn on leads you refer</div>
        </div>
        <IconChevronRight size={18} style={{ color: 'var(--hp-text-faint)', flexShrink: 0 }} />
      </Link>
      <Link href="/installer/payouts" className="hp-card" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
        <div className="hp-stat-icon" style={{ width: 38, height: 38, flexShrink: 0, margin: 0 }}><IconHistory size={19} /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Payout history</div>
          <div style={{ fontSize: 12, color: 'var(--hp-text-soft)' }}>Everything Heseos has logged or paid to you</div>
        </div>
        <IconChevronRight size={18} style={{ color: 'var(--hp-text-faint)', flexShrink: 0 }} />
      </Link>

      <div className="hp-section-head" style={{ marginTop: 0 }}><div className="hp-section-title">Completed installations</div></div>
      {loading ? (
        <div className="hp-empty"><div className="hp-empty-sub">Loading…</div></div>
      ) : done.length === 0 ? (
        <div className="hp-empty">
          <div className="hp-empty-icon"><IconWallet size={24} /></div>
          <div className="hp-empty-title">No completed installations yet</div>
          <div className="hp-empty-sub">Finish a job and its fee shows up here.</div>
        </div>
      ) : (
        <div className="hp-card">
          {done.map((j) => (
            <div key={`${j.kind}:${j.id}`} className="hp-payout-row" style={{ flexWrap: 'wrap' }}>
              <span className="hp-payout-date">
                {j.customerName || j.ref}
                <span style={{ display: 'block', fontSize: 11, color: 'var(--hp-text-faint)', marginTop: 2 }}>{j.ref} · {fmtDate((j.completedAt || '').slice(0, 10)) || fmtDate(j.installDate)}</span>
              </span>
              <span className="hp-payout-amt">{money(j.fee)}</span>
              <span className={`hp-payout-status hp-payout-status--${j.payoutStatus === 'paid' ? 'paid' : j.payoutStatus === 'processing' ? 'processing' : 'pending'}`}>
                {j.payoutStatus === 'paid' ? 'Paid' : j.payoutStatus === 'processing' ? 'Processing' : 'Pending'}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
