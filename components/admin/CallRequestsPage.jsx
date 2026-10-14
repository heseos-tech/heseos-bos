'use client';
// Admin -> Call Requests: WhatsApp customers who tapped "Talk to someone" / "Talk to our team".
// They are NOT leads — just numbers to call back (see lib/heseosCallRequests.js). Same layout
// recipe as OrdersPage.jsx: stat cards, search, status tabs with live counts, paginated table,
// detail modal.
import { useMemo, useState } from 'react';
import { StatCard, Modal, Pagination } from './ui';
import { IconSearch, IconPhone, IconLeads, IconConversions } from './icons';
import { useApiResource, invalidate } from '@/lib/useApiResource';

const URL_ = '/api/admin/call-requests';
const PAGE_SIZE = 10;

const STATUS_TABS = [
  { key: 'new', label: 'New' },
  { key: 'called', label: 'Called' },
  { key: 'closed', label: 'Closed' },
  { key: 'all', label: 'All' },
];
const STATUS_LABEL = { new: 'New', called: 'Called', closed: 'Closed' };

function fmt(d) {
  return d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
}
function waLink(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  return d ? `https://wa.me/${d.length === 10 ? `91${d}` : d}` : '#';
}
function contextOf(r) {
  if (r.hasLead && r.hasOrder) return 'Existing lead + customer';
  if (r.hasLead) return 'Existing lead';
  if (r.hasOrder) return 'Existing customer';
  return 'New contact';
}

