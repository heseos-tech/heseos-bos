'use client';
// Pre-sales → "Cards Not Opened": customers who were sent the WhatsApp landing-page card (Door Lock /
// Smart Home) more than 15 minutes ago and never opened it — the same list as Admin → Landing Activity —
// plus a place to record the call outcome (Dead / Call Again / Follow up / Out of Location / Success)
// and WHO made the call. Outcomes are saved per customer phone (/api/presales/card-followups).
import { useMemo, useState } from 'react';
import { useApiResource, invalidate } from '@/lib/useApiResource';
import { Pagination } from '@/components/admin/ui';
import { IconSearch } from '@/components/admin/icons';
import { CARD_STATUSES, cardStatusOf, cardFollowupKey } from '@/lib/cardFollowupStatus';

const LIST_URL = '/api/admin/landing-activity?days=30&page=all';
const FU_URL = '/api/presales/card-followups';
const PAGE_LABEL = { door_lock: 'Door Lock', smart_home: 'Smart Home' };
const PAGE_SIZE = 10;

export function cardWhen(iso) {
  return iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
}
export function cardWaLink(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  return d ? `https://wa.me/${d.length === 10 ? `91${d}` : d}` : '#';
}

// Shared by the desktop panel and the mobile Team screen.
export function useCardFollowups() {
  const { data: landing, loading } = useApiResource(LIST_URL, { pollMs: 60000 });
  const { data: fu } = useApiResource(FU_URL, { pollMs: 30000 });
  const rows = useMemo(() => (Array.isArray(landing?.notOpened) ? landing.notOpened : []), [landing]);
  const followups = fu?.followups || {};
  const callers = fu?.callers || [];
  const me = fu?.me || null;
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');

  async function save(phone, status, callerId) {
    const key = cardFollowupKey(phone);
    setSaving(key); setError('');
    try {
      const res = await fetch(FU_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, status, callerId }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError(d.error || 'Could not save');
      else await invalidate(FU_URL);
    } finally { setSaving(''); }
  }
  const statusOf = (phone) => followups[cardFollowupKey(phone)]?.status || '';
  return { rows, loading, followups, callers, me, saving, error, save, statusOf };
}

export function StatusBadge({ status }) {
  const s = cardStatusOf(status);
  if (!s) return <span className="adm-lead-sub">Not called yet</span>;
  return <span className="badge" style={{ color: s.color, background: s.bg }}><span className="badge-dot" />{s.label}</span>;
}

export default function CardFollowups() {
  const { rows, loading, followups, callers, me, saving, error, save, statusOf } = useCardFollowups();
  const [filter, setFilter] = useState('pending');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const counts = useMemo(() => {
    const c = { all: rows.length, pending: 0 };
    for (const s of CARD_STATUSES) c[s.key] = 0;
    for (const r of rows) { const st = statusOf(r.phone); if (st) c[st] += 1; else c.pending += 1; }
    return c;
  }, [rows, followups]); // eslint-disable-line react-hooks/exhaustive-deps

  const tabs = [{ key: 'pending', label: 'To call' }, ...CARD_STATUSES.map((s) => ({ key: s.key, label: s.label })), { key: 'all', label: 'All' }];
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      const st = statusOf(r.phone);
      if (filter === 'pending' ? !!st : filter !== 'all' && st !== filter) return false;
      return !s || String(r.phone).includes(s) || (PAGE_LABEL[r.page] || '').toLowerCase().includes(s);
    });
  }, [rows, filter, q, followups]); // eslint-disable-line react-hooks/exhaustive-deps
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <div className="adm-page-head">
        <div>
          <h1 className="adm-greeting">Cards Not Opened</h1>
          <p className="adm-page-sub">Customers who got the WhatsApp link over 15 minutes ago and never opened it — call them and mark the outcome</p>
        </div>
      </div>

      <div className="adm-card">
        <div className="adm-toolbar">
          <div className="adm-search adm-search--inline"><IconSearch size={16} /><input placeholder="Search by phone or page…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
        </div>
        <div className="dash-tabs">
          {tabs.map((t) => (
            <button key={t.key} className={`dash-tab${filter === t.key ? ' active' : ''}`} onClick={() => { setFilter(t.key); setPage(1); }}>
              {t.label} <span className="dash-tab-count">{counts[t.key] || 0}</span>
            </button>
          ))}
        </div>
        {error && <div className="adm-empty" style={{ color: '#B42318' }}>{error}</div>}

        {loading ? <div className="adm-empty">Loading…</div> : pageRows.length === 0 ? (
          <div className="adm-empty">{filter === 'pending' ? 'Nobody left to call — every card is either opened or marked.' : 'Nothing here.'}</div>
        ) : (
          <div className="adm-table-scroll">
            <table className="adm-table">
              <thead><tr><th>Phone</th><th>Page</th><th>Card sent</th><th>Status</th><th>Who is calling</th><th></th></tr></thead>
              <tbody>
                {pageRows.map((r) => {
                  const key = cardFollowupKey(r.phone);
                  const rec = followups[key];
                  const callerId = rec?.callerId || me?.id || '';
                  const busy = saving === key;
                  return (
                    <tr key={`${r.phone}${r.page}`}>
                      <td>{r.phone}</td>
                      <td>{PAGE_LABEL[r.page] || r.page}</td>
                      <td>{cardWhen(r.sentAt)}</td>
                      <td>
                        <select value={rec?.status || ''} disabled={busy} onChange={(e) => save(r.phone, e.target.value, callerId)}>
                          <option value="">Select status…</option>
                          {CARD_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                        </select>
                        {rec?.updatedAt && <div className="adm-lead-sub" style={{ marginTop: 4 }}>{cardWhen(rec.updatedAt)}</div>}
                      </td>
                      <td>
                        <select value={callerId} disabled={busy || callers.length === 0} onChange={(e) => save(r.phone, rec?.status || '', e.target.value)}>
                          {callers.length === 0 && <option value="">—</option>}
                          {callers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </td>
                      <td className="adm-row-actions">
                        <a className="adm-chip-btn" href={`tel:${r.phone}`} style={{ marginRight: 6 }}>Call</a>
                        <a className="adm-chip-btn" href={cardWaLink(r.phone)} target="_blank" rel="noreferrer">WhatsApp</a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageCount={pageCount} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>
    </>
  );
}
