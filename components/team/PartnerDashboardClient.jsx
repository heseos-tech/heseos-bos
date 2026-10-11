'use client';
// Team-app partner dashboard — /team/partners/[id]. Opened by tapping a partner in "My Partners"
// (PartnersScreen). Gives the employee who onboarded the partner a one-screen picture of that
// partner and the business they bring in: partner details, lead/conversion KPIs, the value of
// converted deals, and every lead the partner has sent. Tapping a lead opens the normal Lead
// Detail screen (journey + details cards) with its back button returning here.
//
// Read-only. Only partners the signed-in employee personally onboarded are shown — the list
// comes from /api/team/partners, which is scoped server-side, so a guessed id outside that list
// just shows "couldn't be found". Lead data is the same /api/leads feed the rest of the Team
// App already uses, filtered here to this partner.
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ScreenHeader, Avatar } from '@/components/partner/ui';
import { IconMapPin, IconPhone, IconMail, IconCalendar, IconLeads, IconCheck, IconWallet } from '@/components/partner/icons';
import { IconSearch } from '@/components/admin/icons';
import { partnerCategoryLabel, PROPERTY_TYPE } from '@/lib/formOptions';
import { stageOf, displayStatus } from '@/lib/leadStage';
import { fmtDate, fmtDateTime } from '@/lib/date';
import { useApiResource } from '@/lib/useApiResource';

const PT_LABEL = Object.fromEntries(PROPERTY_TYPE.map((p) => [p.v, p.l]));
const ACTIVE_COLOR = { c: '#16A34A', bg: '#DCFCE7' };
const INACTIVE_COLOR = { c: '#6B7E96', bg: '#F1F5F9' };

const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

const TABS = [
  { key: 'all', label: 'All', test: () => true },
  { key: 'open', label: 'In Progress', test: (l) => ['New Lead', 'Demo Scheduled'].includes(stageOf(l)) },
  { key: 'won', label: 'Converted', test: (l) => stageOf(l) === 'Converted' },
  { key: 'lost', label: 'Lost', test: (l) => stageOf(l) === 'Rejected' },
];

