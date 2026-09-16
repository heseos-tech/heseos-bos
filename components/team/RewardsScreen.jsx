'use client';
// Team-app mirror of components/partner/RewardsScreen.jsx — same tiered payout engine
// (lib/payout.js), same card layout, but scoped to leads THIS employee referred
// (addedByEmployeeId) and priced under the 'employee' payout category instead of 'partner'.
// Shared by both presales and sales_engineer — payout crediting works identically for both
// roles, and depends only on who REFERRED the lead, never on who ends up working/converting
// it (that's a separate "job" concern with no incentive plan defined yet — don't mix the two).
// Because of that, this screen's copy always says "leads referred", never "demo" — a sales
// engineer's referral earning isn't about demos they personally ran.
//
// PROGRESSIVE ("tax slab") payout, not flat — see lib/payout.js's header, and
// components/partner/RewardsScreen.jsx's matching note for why this screen shows BOTH
// payout.effectiveRate (blended, on the whole total) and payout.rate (marginal, on the next
// rupee): selling more never shrinks the total payout, even though the % on the newest chunk
// steps down past each threshold.
import { IconWallet, IconGift, IconLeads, IconCheck, IconSpark } from '@/components/partner/icons';
import { useApiResource } from '@/lib/useApiResource';
import { payoutFor, normalizeConfig } from '@/lib/payout';

export default function TeamRewardsScreen({ employee }) {
  const { data: leads } = useApiResource('/api/leads', { pollMs: 20000 });
  const { data: rawConfig } = useApiResource('/api/payout-settings');

  const config = normalizeConfig(rawConfig);
  const myReferrals = leads.filter((l) => l.addedByEmployeeId === employee.id);
  const payout = payoutFor(myReferrals, config, 'employee');
  const periodWord = config.period === 'quarterly' ? 'Quarter' : 'Month';

  return (
    <>
      <div className="hp-header" style={{ paddingBottom: 4, flexDirection: 'column', alignItems: 'flex-start' }}>
        <div className="hp-header-title" style={{ fontSize: 21, fontWeight: 800 }}>Rewards &amp; Earnings</div>
        <div className="hp-sub-sm" style={{ marginTop: 2 }}>Payout for leads you&rsquo;ve referred — separate from your day-to-day work</div>
      </div>

      <div className="hp-earn-hero">
        <div className="hp-earn-icon"><IconWallet size={22} /></div>
        <div className="hp-earn-label">This {periodWord}&rsquo;s Payout</div>
        <div className="hp-earn-val">₹{payout.payout.toLocaleString('en-IN')}</div>
        <div className="hp-earn-period">
          {payout.periodLabel}{payout.hasTiers ? ` · ${payout.effectiveRate}% overall on ₹${payout.totalValue.toLocaleString('en-IN')} converted` : ''}
        </div>
      </div>

      {!payout.enabled && (
        <div className="hp-card" style={{ background: 'var(--hp-warn-dim)', border: '1px solid var(--hp-warn)' }}>
          <div className="hp-summary-label" style={{ color: 'var(--hp-warn)' }}>Employee payouts are currently turned off in Settings.</div>
        </div>
      )}
      {payout.enabled && !payout.hasTiers && (
        <div className="hp-card" style={{ background: 'var(--hp-warn-dim)', border: '1px solid var(--hp-warn)' }}>
          <div className="hp-summary-label" style={{ color: 'var(--hp-warn)' }}>Payout tiers haven&rsquo;t been set up yet — check back once they are.</div>
        </div>
      )}

      <div className="hp-card">
        <div className="hp-card-title">This {periodWord}&rsquo;s Summary</div>
        <div className="hp-breakdown-row"><span className="hp-breakdown-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><IconCheck size={15} /> Referred Leads Converted</span><span className="hp-breakdown-val">{payout.convertedCount}</span></div>
        <div className="hp-breakdown-row"><span className="hp-breakdown-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><IconLeads size={15} /> Converted Sale Value</span><span className="hp-breakdown-val">₹{payout.totalValue.toLocaleString('en-IN')}</span></div>
        <div className="hp-breakdown-row"><span className="hp-breakdown-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><IconSpark size={15} /> Your Effective Rate</span><span className="hp-breakdown-val">{payout.effectiveRate}%</span></div>
      </div>

      {payout.nextTier ? (
        <div className="hp-card">
          <div className="hp-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><IconGift size={17} /> Keep Referring — It Always Adds Up</div>
          <div style={{ fontSize: 13, color: 'var(--hp-text-soft)', lineHeight: 1.6 }}>
            Convert <strong style={{ color: '#fff' }}>₹{(payout.remainingToNextTier || 0).toLocaleString('en-IN')}</strong> more this {periodWord.toLowerCase()} and every extra rupee beyond that still earns you money — the rate on that portion steps to <strong style={{ color: '#fff' }}>{payout.nextTier.rate}%</strong> instead of {payout.rate}%, but nothing you&rsquo;ve already earned changes. A lower % on the extra just means a bigger deal — your total payout only ever goes up.
          </div>
        </div>
      ) : payout.hasTiers && payout.tierIndex === payout.tiers.length - 1 && payout.totalValue > 0 && (
        <div className="hp-card">
          <div className="hp-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><IconGift size={17} /> You&rsquo;re In The Top Bracket</div>
          <div style={{ fontSize: 13, color: 'var(--hp-text-soft)', lineHeight: 1.6 }}>
            Every rupee you convert from here keeps earning at <strong style={{ color: '#fff' }}>{payout.rate}%</strong> — there&rsquo;s no ceiling on how much more you can add this {periodWord.toLowerCase()}.
          </div>
        </div>
      )}

      {payout.tiers.length > 0 && (
        <div className="hp-card" style={{ marginBottom: 24 }}>
          <div className="hp-card-title">Payout Tiers</div>
          <p style={{ fontSize: 12, color: 'var(--hp-text-soft)', marginTop: -10, marginBottom: 14, lineHeight: 1.5 }}>
            Works like income-tax slabs — each tier&rsquo;s % only applies to the slice of your sale value in that range, so you keep everything the earlier tiers already paid.
          </p>
          {payout.tiers.map((t, i) => {
            const earned = payout.tierBreakdown?.find((b) => b.upTo === t.upTo && b.rate === t.rate);
            const isActive = i === payout.tierIndex;
            return (
              <div key={i} className={`hp-tier-row${isActive ? ' active' : ''}${!isActive && earned ? ' earned' : ''}`}>
                <div>
                  <span className="hp-tier-range">{t.upTo == null ? `Above ₹${(payout.tiers[i - 1]?.upTo || 0).toLocaleString('en-IN')}` : `Up to ₹${t.upTo.toLocaleString('en-IN')}`}</span>
                  {earned && <div className="hp-tier-earned">{isActive ? 'Earning here now' : 'Fully earned'} · ₹{earned.slicePayout.toLocaleString('en-IN')}</div>}
                </div>
                <span className="hp-tier-rate">{t.rate}%</span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
