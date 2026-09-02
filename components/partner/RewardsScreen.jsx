'use client';
// Real tiered payout — computed from the shared Lead Conversion Payout config (Settings →
// lib/payout.js), the SAME ladder that applies to employees (and, once that flow exists,
// customer referrers) too. Replaced the old flat-rate mock (₹250/lead + ₹1000/conversion +
// a fixed monthly bonus, with an invented "wallet balance") — there's still no real payouts/
// wallet backend, so rather than keep inventing numbers (a fake "Payout History"), this shows
// what's actually true: this period's real converted sale value, the tier it lands in, and how
// much more unlocks the next one — a payout amount a partner can trust, not a guess.
import { IconWallet, IconGift, IconLeads, IconCheck, IconSpark } from './icons';
import { useApiResource } from '@/lib/useApiResource';
import { payoutFor, normalizeConfig } from '@/lib/payout';

// Shared with DashboardScreen/MyLeadsScreen (they all stay mounted together in PartnerHome) via
// useApiResource (lib/useApiResource.js), instead of each independently fetching the same
// /api/leads (and now /api/payout-settings) on its own first visit.
export default function RewardsScreen() {
  const { data: leads } = useApiResource('/api/leads');
  const { data: rawConfig } = useApiResource('/api/payout-settings');

  const config = normalizeConfig(rawConfig);
  const payout = payoutFor(leads, config);
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
          {payout.periodLabel}{payout.hasTiers ? ` · ${payout.rate}% of ₹${payout.totalValue.toLocaleString('en-IN')} converted` : ''}
        </div>
      </div>

      {!payout.hasTiers && (
        <div className="hp-card" style={{ background: 'var(--hp-warn-dim)', border: '1px solid var(--hp-warn)' }}>
          <div className="hp-summary-label" style={{ color: 'var(--hp-warn)' }}>Payout tiers haven&rsquo;t been set up yet — check back once they are.</div>
        </div>
      )}

      <div className="hp-card">
        <div className="hp-card-title">This {periodWord}&rsquo;s Summary</div>
        <div className="hp-breakdown-row"><span className="hp-breakdown-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><IconCheck size={15} /> Leads Converted</span><span className="hp-breakdown-val">{payout.convertedCount}</span></div>
        <div className="hp-breakdown-row"><span className="hp-breakdown-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><IconLeads size={15} /> Converted Sale Value</span><span className="hp-breakdown-val">₹{payout.totalValue.toLocaleString('en-IN')}</span></div>
        <div className="hp-breakdown-row"><span className="hp-breakdown-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><IconSpark size={15} /> Your Payout Rate</span><span className="hp-breakdown-val">{payout.rate}%</span></div>
      </div>

      {payout.nextTier && (
        <div className="hp-card">
          <div className="hp-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><IconGift size={17} /> Next Tier</div>
          <div style={{ fontSize: 13, color: 'var(--hp-text-soft)', lineHeight: 1.6 }}>
            Convert <strong style={{ color: '#fff' }}>₹{(payout.remainingToNextTier || 0).toLocaleString('en-IN')}</strong> more this {periodWord.toLowerCase()} to move up to <strong style={{ color: '#fff' }}>{payout.nextTier.rate}%</strong>.
          </div>
        </div>
      )}

      {config.tiers.length > 0 && (
        <div className="hp-card" style={{ marginBottom: 24 }}>
          <div className="hp-card-title">Payout Tiers</div>
          {config.tiers.map((t, i) => (
            <div key={i} className={`hp-tier-row${i === payout.tierIndex ? ' active' : ''}`}>
              <span className="hp-tier-range">{t.upTo == null ? `Above ₹${(config.tiers[i - 1]?.upTo || 0).toLocaleString('en-IN')}` : `Up to ₹${t.upTo.toLocaleString('en-IN')}`}</span>
              <span className="hp-tier-rate">{t.rate}%</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
