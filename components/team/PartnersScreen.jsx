'use client';
// Team-app "My Partners" — every partner this employee has onboarded (partner.onboardedByEmployeeId
// — see app/api/team/partners/route.js), as a searchable list with each partner's own lead/
// conversion count. Reached from Home's "My Partners" card, not a bottom-nav tab — same
// reasoning as Catalogue (the nav is already full at five slots — see
// app/team/(app)/catalogue/page.jsx).
//
// Read-only: reassigning who onboarded a partner is an Admin -> Partners action
// (components/admin/PartnersPage.jsx), not something an employee does to their own list here.
import { useMemo, useState } from 'react';
import { ScreenHeader, Avatar } from '@/components/partner/ui';
import { IconMapPin, IconPhone } from '@/components/partner/icons';
import { IconSearch, IconPartners } from '@/components/admin/icons';
import { partnerCategoryLabel } from '@/lib/formOptions';
import { useApiResource } from '@/lib/useApiResource';

const ACTIVE_COLOR = { c: '#16A34A', bg: '#DCFCE7' };
const INACTIVE_COLOR = { c: '#6B7E96', bg: '#F1F5F9' };

export default function PartnersScreen({ backHref = '/team/home' }) {
  const { data: partners, loading } = useApiResource('/api/team/partners', { pollMs: 30000 });
  // Already accessible to any signed-in employee (see app/api/leads's GET) and already polled
  // elsewhere in the Team App — just used here to count each partner's own leads/conversions,
  // same shape as lib/adminMetrics.js's partnerStats but without that function's earnings/
  // payout figure, which has no place in a plain partner directory.
  const { data: leads } = useApiResource('/api/leads', { pollMs: 30000 });
  const [q, setQ] = useState('');

  const rows = useMemo(() => partners.map((p) => {
    const own = leads.filter((l) => l.partnerId === p.id);
    const converted = own.filter((l) => l.demoOutcome === 'converted').length;
    return { ...p, leadsCount: own.length, converted };
  }), [partners, leads]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((p) => `${p.businessName || ''} ${p.name || ''} ${p.phone || ''} ${p.city || ''}`.toLowerCase().includes(s));
  }, [rows, q]);

  const sorted = useMemo(
    () => filtered.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
    [filtered]
  );

  return (
    <>
      <ScreenHeader title={`My Partners${partners.length ? ` (${partners.length})` : ''}`} backHref={backHref} />

      <div className="hp-search-wrap">
        <div className="hp-input-wrap">
          <span className="hp-input-icon"><IconSearch size={17} /></span>
          <input className="hp-input" placeholder="Search by name, phone or city…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="hp-empty"><div className="hp-empty-sub">Loading…</div></div>
      ) : sorted.length === 0 ? (
        <div className="hp-empty">
          <div className="hp-empty-icon"><IconPartners size={24} /></div>
          <div className="hp-empty-title">{partners.length === 0 ? 'No partners yet' : 'No partners match'}</div>
          <div className="hp-empty-sub">
            {partners.length === 0 ? "Partners you onboard — by QR code or by hand — will show up here." : 'Try a different search.'}
          </div>
        </div>
      ) : (
        <div className="hp-lead-list">
          {sorted.map((p) => {
            const status = p.active !== false ? { ...ACTIVE_COLOR, label: 'Active' } : { ...INACTIVE_COLOR, label: 'Inactive' };
            return (
              <div key={p.id} className="hp-lead-card">
                <Avatar name={p.businessName || p.name} />
                <div className="hp-lead-info">
                  <div className="hp-lead-name">{p.businessName || p.name}</div>
                  <div className="hp-lead-meta">
                    {partnerCategoryLabel(p.type)}
                    {p.city ? <> · <IconMapPin size={11} style={{ verticalAlign: -1 }} /> {p.city}</> : null}
                    {p.phone ? <> · <IconPhone size={11} style={{ verticalAlign: -1 }} /> {p.phone}</> : null}
                  </div>
                </div>
                <div className="hp-lead-right">
                  <span className="hp-badge" style={{ color: status.c, background: status.bg }}><span className="hp-badge-dot" />{status.label}</span>
                  <span className="hp-lead-time">{p.leadsCount} lead{p.leadsCount === 1 ? '' : 's'} · {p.converted} won</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
