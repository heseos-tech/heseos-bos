'use client';
import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { fmtDate } from '@/lib/date';
import { LEAD_SOURCES, PROPERTY_TYPE } from '@/lib/formOptions';
import { isQrKind } from '@/lib/attributionConstants';
import { adminStatus, leadBucket, nextAction, LEAD_BUCKETS } from '@/lib/adminMetrics';
import { StatusBadge, Pagination, Modal, StatCard } from './ui';
import { IconSearch, IconFilter, IconPlus, IconChevronDown, IconMore, IconUpload, IconDownload, IconEye, IconLeads, IconDemo, IconQuotation, IconConversions, IconRefresh } from './icons';
import { useApiResource } from '@/lib/useApiResource';

const PT_LABEL = Object.fromEntries(PROPERTY_TYPE.map((p) => [p.v, p.l]));
const PAGE_SIZE = 10;

export default function LeadsPage() {
  const searchParams = useSearchParams();
  // Shared with every other Admin tab via useApiResource (lib/useApiResource.js) — see
  // DashboardPage.jsx for why.
  const { data: leads, loading: leadsLoading, refresh: refreshLeads } = useApiResource('/api/leads');
  const { data: partners, loading: partnersLoading, refresh: refreshPartners } = useApiResource('/api/admin/partners');
  const { data: employees, loading: employeesLoading, refresh: refreshEmployees } = useApiResource('/api/admin/employees');
  // Only needed to resolve a "QR — Location" link's own label (e.g. "Viman Nagar") for the
  // Partner column below — see attributionInfo(). Growth's own table already fetches this same
  // endpoint for the identical reason.
  const { data: attributionLinks, loading: attributionLoading } = useApiResource('/api/admin/attribution');
  const loading = leadsLoading || partnersLoading || employeesLoading || attributionLoading;
  const [q, setQ] = useState('');
  const [source, setSource] = useState('all');
  const [partnerId, setPartnerId] = useState('all');
  const [engineerId, setEngineerId] = useState('all');
  const [bucket, setBucket] = useState(searchParams.get('bucket') || 'all');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null); // { type: 'view'|'add', lead? }
  const [menuFor, setMenuFor] = useState(null);
  const [notice, setNotice] = useState('');
  const [syncing, setSyncing] = useState(false);

  // The Leads tab now stays mounted after the first visit (see AdminHome), so a fresh
  // navigation here — e.g. a Dashboard quick-tile linking to ?tab=leads&bucket=demo — no
  // longer remounts this component. Without this, the bucket filter above (set once from the
  // URL at mount) would never pick up a later change. React to it explicitly instead.
  useEffect(() => {
    const b = searchParams.get('bucket');
    if (b) setBucket(b);
  }, [searchParams]);

  // Mutations below call this instead of the old full re-fetch — it just re-pulls the three
  // already-cached resources, so every other mounted Admin tab watching the same URLs (e.g.
  // Dashboard, Pre-sales, Sales Engineers) picks up the change too, not just this tab.
  const load = () => { refreshLeads(); refreshPartners(); refreshEmployees(); };

  const partnerName = (id) => partners.find((p) => p.id === id)?.businessName || '—';

  // Source column: QR Code (Partner)/(Location) collapse to "QR", Referral Link
  // (Partner)/(Customer) collapse to "Referral" — the Partner/Location/Customer distinction
  // moves into the Partner column instead (attributionInfo below), same pattern used on the
  // Growth admin table's Kind column.
  const sourceLabel = (l) => {
    if (isQrKind(l.source)) return 'QR';
    if (l.source === 'referral_partner' || l.source === 'referral_customer') return 'Referral Link';
    return LEAD_SOURCES[l.source] || l.source;
  };

  // Source filter dropdown: same QR/Referral collapse as sourceLabel above, so the filter
  // options match what the column actually shows. 'qr' and 'referral' here are synthetic
  // filter values (not real source keys) — the filter predicate below expands each to the
  // pair of real kinds it covers.
  const SOURCE_FILTER_OPTIONS = Object.entries(LEAD_SOURCES)
    .filter(([k]) => !['qr_partner', 'qr_location', 'referral_partner', 'referral_customer'].includes(k))
    .map(([k, l]) => ({ v: k, l }))
    .concat([{ v: 'qr', l: 'QR' }, { v: 'referral', l: 'Referral Link' }]);

  const linkById = useMemo(
    () => Object.fromEntries((attributionLinks || []).map((link) => [link.id, link])),
    [attributionLinks]
  );

  // Partner column: same name-on-top / type-tag-below style as the Growth admin table's
  // "Partner / Location" column — {name, tag}. Partner App / QR — Partner / Referral —
  // Partner all resolve to the actual partner's name tagged "Partner"; a placement QR
  // resolves to that link's own label (e.g. "Viman Nagar") tagged "Location"; a customer
  // referral link resolves to the referring customer's name (looked up in this same leads
  // list) tagged "Referred"; everything else — no partner/location/referral attribution at
  // all — is plain "Direct" with no second line.
  const attributionInfo = (l) => {
    if (l.partnerId) return { name: partnerName(l.partnerId), tag: 'Partner' };
    if (l.attributionKind === 'qr_location') {
      const link = l.attributionLinkId ? linkById[l.attributionLinkId] : null;
      return { name: (link && link.label) || 'Location', tag: 'Location' };
    }
    if (l.attributionKind === 'referral_customer') {
      const ref = leads.find((x) => x.id === l.referredByLeadId);
      return { name: ref ? ref.name : 'A customer', tag: 'Referred' };
    }
    return { name: 'Direct', tag: null };
  };
  const engineerName = (id) => employees.find((e) => e.id === id)?.name || 'Unassigned';
  const presalesTeam = employees.filter((e) => e.role === 'presales');
  const engineers = employees.filter((e) => e.role === 'sales_engineer');

  const counts = useMemo(() => {
    const c = { all: leads.length };
    for (const b of LEAD_BUCKETS) if (b.key !== 'all') c[b.key] = 0;
    for (const l of leads) c[leadBucket(l)] = (c[leadBucket(l)] || 0) + 1;
    return c;
  }, [leads]);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (bucket !== 'all' && leadBucket(l) !== bucket) return false;
      if (source !== 'all') {
        const s = l.source || 'manual_entry';
        if (source === 'qr') { if (!isQrKind(s)) return false; }
        else if (source === 'referral') { if (s !== 'referral_partner' && s !== 'referral_customer') return false; }
        else if (s !== source) return false;
      }
      if (partnerId !== 'all' && l.partnerId !== partnerId) return false;
      if (engineerId !== 'all' && l.salesEngineerId !== engineerId) return false;
      if (q.trim()) {
        const s = q.trim().toLowerCase();
        if (!(`${l.name} ${l.phone} ${l.city} ${partnerName(l.partnerId)}`.toLowerCase().includes(s))) return false;
      }
      return true;
    });
  }, [leads, bucket, source, partnerId, engineerId, q, partners]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function resetFilters() { setQ(''); setSource('all'); setPartnerId('all'); setEngineerId('all'); setBucket('all'); setPage(1); }
  function flash(msg) { setNotice(msg); setTimeout(() => setNotice(''), 3000); }

  // Small sync icon next to the page title — pulls in anything Meta's webhook missed, without
  // sending anyone to Settings. Same underlying sync as the "Sync Leads Now" button there
  // (and the one on the Pre-sales panel) — see app/api/leads/sync/route.js.
  async function syncFromMeta() {
    setSyncing(true);
    try {
      const res = await fetch('/api/leads/sync', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { flash(data.error || 'Could not sync leads from Meta.'); return; }
      flash(data.inserted > 0 ? `Synced — ${data.inserted} new lead${data.inserted === 1 ? '' : 's'} pulled in` : 'Synced — nothing new, already up to date');
      load();
    } finally { setSyncing(false); }
  }

  async function markQuotationSent(lead) {
    await fetch(`/api/leads/${lead.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'quotation' }) });
    setMenuFor(null); flash(`Quotation marked sent for ${lead.name}`); load();
  }
  async function assignEngineer(lead, id) {
    await fetch(`/api/leads/${lead.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'assign', salesEngineerId: id || null }) });
    setMenuFor(null); flash(`Sales engineer updated for ${lead.name}`); load();
  }
  async function assignPresales(lead, id) {
    await fetch(`/api/leads/${lead.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'assign', assignedTo: id || null }) });
    setMenuFor(null); flash(`Pre-sales owner updated for ${lead.name}`); load();
  }

  function exportCsv() {
    const cols = ['id', 'name', 'phone', 'city', 'propertyType', 'source', 'status', 'salesEngineer', 'createdAt'];
    const rows = filtered.map((l) => [l.id, l.name, l.phone, l.city, PT_LABEL[l.propertyType] || l.propertyType, LEAD_SOURCES[l.source] || l.source, adminStatus(l).label, engineerName(l.salesEngineerId), l.createdAt]);
    const csv = [cols.join(','), ...rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `heseos-leads-${fmtDate(new Date())}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="adm-page-head">
        <div>
          <h1 className="adm-h1">Leads</h1>
          <p className="adm-page-sub">Manage and track all leads from different sources</p>
        </div>
        <div className="adm-page-head-actions">
          <button className={`adm-icon-btn${syncing ? ' adm-spinning' : ''}`} title="Sync leads from Meta" onClick={syncFromMeta} disabled={syncing}><IconRefresh size={17} /></button>
          <button className="adm-btn-outline" onClick={() => flash('CSV import is coming soon — for now, leads flow in automatically from the website, WhatsApp, Meta ads and the partner app.')}><IconUpload size={15} /> Import Leads</button>
          <button className="adm-btn-outline" onClick={exportCsv}><IconDownload size={15} /> Export</button>
          <button className="adm-btn-primary" onClick={() => setModal({ type: 'add' })}><IconPlus size={15} /> Add Lead</button>
        </div>
      </div>

      {notice && <div className="adm-notice">{notice}</div>}

      <div className="adm-stat-row">
        <StatCard label="Total Leads" value={counts.all} Icon={IconLeads} tone="orange" />
        <StatCard label="New Leads" value={counts.new || 0} Icon={IconLeads} tone="blue" />
        <StatCard label="In Progress" value={counts.in_progress || 0} Icon={IconDemo} tone="purple" />
        <StatCard label="Demo Scheduled" value={counts.demo || 0} Icon={IconDemo} tone="teal" />
        <StatCard label="Converted" value={counts.converted || 0} Icon={IconConversions} tone="green" />
      </div>

      <div className="adm-card">
        <div className="adm-toolbar">
          <div className="adm-search adm-search--inline"><IconSearch size={16} /><input placeholder="Search by name, mobile number, location, partner…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
          <select value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }}>
            <option value="all">All Sources</option>
            {SOURCE_FILTER_OPTIONS.map(({ v, l }) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={partnerId} onChange={(e) => { setPartnerId(e.target.value); setPage(1); }}>
            <option value="all">All Partners</option>
            {partners.map((p) => <option key={p.id} value={p.id}>{p.businessName || p.name}</option>)}
          </select>
          <select value={engineerId} onChange={(e) => { setEngineerId(e.target.value); setPage(1); }}>
            <option value="all">All Engineers</option>
            {engineers.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <button className="adm-btn-outline" onClick={resetFilters}><IconFilter size={14} /> Clear Filters</button>
        </div>

        <div className="adm-tabs">
          {LEAD_BUCKETS.map((b) => (
            <button key={b.key} className={`adm-tab${bucket === b.key ? ' active' : ''}`} onClick={() => { setBucket(b.key); setPage(1); }}>
              {b.label} <span className="adm-tab-count">{counts[b.key] || 0}</span>
            </button>
          ))}
        </div>

        <div className="adm-table-scroll">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Lead Details</th><th>Source</th><th>Partner/Location</th><th>Status</th><th>Sales Engineer</th><th>Next Action</th><th>Created On</th><th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="adm-empty">Loading…</td></tr>
              ) : pageRows.length === 0 ? (
                <tr><td colSpan={8} className="adm-empty">No leads match these filters.</td></tr>
              ) : pageRows.map((l) => {
                const status = adminStatus(l);
                const action = nextAction(l);
                const attr = attributionInfo(l);
                return (
                  <tr key={l.id}>
                    <td>
                      <div className="adm-lead-name">{l.name}</div>
                      <div className="adm-lead-sub">{l.phone} • {l.city}{l.propertyType ? ` • ${PT_LABEL[l.propertyType] || l.propertyType}` : ''}</div>
                    </td>
                    <td>{sourceLabel(l)}</td>
                    <td>
                      <div className="adm-lead-name">{attr.name}</div>
                      {attr.tag && <div className="adm-lead-sub">{attr.tag}</div>}
                    </td>
                    <td><StatusBadge status={status} /></td>
                    <td>{engineerName(l.salesEngineerId)}</td>
                    <td>{action.label}</td>
                    <td>{fmtDate(l.createdAt)}</td>
                    <td className="adm-row-actions">
                      <div className="adm-row-actions-inner">
                        <button className="adm-icon-btn" onClick={() => setModal({ type: 'view', lead: l })}><IconEye size={16} /></button>
                        <div className="adm-menu-wrap">
                          <button className="adm-icon-btn" onClick={() => setMenuFor(menuFor === l.id ? null : l.id)}><IconMore size={16} /></button>
                          {menuFor === l.id && (
                            <div className="adm-menu" onClick={(e) => e.stopPropagation()}>
                              {l.demoScheduledAt && !l.quotationSentAt && <button onClick={() => markQuotationSent(l)}>Mark Quotation Sent</button>}
                              <div className="adm-menu-label">Assign Sales Engineer</div>
                              {engineers.map((e) => <button key={e.id} onClick={() => assignEngineer(l, e.id)}>{e.name}</button>)}
                              <div className="adm-menu-label">Assign Pre-sales</div>
                              {presalesTeam.map((e) => <button key={e.id} onClick={() => assignPresales(l, e.id)}>{e.name}</button>)}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <Pagination page={page} pageCount={pageCount} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>

      {modal?.type === 'view' && <ViewLeadModal lead={modal.lead} partnerName={partnerName(modal.lead.partnerId)} engineerName={engineerName(modal.lead.salesEngineerId)} onClose={() => setModal(null)} />}
      {modal?.type === 'add' && <AddLeadModal onClose={() => setModal(null)} onDone={() => { setModal(null); flash('Lead added'); load(); }} />}
    </>
  );
}

function ViewLeadModal({ lead, partnerName, engineerName, onClose }) {
  const status = adminStatus(lead);
  return (
    <Modal title={lead.name} sub={`${lead.phone} • ${lead.city}`} onClose={onClose}>
      <div className="adm-detail-grid">
        <div><span className="adm-detail-label">Status</span><StatusBadge status={status} /></div>
        <div><span className="adm-detail-label">Source</span>{LEAD_SOURCES[lead.source] || lead.source}</div>
        <div><span className="adm-detail-label">Partner</span>{partnerName}</div>
        <div><span className="adm-detail-label">Sales Engineer</span>{engineerName}</div>
        <div><span className="adm-detail-label">Property Type</span>{PT_LABEL[lead.propertyType] || '—'}</div>
        <div><span className="adm-detail-label">Budget</span>{lead.budget || '—'}</div>
        <div>
          <span className="adm-detail-label">Quotation</span>
          {lead.quotationAmount != null ? `₹${lead.quotationAmount}${(lead.quotationRevisions?.length || 0) > 1 ? ` (rev ${lead.quotationRevisions.length})` : ''}` : '—'}
        </div>
        <div><span className="adm-detail-label">Final Price</span>{lead.finalPrice != null ? `₹${lead.finalPrice}` : '—'}</div>
      </div>
      {(lead.quotationRevisions?.length || 0) > 1 && (
        <>
          <div className="adm-detail-label" style={{ marginTop: 16 }}>Quotation Revisions</div>
          <div className="adm-timeline">
            {lead.quotationRevisions.slice().reverse().map((r) => (
              <div className="adm-timeline-row" key={r.revision}>
                <span className="adm-timeline-dot" />
                <div>
                  <div className="adm-timeline-event">v{r.revision} · {r.amount != null ? `₹${r.amount}` : 'no amount'}</div>
                  <div className="adm-timeline-meta">{r.by} — {new Date(r.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</div>
                  {r.note && <div className="adm-timeline-meta">{r.note}</div>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {lead.notes && <p className="adm-detail-notes">{lead.notes}</p>}
      <div className="adm-detail-label" style={{ marginTop: 16 }}>Timeline</div>
      <div className="adm-timeline">
        {(lead.history || []).slice().reverse().map((h, i) => (
          <div className="adm-timeline-row" key={i}>
            <span className="adm-timeline-dot" />
            <div>
              <div className="adm-timeline-event">{h.event}</div>
              <div className="adm-timeline-meta">{h.by} — {new Date(h.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</div>
            </div>
          </div>
        ))}
        {(!lead.history || lead.history.length === 0) && <div className="adm-empty">No activity logged yet.</div>}
      </div>
    </Modal>
  );
}

function AddLeadModal({ onClose, onDone }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError(''); setSaving(true);
    try {
      const res = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, phone, city, propertyType, source: 'manual_entry' }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add lead');
      onDone();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return (
    <Modal title="Add lead" sub="Manually log a lead into the pipeline" onClose={onClose}>
      <div className="lf-field"><label className="lf-label">Full name</label><input className="lf-input" value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="lf-field"><label className="lf-label">Mobile number</label><input className="lf-input" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      <div className="lf-field"><label className="lf-label">City</label><input className="lf-input" value={city} onChange={(e) => setCity(e.target.value)} /></div>
      <div className="lf-field">
        <label className="lf-label">Property Type</label>
        <select className="lf-input" value={propertyType} onChange={(e) => setPropertyType(e.target.value)}>
          <option value="">Select</option>
          {PROPERTY_TYPE.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
        </select>
      </div>
      {error && <div className="lf-error">{error}</div>}
      <div className="lf-actions">
        <button className="lf-btn-back" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="lf-btn-next" onClick={submit} disabled={saving || !name || !phone || !city}>{saving ? 'Saving…' : 'Add Lead'}</button>
      </div>
    </Modal>
  );
}
