'use client';
// Real tiered payout — computed from the shared Lead Conversion Payout config (Settings →
// lib/payout.js), the SAME ladder that applies to employees (and, once that flow exists,
// customer referrers) too. Replaced the old flat-rate mock (₹250/lead + ₹1000/conversion +
// a fixed monthly bonus, with an invented "wallet balance") — there's still no real payouts/
// wallet backend, so rather than keep inventing numbers (a fake "Payout History"), this shows
// what's actually true: this period's real converted sale value, the tier it lands in, and how
// much more unlocks the next one — a payout amount a partner can trust, not a guess.
//
// PROGRESSIVE ("tax slab") payout, not flat — see lib/payout.js's header. This means a partner
// who sells more NEVER earns less in absolute rupees, even though the % on the newest chunk of
// revenue steps down past each threshold — the earlier, higher-rate tiers keep paying exactly
// what they always did. That distinction is easy to misread as "selling more shrinks my cut,"
// so this screen deliberately shows BOTH numbers (payout.effectiveRate — the blended rate on
// the whole total — and payout.rate — the marginal rate on the next rupee) plus a per-tier
// earned breakdown, and leads with "your total only ever goes up" rather than just a %.
import { IconWallet, IconGift, IconLeads, IconCheck, IconSpark } from './icons';
import { useApiResource } from '@/lib/useApiResource';
import { payoutFor, normalizeConfig } from '@/lib/payout';

// Shared with DashboardScreen/MyLeadsScreen (they all stay mounted together in PartnerHome) via
// useApiResource (lib/useApiResource.js), instead of each independently fetching the same
// /api/leads (and now /api/payout-settings) on its own first visit.
export default function RewardsScreen() {
  const { data: leads } = useApiResource('/api/leads', { pollMs: 20000 });
  const { data: rawConfig } = useApiResource('/api/payout-settings');

  const config = normalizeConfig(rawConfig);
  const payout = payoutFor(leads, config, 'partner');
  const periodWord = config.period === 'quarterly' ? 'Quarter' : 'Month';

  return (
    <>
      <div className="hp-header" style={{ paddingBottom: 4 }}>
        <div className="hp-header-title" style={{ fontSize: 21, fontWeight: 800 }}>Rewards &amp; Earnings</div>
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
          <div className="hp-summary-label" style={{ color: 'var(--hp-warn)' }}>Partner payouts are currently turned off in Settings.</div>
        </div>
      )}
      {payout.enabled && !payout.hasTiers && (
        <div className="hp-card" style={{ background: 'var(--hp-warn-dim)', border: '1px solid var(--hp-warn)' }}>
          <div className="hp-summary-label" style={{ color: 'var(--hp-warn)' }}>Payout tiers haven&rsquo;t been set up yet — check back once they are.</div>
        </div>
      )}

      <div className="hp-card">
        <div className="hp-card-title">This {periodWord}&rsquo;s Summary</div>
        <div className="hp-breakdown-row"><span className="hp-breakdown-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><IconCheck size={15} /> Leads Converted</span><span className="hp-breakdown-val">{payout.convertedCount}</span></div>
        <div className="hp-breakdown-row"><span className="hp-breakdown-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><IconLeads size={15} /> Converted Sale Value</span><span className="hp-breakdown-val">₹{payout.totalValue.toLocaleString('en-IN')}</span></div>
        <div className="hp-breakdown-row"><span className="hp-breakdown-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><IconSpark size={15} /> Your Effective Rate</span><span className="hp-breakdown-val">{payout.effectiveRate}%</span></div>
      </div>

      {payout.nextTier ? (
        <div className="hp-card">
          <div className="hp-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><IconGift size={17} /> Keep Selling — It Always Adds Up</div>
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
