'use client';
import { useEffect, useState, useMemo } from 'react';
import { PARTNER_CATEGORY, partnerCategoryLabel } from '@/lib/formOptions';
import { partnerStats, windowDelta } from '@/lib/adminMetrics';
import { StatCard, Pagination, Modal } from './ui';
import { IconSearch, IconPlus, IconDownload, IconPartners, IconLeads, IconConversions, IconEye } from './icons';
import { useApiResource } from '@/lib/useApiResource';

const PAGE_SIZE = 8;

export default function PartnersPage() {
  // Shared with every other Admin tab via useApiResource (lib/useApiResource.js) — see
  // DashboardPage.jsx for why.
  const { data: partners, loading: partnersLoading, refresh: refreshPartners } = useApiResource('/api/admin/partners');
  const { data: leads, loading: leadsLoading, refresh: refreshLeads } = useApiResource('/api/leads');
  const loading = partnersLoading || leadsLoading;
  const load = () => { refreshPartners(); refreshLeads(); };
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState('');

  function flash(msg) { setNotice(msg); setTimeout(() => setNotice(''), 3000); }

  async function toggleActive(p) {
    await fetch(`/api/admin/partners/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !(p.active !== false) }) });
    load();
  }

  const rows = useMemo(() => partners.map((p) => ({ ...p, stats: partnerStats(p, leads) })), [partners, leads]);
  const dNew = useMemo(() => windowDelta(partners, 'createdAt'), [partners]);
  const activeCount = partners.filter((p) => p.active !== false).length;
  const totalLeadsFromPartners = leads.filter((l) => l.partnerId).length;
  const convertedFromPartners = leads.filter((l) => l.partnerId && l.demoOutcome === 'converted').length;

  const filtered = useMemo(() => rows.filter((p) => {
    if (status === 'active' && p.active === false) return false;
    if (status === 'inactive' && p.active !== false) return false;
    if (category !== 'all' && p.type !== category) return false;
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      if (!(`${p.businessName} ${p.name} ${p.phone} ${p.city || ''}`.toLowerCase().includes(s))) return false;
    }
    return true;
  }), [rows, status, category, q]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function exportCsv() {
    const cols = ['id', 'businessName', 'name', 'phone', 'category', 'city', 'leads', 'converted', 'conversionRate', 'active'];
    const csv = [cols.join(','), ...filtered.map((p) => [p.id, p.businessName, p.name, p.phone, partnerCategoryLabel(p.type), p.city || '', p.stats.leadsCount, p.stats.converted, p.stats.conversionRate, p.active !== false].map((v) => `"${String(v ?? '')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'heseos-partners.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="adm-page-head">
        <div><h1 className="adm-h1">Partners</h1><p className="adm-page-sub">Manage your partners and track their performance</p></div>
        <div className="adm-page-head-actions">
          <button className="adm-btn-outline" onClick={exportCsv}><IconDownload size={15} /> Export Partners</button>
          <button className="adm-btn-primary" onClick={() => setModal({ type: 'add' })}><IconPlus size={15} /> Add Partner</button>
        </div>
      </div>

      {notice && <div className="adm-notice">{notice}</div>}

      <div className="adm-stat-row">
        <StatCard label="Total Partners" value={partners.length} delta={dNew.pct} Icon={IconPartners} tone="orange" />
        <StatCard label="Active Partners" value={activeCount} Icon={IconPartners} tone="green" />
        <StatCard label="Total Leads" value={totalLeadsFromPartners} Icon={IconLeads} tone="purple" />
        <StatCard label="Converted Leads" value={convertedFromPartners} Icon={IconConversions} tone="teal" />
      </div>

      <div className="adm-card">
        <div className="adm-toolbar">
          <div className="adm-search adm-search--inline"><IconSearch size={16} /><input placeholder="Search by partner name, shop, phone or city…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="all">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option>
          </select>
          <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
            <option value="all">All Categories</option>
            {PARTNER_CATEGORY.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
          </select>
        </div>

        <div className="adm-table-scroll">
          <table className="adm-table">
            <thead><tr><th>Partner Details</th><th>Category</th><th>City</th><th>Leads</th><th>Converted</th><th>Conv. Rate</th><th>Earnings</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={9} className="adm-empty">Loading…</td></tr> : pageRows.length === 0 ? <tr><td colSpan={9} className="adm-empty">No partners match these filters.</td></tr> : pageRows.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="adm-lead-name">{p.businessName || p.name}</div>
                    <div className="adm-lead-sub">{p.name} • {p.phone}</div>
                  </td>
                  <td>{partnerCategoryLabel(p.type)}</td>
                  <td>{p.city || '—'}</td>
                  <td>{p.stats.leadsCount}</td>
                  <td>{p.stats.converted}</td>
                  <td>{p.stats.conversionRate}%</td>
                  <td>₹{p.stats.earnings.toLocaleString('en-IN')}</td>
                  <td><span className={`adm-status-pill${p.active !== false ? ' active' : ''}`}>{p.active !== false ? 'Active' : 'Inactive'}</span></td>
                  <td className="adm-row-actions">
                    <button className="adm-icon-btn" onClick={() => setModal({ type: 'view', partner: p })}><IconEye size={16} /></button>
                    <button className="adm-chip-btn" onClick={() => toggleActive(p)}>{p.active !== false ? 'Deactivate' : 'Activate'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageCount={pageCount} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>

      {modal?.type === 'add' && <AddPartnerModal onClose={() => setModal(null)} onDone={() => { setModal(null); flash('Partner added'); load(); }} />}
      {modal?.type === 'view' && (
        <Modal title={modal.partner.businessName || modal.partner.name} sub={`${modal.partner.name} • ${modal.partner.phone}`} onClose={() => setModal(null)}>
          <div className="adm-detail-grid">
            <div><span className="adm-detail-label">Category</span>{partnerCategoryLabel(modal.partner.type)}</div>
            <div><span className="adm-detail-label">City</span>{modal.partner.city || '—'}</div>
            <div><span className="adm-detail-label">Leads Submitted</span>{modal.partner.stats.leadsCount}</div>
            <div><span className="adm-detail-label">Converted</span>{modal.partner.stats.converted}</div>
            <div><span className="adm-detail-label">Conversion Rate</span>{modal.partner.stats.conversionRate}%</div>
            <div><span className="adm-detail-label">Earnings</span>₹{modal.partner.stats.earnings.toLocaleString('en-IN')}</div>
          </div>
        </Modal>
      )}
    </>
  );
}

function AddPartnerModal({ onClose, onDone }) {
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [password, setPassword] = useState('');
  const [type, setType] = useState('electrical_shop');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [cities, setCities] = useState([]);
  const [citiesLoading, setCitiesLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/cities').then((r) => (r.ok ? r.json() : { cities: [] })).then((d) => setCities(d.cities || [])).finally(() => setCitiesLoading(false));
  }, []);

  async function submit() {
    setError(''); setSaving(true);
    try {
      const res = await fetch('/api/admin/partners', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, businessName, phone, password, type, city }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      onDone();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return (
    <Modal title="Add partner" sub="A distribution partner who can log leads via the partner app" onClose={onClose}>
      <div className="lf-field"><label className="lf-label">Contact name</label><input className="lf-input" value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="lf-field"><label className="lf-label">Business name</label><input className="lf-input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Shown on their dashboard" /></div>
      <div className="lf-field"><label className="lf-label">Phone (login)</label><input className="lf-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile number" /></div>
      <div className="lf-field">
        <label className="lf-label">City</label>
        {citiesLoading ? (
          <div className="adm-meta-hint">Loading cities…</div>
        ) : cities.length === 0 ? (
          <div className="adm-meta-hint">No cities set up yet — add some from Admin → Settings → Cities first.</div>
        ) : (
          <select className="lf-input" value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="">Select city…</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>
      <div className="lf-field"><label className="lf-label">Temporary password</label><input className="lf-input" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      <div className="lf-field">
        <label className="lf-label">Category</label>
        <div className="lf-pills cols-3">
          {PARTNER_CATEGORY.map((c) => <button key={c.v} type="button" className={`lf-pill${type === c.v ? ' active' : ''}`} onClick={() => setType(c.v)}>{c.l}</button>)}
        </div>
      </div>
      {error && <div className="lf-error">{error}</div>}
      <div className="lf-actions">
        <button className="lf-btn-back" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="lf-btn-next" onClick={submit} disabled={saving || !name || !phone || !password}>{saving ? 'Saving…' : 'Create'}</button>
      </div>
    </Modal>
  );
}