export default function PartnerDashboardClient({ id }) {
  const { data: partners, loading: partnersLoading } = useApiResource('/api/team/partners', { pollMs: 30000 });
  const { data: leads, loading: leadsLoading } = useApiResource('/api/leads', { pollMs: 30000 });
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');

  const partner = useMemo(() => partners.find((p) => p.id === id) || null, [partners, id]);
  const own = useMemo(
    () => leads
      .filter((l) => l.partnerId === id)
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
    [leads, id]
  );

  const stats = useMemo(() => {
    const converted = own.filter((l) => stageOf(l) === 'Converted');
    const lost = own.filter((l) => stageOf(l) === 'Rejected').length;
    const demo = own.filter((l) => stageOf(l) === 'Demo Scheduled').length;
    const fresh = own.filter((l) => stageOf(l) === 'New Lead').length;
    const value = converted.reduce((sum, l) => sum + (Number(l.finalPrice) || 0), 0);
    return {
      total: own.length,
      fresh,
      demo,
      won: converted.length,
      lost,
      value,
      rate: own.length ? Math.round((converted.length / own.length) * 100) : 0,
    };
  }, [own]);

  const tabbed = useMemo(() => {
    const t = TABS.find((x) => x.key === tab) || TABS[0];
    const s = q.trim().toLowerCase();
    return own.filter((l) => t.test(l) && (!s || `${l.name || ''} ${l.phone || ''} ${l.city || ''}`.toLowerCase().includes(s)));
  }, [own, tab, q]);

  if (partnersLoading) {
    return (
      <>
        <ScreenHeader title="Partner" backHref="/team/partners" />
        <div className="hp-empty"><div className="hp-empty-sub">Loading…</div></div>
      </>
    );
  }
  if (!partner) {
    return (
      <>
        <ScreenHeader title="Partner" backHref="/team/partners" />
        <div className="hp-empty"><div className="hp-empty-sub">This partner couldn't be found.</div></div>
      </>
    );
  }

  const status = partner.active !== false ? { ...ACTIVE_COLOR, label: 'Active' } : { ...INACTIVE_COLOR, label: 'Inactive' };
  const tiles = [
    { label: 'Total Leads', val: stats.total, icon: IconLeads },
    { label: 'New', val: stats.fresh, icon: IconLeads },
    { label: 'Demo Scheduled', val: stats.demo, icon: IconCalendar },
    { label: 'Converted', val: stats.won, icon: IconCheck },
  ];

  return (
    <>
      <ScreenHeader title={partner.businessName || partner.name || 'Partner'} backHref="/team/partners" />

      {/* Partner details */}
      <div className="hp-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <Avatar name={partner.businessName || partner.name} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="hp-lead-name">{partner.businessName || partner.name}</div>
            <div className="hp-lead-meta">{partnerCategoryLabel(partner.type)}</div>
          </div>
          <span className="hp-badge" style={{ color: status.c, background: status.bg }}><span className="hp-badge-dot" />{status.label}</span>
        </div>
        {partner.businessName && partner.name ? (
          <div className="hp-summary-row"><span className="hp-summary-label">Contact Person</span><span className="hp-summary-val">{partner.name}</span></div>
        ) : null}
        {partner.phone ? (
          <div className="hp-summary-row">
            <span className="hp-summary-label"><IconPhone size={12} style={{ verticalAlign: -1 }} /> Phone</span>
            <a className="hp-summary-val" href={`tel:${partner.phone}`} style={{ textDecoration: 'none' }}>{partner.phone}</a>
          </div>
        ) : null}
        {partner.email ? (
          <div className="hp-summary-row"><span className="hp-summary-label"><IconMail size={12} style={{ verticalAlign: -1 }} /> Email</span><span className="hp-summary-val">{partner.email}</span></div>
        ) : null}
        {partner.city ? (
          <div className="hp-summary-row"><span className="hp-summary-label"><IconMapPin size={12} style={{ verticalAlign: -1 }} /> City</span><span className="hp-summary-val">{partner.city}</span></div>
        ) : null}
        <div className="hp-summary-row"><span className="hp-summary-label">Onboarded</span><span className="hp-summary-val">{partner.createdAt ? fmtDate(partner.createdAt) : '—'}</span></div>
      </div>

      {/* Business from this partner */}
      <div className="hp-earn-hero">
        <div className="hp-earn-icon"><IconWallet size={20} /></div>
        <div className="hp-earn-label">Business From This Partner</div>
        <div className="hp-earn-val">{inr(stats.value)}</div>
        <div className="hp-earn-period">
          {stats.total === 0
            ? 'No leads yet'
            : `${stats.won} converted of ${stats.total} lead${stats.total === 1 ? '' : 's'} · ${stats.rate}% conversion${stats.lost ? ` · ${stats.lost} lost` : ''}`}
        </div>
      </div>

      <div className="hp-stat-grid">
        {tiles.map((s) => {
          const Icon = s.icon;
          return (
            <div className="hp-stat-card" key={s.label}>
              <div className="hp-stat-icon"><Icon size={16} /></div>
              <div className="hp-stat-val">{leadsLoading ? '…' : s.val}</div>
              <div className="hp-stat-label">{s.label}</div>
            </div>
          );
        })}
      </div>

      {/* Leads under this partner */}
      <div className="hp-section-head">
        <div className="hp-section-title">Leads from {partner.businessName || partner.name}</div>
      </div>

      <div className="hp-tabs">
        {TABS.map((t) => (
          <button key={t.key} className={`hp-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label} ({own.filter(t.test).length})
          </button>
        ))}
      </div>

      <div className="hp-search-wrap">
        <div className="hp-input-wrap">
          <span className="hp-input-icon"><IconSearch size={17} /></span>
          <input className="hp-input" placeholder="Search by name, phone or city…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {leadsLoading ? (
        <div className="hp-empty"><div className="hp-empty-sub">Loading…</div></div>
      ) : tabbed.length === 0 ? (
        <div className="hp-empty">
          <div className="hp-empty-icon"><IconLeads size={24} /></div>
          <div className="hp-empty-title">{own.length === 0 ? 'No leads yet' : 'No leads match'}</div>
          <div className="hp-empty-sub">{own.length === 0 ? "Leads this partner sends will show up here." : 'Try a different tab or search.'}</div>
        </div>
      ) : (
        <div className="hp-lead-list">
          {tabbed.map((l) => {
            const st = displayStatus(l);
            return (
              <Link key={l.id} href={`/team/leads/${l.id}?fromPartner=${encodeURIComponent(partner.id)}`} className="hp-lead-card">
                <Avatar name={l.name} />
                <div className="hp-lead-info">
                  <div className="hp-lead-name">{l.name}</div>
                  <div className="hp-lead-meta">{PT_LABEL[l.propertyType] || 'Enquiry'}{l.city ? ` · ${l.city}` : ''}</div>
                  {stageOf(l) === 'Converted' && Number(l.finalPrice) > 0 ? <div className="hp-lead-meta">Deal value {inr(l.finalPrice)}</div> : null}
                </div>
                <div className="hp-lead-right">
                  <span className="hp-badge" style={{ color: st.c, background: st.bg }}><span className="hp-badge-dot" />{st.label}</span>
                  <span className="hp-lead-time">{fmtDateTime(l.createdAt)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
