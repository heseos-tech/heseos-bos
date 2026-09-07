'use client';
import { useMemo, useState } from 'react';
import { windowDelta } from '@/lib/adminMetrics';
import { StatCard, Pagination } from './ui';
import { AddEmployeeModal } from './SalesEngineersPage';
import { IconSearch, IconPlus, IconDownload, IconEmployees, IconPresales, IconSalesEngineer } from './icons';
import { useApiResource } from '@/lib/useApiResource';

const PAGE_SIZE = 8;

// Labels for every role an employee can hold. 'admin' employees exist in the data model
// (lib/formOptions.js EMPLOYEE_ROLES) but are created directly in the database, not through
// this form — this tab only offers Pre-Sales / Sales Engineer in its Role picker (see
// AddEmployeeModal in SalesEngineersPage.jsx), since those are the two roles that get
// auto-filtered into their own tabs below.
const ROLE_LABEL = { presales: 'Pre-Sales', sales_engineer: 'Sales Engineer', admin: 'Super Admin' };

// The single place every employee gets created, whatever their role. Saving here writes one
// record (app/api/admin/employees/route.js) with an auto-generated employee ID; the Sales
// Engineers and Pre-sales tabs both read from the SAME /api/admin/employees list and simply
// filter it by role — so an employee saved here with role=sales_engineer or role=presales
// shows up on the matching tab automatically, with no separate "Add" step there. That's why
// those two tabs no longer have their own Add button.
export default function EmployeesPage() {
  // Shared with every other Admin tab via useApiResource (lib/useApiResource.js) — see
  // DashboardPage.jsx for why.
  const { data: employees, loading, refresh } = useApiResource('/api/admin/employees', { pollMs: 20000 });
  const [q, setQ] = useState('');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState('');

  function flash(msg) { setNotice(msg); setTimeout(() => setNotice(''), 3000); }
  async function toggleActive(e) {
    await fetch(`/api/admin/employees/${e.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !(e.active !== false) }) });
    refresh();
  }

  const dNew = useMemo(() => windowDelta(employees, 'createdAt'), [employees]);
  const activeCount = employees.filter((e) => e.active !== false).length;
  const presalesCount = employees.filter((e) => e.role === 'presales').length;
  const engineerCount = employees.filter((e) => e.role === 'sales_engineer').length;

  const filtered = useMemo(() => employees.filter((e) => {
    if (role !== 'all' && e.role !== role) return false;
    if (status === 'active' && e.active === false) return false;
    if (status === 'inactive' && e.active !== false) return false;
    if (q.trim() && !(`${e.name} ${e.email} ${e.id} ${e.location || ''}`.toLowerCase().includes(q.trim().toLowerCase()))) return false;
    return true;
  }), [employees, role, status, q]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function exportCsv() {
    const cols = ['id', 'name', 'email', 'role', 'location', 'active'];
    const csv = [cols.join(','), ...filtered.map((e) => [e.id, e.name, e.email, ROLE_LABEL[e.role] || e.role, e.location || (Array.isArray(e.cities) ? e.cities.join('; ') : ''), e.active !== false ? 'Active' : 'Inactive'].map((v) => `"${String(v ?? '')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'heseos-employees.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="adm-page-head">
        <div><h1 className="adm-h1">Employees</h1><p className="adm-page-sub">Add any Heseos employee here — their role decides which tab (Sales Engineers, Pre-sales) they show up under, and lets them log in to the Team app</p></div>
        <div className="adm-page-head-actions">
          <button className="adm-btn-outline" onClick={exportCsv}><IconDownload size={15} /> Export</button>
          <button className="adm-btn-primary" onClick={() => setModal({ type: 'add' })}><IconPlus size={15} /> Add Employee</button>
        </div>
      </div>

      {notice && <div className="adm-notice">{notice}</div>}

      <div className="adm-stat-row">
        <StatCard label="Total Employees" value={employees.length} delta={dNew.pct} Icon={IconEmployees} tone="orange" />
        <StatCard label="Active" value={activeCount} Icon={IconEmployees} tone="green" />
        <StatCard label="Pre-Sales" value={presalesCount} Icon={IconPresales} tone="purple" />
        <StatCard label="Sales Engineers" value={engineerCount} Icon={IconSalesEngineer} tone="teal" />
      </div>

      <div className="adm-card">
        <div className="adm-toolbar">
          <div className="adm-search adm-search--inline"><IconSearch size={16} /><input placeholder="Search by name, email, ID or location…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
          <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
            <option value="all">All Roles</option>
            <option value="presales">Pre-Sales</option>
            <option value="sales_engineer">Sales Engineer</option>
            <option value="admin">Super Admin</option>
          </select>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="all">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="adm-table-scroll">
          <table className="adm-table">
            <thead><tr><th>Employee</th><th>Employee ID</th><th>Role</th><th>Location</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6} className="adm-empty">Loading…</td></tr> : pageRows.length === 0 ? <tr><td colSpan={6} className="adm-empty">No employees yet.</td></tr> : pageRows.map((e) => (
                <tr key={e.id}>
                  <td><div className="adm-lead-name">{e.name}</div><div className="adm-lead-sub">{e.phone || e.email}</div></td>
                  <td>{e.id}</td>
                  <td>{ROLE_LABEL[e.role] || e.role}</td>
                  <td>{e.location || (Array.isArray(e.cities) ? (e.cities[0] === 'ALL' ? 'All Cities' : e.cities.join(', ')) : '—')}</td>
                  <td><span className={`adm-status-pill${e.active !== false ? ' active' : ''}`}>{e.active !== false ? 'Active' : 'Inactive'}</span></td>
                  <td className="adm-row-actions"><div className="adm-row-actions-inner"><button className="adm-chip-btn" onClick={() => toggleActive(e)}>{e.active !== false ? 'Deactivate' : 'Activate'}</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageCount={pageCount} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>

      {modal?.type === 'add' && (
        <AddEmployeeModal
          title="Add Employee"
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); flash('Employee added.'); refresh(); }}
        />
      )}
    </>
  );
}
