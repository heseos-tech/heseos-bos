'use client';
import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { Avatar, StatusBadge } from './ui';
import { IconPlus, IconLeads } from './icons';
import { fmtDateTime } from '@/lib/date';
import { partnerStatusOf, PROPERTY_TYPE_LABEL } from '@/lib/partnerMock';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'progress', label: 'In Progress' },
  { key: 'converted', label: 'Converted' },
];

// Fetches its own leads now (instead of a server-fetched prop) so it can stay mounted and
// cached inside PartnerHome's tab switcher — see components/partner/PartnerHome.jsx.
export default function MyLeadsScreen() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');

  useEffect(() => {
    let alive = true;
    fetch('/api/leads').then((r) => (r.ok ? r.json() : [])).then((l) => { if (alive) { setLeads(l); setLoading(false); } });
    return () => { alive = false; };
  }, []);

  const withStatus = useMemo(() => leads.map((l) => ({ ...l, _status: partnerStatusOf(l) })), [leads]);

  const counts = useMemo(() => ({
    all: withStatus.length,
    new: withStatus.filter((l) => l._status === 'new').length,
    progress: withStatus.filter((l) => l._status === 'progress' || l._status === 'followup').length,
    converted: withStatus.filter((l) => l._status === 'converted').length,
  }), [withStatus]);

  const filtered = tab === 'all'
    ? withStatus
    : tab === 'progress'
      ? withStatus.filter((l) => l._status === 'progress' || l._status === 'followup')
      : withStatus.filter((l) => l._status === tab);

  return (
    <>
      <div className="hp-header" style={{ paddingBottom: 4 }}>
        <div className="hp-header-title" style={{ fontSize: 21, fontWeight: 800 }}>My Leads</div>
      </div>

      <div className="hp-tabs">
        {TABS.map((t) => (
          <button key={t.key} className={`hp-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label} ({counts[t.key]})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="hp-empty"><div className="hp-empty-sub">Loading…</div></div>
      ) : filtered.length === 0 ? (
        <div className="hp-empty">
          <div className="hp-empty-icon"><IconLeads size={24} /></div>
          <div className="hp-empty-title">No leads here</div>
          <div className="hp-empty-sub">Try a different tab or punch a new lead.</div>
        </div>
      ) : (
        <div className="hp-lead-list">
          {filtered.map((l) => (
            <Link key={l.id} href={`/partner/leads/${l.id}`} className="hp-lead-card">
              <Avatar name={l.name} />
              <div className="hp-lead-info">
                <div className="hp-lead-name">{l.name}</div>
                <div className="hp-lead-meta">{PROPERTY_TYPE_LABEL[l.propertyType] || 'Enquiry'}, {l.city}</div>
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
        <Link href="/partner/leads/new" className="hp-btn hp-btn-primary hp-btn-block"><IconPlus size={18} /> Punch New Lead</Link>
      </div>
    </>
  );
}
