'use client';
import Link from 'next/link';
import { Avatar, StatusBadge } from './ui';
import { IconBell, IconLeads, IconGift, IconCheck, IconPlus } from './icons';
import { fmtDateTime } from '@/lib/date';
import { partnerStatusOf, PROPERTY_TYPE_LABEL } from '@/lib/partnerMock';

export default function DashboardScreen({ partner, leads, earnings }) {
  const firstName = (partner.name || 'Partner').split(' ')[0];
  const withStatus = leads.map((l) => ({ ...l, _status: partnerStatusOf(l) }));
  const stats = {
    total: leads.length,
    new: withStatus.filter((l) => l._status === 'new').length,
    progress: withStatus.filter((l) => l._status === 'progress' || l._status === 'followup').length,
    converted: withStatus.filter((l) => l._status === 'converted').length,
  };
  const recent = withStatus.slice(0, 4);

  return (
    <>
      <div className="hp-topbar">
        <div className="hp-brand">
          <span className="hp-brand-mark" style={{ width: 34, height: 34, borderRadius: 10 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M4 14a8 8 0 0 1 16 0" /><path d="M7 17.2a5 5 0 0 1 10 0" /><circle cx="12" cy="20" r="1.4" fill="#fff" stroke="none" /></svg>
          </span>
          <div className="hp-brand-text">
            <span className="hp-brand-name" style={{ fontSize: 15 }}>HESEOS</span>
            <span className="hp-brand-tag" style={{ fontSize: 7 }}>Lighting Ahead</span>
          </div>
        </div>
        <div className="hp-topbar-right">
          <button className="hp-bell" aria-label="Notifications"><IconBell size={18} /><span className="hp-bell-dot" /></button>
          <Link href="/partner/profile"><Avatar name={partner.name} /></Link>
        </div>
      </div>

      <div className="hp-greet-row">
        <div>
          <div className="hp-greet-title">Hi, {firstName}! 👋</div>
          <div className="hp-greet-sub">Here&rsquo;s your lead overview</div>
        </div>
        <div className="hp-wallet-chip">
          <div>
            <div className="hp-wallet-label">Wallet Balance</div>
            <div className="hp-wallet-val">₹{earnings.walletBalance.toLocaleString('en-IN')}</div>
          </div>
        </div>
      </div>

      <div className="hp-promo">
        <div className="hp-promo-img" style={{ backgroundImage: "url('/User-home-screen.png')" }} />
        <div className="hp-promo-fade" />
        <div className="hp-promo-text">
          <div className="hp-h3">Smart homes.<br /><span className="hp-accent-text">Brighter futures.</span></div>
          <div className="hp-sub-sm">Let&rsquo;s grow together.</div>
        </div>
      </div>

      <div className="hp-stat-grid">
        <div className="hp-stat-card"><div className="hp-stat-icon"><IconLeads size={16} /></div><div className="hp-stat-val">{stats.total}</div><div className="hp-stat-label">Total Leads</div></div>
        <div className="hp-stat-card"><div className="hp-stat-icon"><IconPlus size={16} /></div><div className="hp-stat-val">{stats.new}</div><div className="hp-stat-label">New Leads</div></div>
        <div className="hp-stat-card"><div className="hp-stat-icon"><IconGift size={16} /></div><div className="hp-stat-val">{stats.progress}</div><div className="hp-stat-label">In Progress</div></div>
        <div className="hp-stat-card"><div className="hp-stat-icon"><IconCheck size={16} /></div><div className="hp-stat-val">{stats.converted}</div><div className="hp-stat-label">Converted</div></div>
      </div>

      <div className="hp-section-head" style={{ marginTop: 0 }}>
        <div className="hp-section-title">Recent Leads</div>
        <Link className="hp-view-all" href="/partner/leads">View All</Link>
      </div>

      {recent.length === 0 ? (
        <div className="hp-empty">
          <div className="hp-empty-icon"><IconLeads size={24} /></div>
          <div className="hp-empty-title">No leads yet</div>
          <div className="hp-empty-sub">Punch your first lead to get started.</div>
        </div>
      ) : (
        <div className="hp-lead-list">
          {recent.map((l) => (
            <Link key={l.id} href={`/partner/leads/${l.id}`} className="hp-lead-card">
              <Avatar name={l.name} />
              <div className="hp-lead-info">
                <div className="hp-lead-name">{l.name}</div>
                <div className="hp-lead-meta">{PROPERTY_TYPE_LABEL[l.propertyType] || 'Enquiry'} · {l.city}</div>
              </div>
              <div className="hp-lead-right">
                <StatusBadge status={l._status} />
                <span className="hp-lead-time">{fmtDateTime(l.createdAt)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="hp-cta-block">
        <Link href="/partner/leads/new" className="hp-btn hp-btn-primary hp-btn-block"><IconPlus size={18} /> Add New Lead</Link>
      </div>
    </>
  );
}
