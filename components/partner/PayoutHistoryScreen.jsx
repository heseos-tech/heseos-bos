'use client';
// Profile → Payout History. This is the settled ledger, not an estimate — every row here is a
// real entry an admin created in Admin → Payouts once they'd actually paid this partner some
// other way (bank transfer, UPI, cash) and logged it (see app/api/admin/payouts). Rewards &
// Earnings (RewardsScreen.jsx) already shows this period's live running estimate; this is what
// happened underneath it. No invented numbers, no fake history — if nothing's been settled yet,
// this is empty, honestly.
import { useState, useEffect, useCallback } from 'react';
import { ScreenHeader } from './ui';
import { IconHistory } from './icons';

const STATUS_LABEL = { pending: 'Pending', processing: 'Processing', paid: 'Paid' };
const STATUS_CLASS = { pending: 'hp-payout-status--pending', processing: 'hp-payout-status--processing', paid: 'hp-payout-status--paid' };

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

export default function PayoutHistoryScreen() {
  const [payouts, setPayouts] = useState(null);

  const load = useCallback(() => {
    fetch('/api/partner/payouts').then((r) => (r.ok ? r.json() : [])).then(setPayouts);
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <>
      <ScreenHeader title="Payout History" backHref="/partner/home?tab=profile" />

      <div style={{ padding: '0 16px' }}>
        {payouts === null ? (
          <div className="hp-empty"><div className="hp-empty-sub">Loading…</div></div>
        ) : payouts.length === 0 ? (
          <div className="hp-empty">
            <div className="hp-empty-icon"><IconHistory size={24} /></div>
            <div className="hp-empty-title">No payouts yet</div>
            <div className="hp-empty-sub">Once a payout is processed for you, it&rsquo;ll show up here with the amount, date and status.</div>
          </div>
        ) : (
          <div className="hp-card">
            {payouts.map((p) => (
              <div key={p.id} className="hp-payout-row" style={{ flexWrap: 'wrap' }}>
                <span className="hp-payout-date">
                  {p.periodLabel || 'Payout'}
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--hp-text-faint)', marginTop: 2 }}>
                    {p.status === 'paid' ? `Paid ${formatDate(p.paidAt)}` : `Logged ${formatDate(p.createdAt)}`}
                  </span>
                </span>
                <span className="hp-payout-amt">₹{Number(p.amount || 0).toLocaleString('en-IN')}</span>
                <span className={`hp-payout-status ${STATUS_CLASS[p.status] || ''}`}>{STATUS_LABEL[p.status] || p.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
