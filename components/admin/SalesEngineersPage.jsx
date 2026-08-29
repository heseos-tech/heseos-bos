'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { EMPLOYEE_ROLES } from '@/lib/formOptions';
import { engineerStats, performanceTag, windowDelta } from '@/lib/adminMetrics';
import { StatCard, Pagination, PerformanceTag, Modal } from './ui';
import { IconSearch, IconPlus, IconDownload, IconSalesEngineer, IconDemo, IconQuotation, IconConversions } from './icons';

const PAGE_SIZE = 8;

export default function SalesEngineersPage() {
  const [employees, setEmployees] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const [e, l] = await Promise.all([
      fetch('/api/admin/employees').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/leads').then((r) => (r.ok ? r.json() : [])),
    ]);
    setEmployees(e.filter((x) => x.role === 'sales_engineer')); setLeads(l); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  function flash(msg) { setNotice(msg); setTimeout(() => setNotice(''), 3000); }
  async function toggleActive(e) {
    await fetch(`/api/admin/employees/${e.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !(e.active !== false) }) });
    load();
  }

  const rows = useMemo(() => employees.map((e) => ({ ...e, stats: engineerStats(e, leads) })), [employees, leads]);
  const dNew = useMemo(() => windowDelta(employees, 'createdAt'), [employees]);
  const activeCount = employees.filter((e) => e.active !== false).length;
  const demosThisWeek = rows.reduce((s, r) => s + r.stats.demosThisWeek, 0);
  const totalQuotations = rows.reduce((s, r) => s + r.stats.quotationsSent, 0);
  const totalConversions = rows.reduce((s, r) => s + r.stats.conversions, 0);

  const filtered = useMemo(() => rows.filter((e) => {
    if (status === 'active' && e.active === false) return false;
    if (status === 'inactive' && e.active !== false) return false;
    if (q.trim() && !(`${e.name} ${e.email} ${e.location || ''}`.toLowerCase().includes(q.trim().toLowerCase()))) return false;
    return true;
  }), [rows, status, q]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function exportCsv() {
    const cols = ['name', 'email', 'location', 'assigned', 'demosDone', 'quotationsSent', 'conversions', 'conversionRate'];
    const csv = [cols.join(','), ...filtered.map((e) => [e.name, e.email, e.location || '', e.stats.assigned, e.stats.demosDone, e.stats.quotationsSent, e.stats.conversions, e.stats.conversionRate].map((v) => `"${String(v ?? '')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'heseos-sales-engineers.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="adm-page-head">
        <div><h1 className="adm-h1">Sales Engineers</h1><p className="adm-page-sub">Manage your sales team and track their performance</p></div>
        <div className="adm-page-head-actions">
          <button className="adm-btn-outline" onClick={exportCsv}><IconDownload size={15} /> Export</button>
          <button className="adm-btn-primary" onClick={() => setModal({ type: 'add' })}><IconPlus size={15} /> Add Sales Engineer</button>
        </div>
      </div>

      {notice && <div className="adm-notice">{notice}</div>}

      <div className="adm-stat-row">
        <StatCard label="Total Sales Engineers" value={employees.length} delta={dNew.pct} Icon={IconSalesEngineer} tone="orange" />
        <StatCard label="Active" value={activeCount} Icon={IconSalesEngineer} tone="green" />
        <StatCard label="Demos This Week" value={demosThisWeek} Icon={IconDemo} tone="purple" />
        <StatCard label="Quotations Sent" value={totalQuotations} Icon={IconQuotation} tone="teal" />
        <StatCard label="Conversions" value={totalConversions} Icon={IconConversions} tone="blue" />
      </div>

      <div className="adm-card">
        <div className="adm-toolbar">
          <div className="adm-search adm-search--inline"><IconSearch size={16} /><input placeholder="Search by name, email or location…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="all">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="adm-table-scroll">
          <table className="adm-table">
            <thead><tr><th>Engineer Details</th><th>Location</th><th>Assigned Leads</th><th>Demos Done</th><th>Quotations Sent</th><th>Conversions</th><th>Conv. Rate</th><th>Performance</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={10} className="adm-empty">Loading…</td></tr> : pageRows.length === 0 ? <tr><td colSpan={10} className="adm-empty">No sales engineers yet.</td></tr> : pageRows.map((e) => (
                <tr key={e.id}>
                  <td><div className="adm-lead-name">{e.name}</div><div className="adm-lead-sub">{e.phone || e.email}</div></td>
                  <td>{e.location || '—'}</td>
                  <td>{e.stats.assigned}</td>
                  <td>{e.stats.demosDone}</td>
                  <td>{e.stats.quotationsSent}</td>
                  <td>{e.stats.conversions}</td>
                  <td>{e.stats.conversionRate}%</td>
                  <td><PerformanceTag tag={performanceTag(e.stats.conversionRate)} /></td>
                  <td><span className={`adm-status-pill${e.active !== false ? ' active' : ''}`}>{e.active !== false ? 'Active' : 'Inactive'}</span></td>
                  <td className="adm-row-actions"><button className="adm-chip-btn" onClick={() => toggleActive(e)}>{e.active !== false ? 'Deactivate' : 'Activate'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageCount={pageCount} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>

      {modal?.type === 'add' && <AddEmployeeModal role="sales_engineer" title="Add sales engineer" onClose={() => setModal(null)} onDone={() => { setModal(null); flash('Sales engineer added'); load(); }} />}
    </>
  );
}

// City covered by this employee: sales engineers (and partners) pick exactly ONE city — they
// physically visit. Pre-sales can cover several specific cities, or every city ("All Cities"),
// since they're working the phones, not driving out. Both pull their options from the
// admin-controlled list at Admin -> Settings -> Cities (see lib/cities.js) — so only cities the
// business actually operates in are selectable, which is also what makes city-based
// auto-assignment (lib/leadAssign.js) reliable.
export function AddEmployeeModal({ role, title, onClose, onDone }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');           // sales_engineer: single city
  const [citySelections, setCitySelections] = useState([]); // presales: multiple cities
  const [allCities, setAllCities] = useState(false);        // presales: "All Cities" toggle
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [cities, setCities] = useState([]);
  const [citiesLoading, setCitiesLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/cities').then((r) => (r.ok ? r.json() : { cities: [] })).then((d) => setCities(d.cities || [])).finally(() => setCitiesLoading(false));
  }, []);

  function toggleCity(c) {
    setCitySelections((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  const cityValid = role === 'presales' ? (allCities || citySelections.length > 0) : !!location;

  async function submit() {
    setError(''); setSaving(true);
    try {
      const body = { name, email, password, role, phone };
      if (role === 'presales') body.cities = allCities ? ['ALL'] : citySelections;
      else body.location = location;
      const res = await fetch('/api/admin/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      onDone();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return (
    <Modal title={title} sub="Creates a login for the employee portal" onClose={onClose}>
      <div className="lf-field"><label className="lf-label">Full name</label><input className="lf-input" value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="lf-field"><label className="lf-label">Email</label><input className="lf-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div className="lf-field"><label className="lf-label">Phone</label><input className="lf-input" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>

      {role === 'presales' ? (
        <div className="lf-field">
          <label className="lf-label">Cities covered</label>
          {citiesLoading ? (
            <div className="adm-meta-hint">Loading cities…</div>
          ) : cities.length === 0 ? (
            <div className="adm-meta-hint">No cities set up yet — add some from Admin → Settings → Cities first.</div>
          ) : (
            <>
              <div className="lf-pills cols-1">
                <button type="button" className={`lf-pill${allCities ? ' active' : ''}`} onClick={() => setAllCities((v) => !v)}>All Cities</button>
              </div>
              {!allCities && (
                <div className="lf-pills cols-3" style={{ marginTop: 8 }}>
                  {cities.map((c) => (
                    <button key={c} type="button" className={`lf-pill${citySelections.includes(c) ? ' active' : ''}`} onClick={() => toggleCity(c)}>{c}</button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="lf-field">
          <label className="lf-label">City</label>
          {citiesLoading ? (
            <div className="adm-meta-hint">Loading cities…</div>
          ) : cities.length === 0 ? (
            <div className="adm-meta-hint">No cities set up yet — add some from Admin → Settings → Cities first.</div>
          ) : (
            <select className="lf-input" value={location} onChange={(e) => setLocation(e.target.value)}>
              <option value="">Select city…</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>
      )}

      <div className="lf-field"><label className="lf-label">Temporary password</label><input className="lf-input" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      {error && <div className="lf-error">{error}</div>}
      <div className="lf-actions">
        <button className="lf-btn-back" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="lf-btn-next" onClick={submit} disabled={saving || !name || !email || !password || !cityValid}>{saving ? 'Saving…' : 'Create'}</button>
      </div>
    </Modal>
  );
}
