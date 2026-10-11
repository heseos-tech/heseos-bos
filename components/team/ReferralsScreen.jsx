'use client';
// Team-app "All Referrals" — /team/referrals, reached from Home's Recent Referrals "View All".
// Every open (not Converted / Rejected) lead this employee added themselves or received through a
// partner they onboarded, newest first, filterable + searchable and paginated client-side (the
// full /api/leads feed is already loaded and polled for Home, so paging is just a slice).
import { useEffect, useMemo, useState } from 'react';
import { ScreenHeader } from '@/components/partner/ui';
import { IconLeads } from '@/components/partner/icons';
import { IconSearch } from '@/components/admin/icons';
import { useEmployeeSession } from './ui';
import ReferralCard from './ReferralCard';
import { activeReferrals, referralKind } from '@/lib/teamReferrals';
import { useApiResource } from '@/lib/useApiResource';

const PAGE_SIZE = 10;
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'self', label: 'Added by me' },
  { key: 'partner', label: 'Via partners' },
];

export default function ReferralsScreen({ backHref = '/team/home' }) {
  const employee = useEmployeeSession();
  const { data: leads, loading } = useApiResource('/api/leads', { pollMs: 30000 });
  const { data: partners } = useApiResource('/api/team/partners', { pollMs: 30000 });
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const partnerIds = useMemo(() => new Set(partners.map((p) => p.id)), [partners]);
  const partnerName = useMemo(() => Object.fromEntries(partners.map((p) => [p.id, p.businessName || p.name])), [partners]);
  const all = useMemo(() => activeReferrals(leads, employee.id, partnerIds), [leads, employee.id, partnerIds]);

  const counts = useMemo(() => ({
    all: all.length,
    self: all.filter((l) => referralKind(l, partnerIds) === 'self').length,
    partner: all.filter((l) => referralKind(l, partnerIds) === 'partner').length,
  }), [all, partnerIds]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return all.filter((l) =>
      (filter === 'all' || referralKind(l, partnerIds) === filter) &&
      (!s || `${l.name || ''} ${l.phone || ''} ${l.city || ''}`.toLowerCase().includes(s))
    );
  }, [all, filter, q, partnerIds]);

  // Back to page 1 whenever the result set changes shape.
  useEffect(() => { setPage(1); }, [filter, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <>
      <ScreenHeader title={`Referrals${all.length ? ` (${all.length})` : ''}`} backHref={backHref} />

      <div className="hp-tabs">
        {FILTERS.map((f) => (
          <button key={f.key} className={`hp-tab${filter === f.key ? ' active' : ''}`} onClick={() => setFilter(f.key)}>
            {f.label} ({counts[f.key]})
          </button>
        ))}
      </div>

      <div className="hp-search-wrap">
        <div className="hp-input-wrap">
          <span className="hp-input-icon"><IconSearch size={17} /></span>
          <input className="hp-input" placeholder="Search by name, phone or city…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="hp-empty"><div className="hp-empty-sub">Loading…</div></div>
      ) : rows.length === 0 ? (
        <div className="hp-empty">
          <div className="hp-empty-icon"><IconLeads size={24} /></div>
          <div className="hp-empty-title">{all.length === 0 ? 'No open referrals' : 'No referrals match'}</div>
          <div className="hp-empty-sub">
            {all.length === 0 ? "Open leads you add, or that your partners send, will show up here. Converted and rejected leads are not listed." : 'Try a different filter or search.'}
          </div>
        </div>
      ) : (
        <>
          <div className="hp-lead-list">
            {rows.map((l) => (
              <ReferralCard
                key={l.id}
                lead={l}
                origin={referralKind(l, partnerIds) === 'partner' ? `via ${partnerName[l.partnerId] || 'partner'}` : 'Added by you'}
              />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="hp-cat-pagination">
              <button type="button" className="hp-cat-page-btn" disabled={current <= 1} onClick={() => setPage(current - 1)}>Prev</button>
              <span className="hp-cat-page-info">Page {current} of {totalPages}</span>
              <button type="button" className="hp-cat-page-btn" disabled={current >= totalPages} onClick={() => setPage(current + 1)}>Next</button>
            </div>
          )}
        </>
      )}
    </>
  );
}
