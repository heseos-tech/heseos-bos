'use client';
import { useState, useMemo } from 'react';
import { presalesStats, performanceTag, windowDelta } from '@/lib/adminMetrics';
import { StatCard, Pagination, PerformanceTag } from './ui';
import { IconSearch, IconPlus, IconDownload, IconPresales, IconLeads, IconDemo, IconConversions } from './icons';
import { AddEmployeeModal } from './SalesEngineersPage';
import { useApiResource } from '@/lib/useApiResource';

const PAGE_SIZE = 8;

export default function PresalesPage() {
  // Shared with every other Admin tab via useApiResource (lib/useApiResource.js) — see
  // DashboardPage.jsx for why.
  const { data: allEmployees, loading: employeesLoading, refresh: refreshEmployees } = useApiResource('/api/admin/employees');
  const { data: leads, loading: leadsLoading, refresh: refreshLeads } = useApiResource('/api/leads');
  const employees = useMemo(() => allEmployees.filter((x) => x.role === 'presales'), [allEmployees]);
  const loading = employeesLoading || leadsLoading;
  const load = () => { refreshEmployees(); refreshLeads(); };
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState('');

  function flash(msg) { setNotice(msg); setTimeout(() => setNotice(''), 3000); }
  async function toggleActive(e) {
    await fetch(`/api/admin/employees/${e.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !(e.active !== false) }) });
    load();
  }

  const rows = useMemo(() => employees.map((e) => ({ ...e, stats: presalesStats(e, leads) })), [employees, leads]);
  const dNew = useMemo(() => windowDelta(employees, 'createdAt'), [employees]);
  const activeCount = employees.filter((e) => e.active !== false).length;
  const callsMade = rows.reduce((s, r) => s + r.stats.callsMade, 0);
  const demosScheduled = rows.reduce((s, r) => s + r.stats.demosScheduled, 0);
  const conversions = rows.reduce((s, r) => s + r.stats.conversions, 0);

  const filtered = useMemo(() => rows.filter((e) => {
    if (status === 'active' && e.active === false) return false;
    if (status === 'inactive' && e.active !== false) return false;
    if (q.trim() && !(`${e.name} ${e.email} ${e.location || ''}`.toLowerCase().includes(q.trim().toLowerCase()))) return false;
    return true;
  }), [rows, status, q]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function exportCsv() {
    const cols = ['name', 'email', 'location', 'assigned', 'callsMade', 'demosScheduled', 'demosCompleted', 'conversions', 'conversionRate'];
    const csv = [cols.join(','), ...filtered.map((e) => [e.name, e.email, e.location || '', e.stats.assigned, e.stats.callsMade, e.stats.demosScheduled, e.stats.demosCompleted, e.stats.conversions, e.stats.conversionRate].map((v) => `"${String(v ?? '')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'heseos-presales.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="adm-page-head">
        <div><h1 className="adm-h1">Pre-sales</h1><p className="adm-page-sub">Manage your pre-sales team and track their performance</p></div>
        <div className="adm-page-head-actions">
          <button className="adm-btn-outline" onClick={exportCsv}><IconDownload size={15} /> Export</button>
          <button className="adm-btn-primary" onClick={() => setModal({ type: 'add' })}><IconPlus size={15} /> Add Pre-sales</button>
        </div>
      </div>

      {notice && <div className="adm-notice">{notice}</div>}

      <div className="adm-stat-row">
        <StatCard label="Total Pre-sales" value={employees.length} delta={dNew.pct} Icon={IconPresales} tone="orange" />
        <StatCard label="Active" value={activeCount} Icon={IconPresales} tone="green" />
        <StatCard label="Calls Made" value={callsMade} Icon={IconPresales} tone="blue" />
        <StatCard label="Demos Scheduled" value={demosScheduled} Icon={IconDemo} tone="purple" />
        <StatCard label="Conversions" value={conversions} Icon={IconConversions} tone="teal" />
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
            <thead><tr><th>Pre-sales Details</th><th>Location</th><th>Assigned Leads</th><th>Calls Made</th><th>Demos Scheduled</th><th>Demos Completed</th><th>Conv. Rate</th><th>Performance</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={10} className="adm-empty">Loading…</td></tr> : pageRows.length === 0 ? <tr><td colSpan={10} className="adm-empty">No pre-sales team members yet.</td></tr> : pageRows.map((e) => (
                <tr key={e.id}>
                  <td><div className="adm-lead-name">{e.name}</div><div className="adm-lead-sub">{e.phone || e.email}</div></td>
                  <td>{e.location || '—'}</td>
                  <td>{e.stats.assigned}</td>
                  <td>{e.stats.callsMade}</td>
                  <td>{e.stats.demosScheduled}</td>
                  <td>{e.stats.demosCompleted}</td>
                  <td>{e.stats.conversionRate}%</td>
                  <td><PerformanceTag tag={performanceTag(e.stats.conversionRate)} /></td>
                  <td><span className={`adm-status-pill${e.active !== false ? ' active' : ''}`}>{e.active !== false ? 'Active' : 'Inactive'}</span></td>
                  <td className="adm-row-actions"><div className="adm-row-actions-inner"><button className="adm-chip-btn" onClick={() => toggleActive(e)}>{e.active !== false ? 'Deactivate' : 'Activate'}</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageCount={pageCount} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>

      {modal?.type === 'add' && <AddEmployeeModal role="presales" title="Add pre-sales executive" onClose={() => setModal(null)} onDone={() => { setModal(null); flash('Pre-sales executive added'); load(); }} />}
    </>
  );
}