export default function CallRequestsPage() {
  const { data: rows, loading, refresh } = useApiResource(URL_, { pollMs: 15000 });
  const [status, setStatus] = useState('new');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState('');

  function flash(msg) { setNotice(msg); setTimeout(() => setNotice(''), 3500); }
  function load() { invalidate(URL_); refresh(); }

  const counts = useMemo(() => {
    const c = { all: rows.length, new: 0, called: 0, closed: 0 };
    for (const r of rows) c[r.status] = (c[r.status] || 0) + 1;
    return c;
  }, [rows]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (status !== 'all' && r.status !== status) return false;
    if (q.trim() && !`${r.name || ''} ${r.phone || ''} ${r.id}`.toLowerCase().includes(q.trim().toLowerCase())) return false;
    return true;
  }), [rows, status, q]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function patch(id, body) {
    const res = await fetch(`${URL_}/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    load();
    return data;
  }
  async function setStatusOf(r, next) {
    const updated = await patch(r.id, { status: next });
    setModal({ row: updated });
    flash(`Marked ${STATUS_LABEL[next]}`);
  }

  return (
    <>
      <div className="adm-page-head">
        <div><h1 className="adm-h1">Call Requests</h1><p className="adm-page-sub">Customers who tapped “Talk to someone” on WhatsApp — call them back and mark it done. These are not added to Leads.</p></div>
      </div>

      {notice && <div className="adm-notice">{notice}</div>}

      <div className="adm-stat-row">
        <StatCard label="Total Requests" value={rows.length} Icon={IconPhone} tone="orange" />
        <StatCard label="Waiting for a call" value={counts.new || 0} Icon={IconLeads} tone="purple" />
        <StatCard label="Called" value={counts.called || 0} Icon={IconPhone} tone="teal" />
        <StatCard label="Closed" value={counts.closed || 0} Icon={IconConversions} tone="green" />
      </div>

      <div className="adm-card">
        <div className="adm-toolbar">
          <div className="adm-search adm-search--inline"><IconSearch size={16} /><input placeholder="Search by name or phone…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
        </div>
        <div className="adm-tabs">
          {STATUS_TABS.map((s) => (
            <button key={s.key} type="button" className={`adm-tab${status === s.key ? ' active' : ''}`} onClick={() => { setStatus(s.key); setPage(1); }}>
              {s.label} <span className="adm-tab-count">{counts[s.key] || 0}</span>
            </button>
          ))}
        </div>

        <div className="adm-table-scroll">
          <table className="adm-table">
            <thead><tr><th>Customer</th><th>Context</th><th>Requests</th><th>Last Requested</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6} className="adm-empty">Loading…</td></tr> : pageRows.length === 0 ? <tr><td colSpan={6} className="adm-empty">No call requests here.</td></tr> : pageRows.map((r) => (
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setModal({ row: r })}>
                  <td><div className="adm-lead-name">{r.name || 'WhatsApp customer'}</div><div className="adm-lead-sub">{r.phone}</div></td>
                  <td>{contextOf(r)}</td>
                  <td>{r.requestCount || 1}</td>
                  <td>{fmt(r.lastRequestedAt || r.createdAt)}</td>
                  <td><span className={`adm-status-pill${r.status === 'closed' ? ' active' : r.status === 'new' ? ' pending' : ' active'}`}>{STATUS_LABEL[r.status] || r.status}</span></td>
                  <td className="adm-row-actions">
                    <a className="adm-chip-btn" href={`tel:+${String(r.phone).replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}`} onClick={(e) => e.stopPropagation()}>Call</a>
                    {r.status === 'new' && <button className="adm-chip-btn" onClick={(e) => { e.stopPropagation(); patch(r.id, { status: 'called' }).then(() => flash('Marked Called')); }}>Mark Called</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageCount={pageCount} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>

      {modal?.row && <CallRequestModal row={modal.row} onClose={() => setModal(null)} onStatus={(s) => setStatusOf(modal.row, s)} onSaveNote={async (notes) => { const u = await patch(modal.row.id, { notes }); setModal({ row: u }); flash('Note saved'); }} />}
    </>
  );
}

function CallRequestModal({ row, onClose, onStatus, onSaveNote }) {
  const [notes, setNotes] = useState(row.notes || '');
  return (
    <Modal title={row.name || 'WhatsApp customer'} sub={`Call request ${row.id}`} onClose={onClose}>
      <div className="adm-detail-grid">
        <div><span className="adm-detail-label">Phone</span>{row.phone}</div>
        <div><span className="adm-detail-label">Status</span>{STATUS_LABEL[row.status] || row.status}</div>
        <div><span className="adm-detail-label">Context</span>{contextOf(row)}</div>
        <div><span className="adm-detail-label">Times asked</span>{row.requestCount || 1}</div>
        <div><span className="adm-detail-label">First requested</span>{fmt(row.createdAt)}</div>
        <div><span className="adm-detail-label">Last requested</span>{fmt(row.lastRequestedAt || row.createdAt)}</div>
      </div>

      <div style={{ marginTop: 14 }}>
        <span className="adm-detail-label">Notes</span>
        <textarea className="lf-input" rows={3} style={{ marginTop: 6 }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Called, wants a demo next week…" />
        {notes !== (row.notes || '') && <button className="adm-chip-btn" style={{ marginTop: 6 }} onClick={() => onSaveNote(notes)}>Save note</button>}
      </div>

      {(row.history || []).length > 0 && (
        <div style={{ marginTop: 14 }}>
          <span className="adm-detail-label">Activity</span>
          {[...row.history].reverse().map((h, i) => (
            <div key={i} className="adm-lead-sub" style={{ marginTop: 4 }}>{fmt(h.at)} — {h.event}{h.by ? ` (${h.by})` : ''}</div>
          ))}
        </div>
      )}

      <div className="lf-actions" style={{ marginTop: 18, flexWrap: 'wrap' }}>
        <a className="adm-btn-outline" style={{ whiteSpace: 'nowrap' }} href={`tel:+${String(row.phone).replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}`}><IconPhone size={15} /> Call</a>
        <a className="adm-btn-outline" style={{ whiteSpace: 'nowrap' }} href={waLink(row.phone)} target="_blank" rel="noreferrer">WhatsApp</a>
        {row.status !== 'new' && <button className="adm-chip-btn" onClick={() => onStatus('new')}>Reopen</button>}
        {row.status === 'new' && <button className="lf-btn-next" style={{ flex: '1 1 100%' }} onClick={() => onStatus('called')}>Mark as Called</button>}
        {row.status === 'called' && <button className="lf-btn-next" style={{ flex: '1 1 100%' }} onClick={() => onStatus('closed')}>Close request</button>}
      </div>
    </Modal>
  );
}
