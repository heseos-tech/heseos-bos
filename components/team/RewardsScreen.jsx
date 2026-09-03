'use client';
// Team-app mirror of components/partner/RewardsScreen.jsx — same tiered payout engine
// (lib/payout.js), same card layout, but scoped to leads THIS employee referred
// (addedByEmployeeId) and priced under the 'employee' payout category instead of 'partner'.
// Shared by both presales and sales_engineer — payout crediting works identically for both
// roles (HomeScreen.jsx's existing payout hero already computes it the same way) — but sales
// engineers treat every lead as a demo they ran, so their copy says "Demo" instead of "Lead".
import { IconWallet, IconGift, IconLeads, IconCheck, IconSpark } from '@/components/partner/icons';
import { useApiResource } from '@/lib/useApiResource';
import { payoutFor, normalizeConfig } from '@/lib/payout';

export default function TeamRewardsScreen({ employee }) {
  const isSE = employee.role === 'sales_engineer';
  const noun = isSE ? 'Demos' : 'Leads';

  const { data: leads } = useApiResource('/api/leads');
  const { data: rawConfig } = useApiResource('/api/payout-settings');

  const config = normalizeConfig(rawConfig);
  const myReferrals = leads.filter((l) => l.addedByEmployeeId === employee.id);
  const payout = payoutFor(myReferrals, config, 'employee');
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
        <div className="hp-breakdown-row"><span className="hp-breakdown-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><IconCheck size={15} /> {noun} Converted</span><span className="hp-breakdown-val">{payout.convertedCount}</span></div>
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

      {payout.tiers.length > 0 && (
        <div className="hp-card" style={{ marginBottom: 24 }}>
          <div className="hp-card-title">Payout Tiers</div>
          {payout.tiers.map((t, i) => (
            <div key={i} className={`hp-tier-row${i === payout.tierIndex ? ' active' : ''}`}>
              <span className="hp-tier-range">{t.upTo == null ? `Above ₹${(payout.tiers[i - 1]?.upTo || 0).toLocaleString('en-IN')}` : `Up to ₹${t.upTo.toLocaleString('en-IN')}`}</span>
              <span className="hp-tier-rate">{t.rate}%</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
