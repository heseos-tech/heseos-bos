'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { fmtDateTime } from '@/lib/date';
import { EMPLOYEE_ROLES } from '@/lib/formOptions';

const ROLE_LABEL = { presales: 'Pre-Sales', sales_engineer: 'Sales Engineer', admin: 'Admin' };
const PARTNER_TYPES = ['shop', 'electrician', 'interior_designer', 'builder'];

export default function AdminPanel({ employee }) {
  const router = useRouter();
  const [tab, setTab] = useState('employees');
  const [employees, setEmployees] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // 'employee' | 'partner'

  const load = useCallback(async () => {
    const [eRes, pRes] = await Promise.all([fetch('/api/admin/employees'), fetch('/api/admin/partners')]);
    if (eRes.ok) setEmployees(await eRes.json());
    if (pRes.ok) setPartners(await pRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function logout() {
    await fetch('/api/auth/employee', { method: 'DELETE' });
    router.push('/employee/login');
    router.refresh();
  }

  async function toggleEmployee(id, active) {
    await fetch(`/api/admin/employees/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !active }) });
    load();
  }
  async function togglePartner(id, active) {
    await fetch(`/api/admin/partners/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !active }) });
    load();
  }

  return (
    <div className="dash">
      <div className="dash-topbar">
        <div className="dash-topbar-inner">
          <div className="dash-brand" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Image src="/brand/lockup-navy.png" alt="Heseos" width={282} height={64} style={{ height: 24, width: 'auto' }} /> <span style={{ fontWeight: 500, color: 'var(--ink-soft)', fontSize: 13 }}>Admin</span></div>
          <div className="dash-user">
            <Link href="/employee" className="chip-btn">← Leads</Link>
            <span className="dash-user-name">{employee.name || employee.email}</span>
            <button className="dash-logout" onClick={logout}>Log out</button>
          </div>
        </div>
      </div>

      <div className="dash-body">
        <div className="dash-tabs">
          <button className={`dash-tab${tab === 'employees' ? ' active' : ''}`} onClick={() => setTab('employees')}>Employees <span className="dash-tab-count">{employees.length}</span></button>
          <button className={`dash-tab${tab === 'partners' ? ' active' : ''}`} onClick={() => setTab('partners')}>Partners <span className="dash-tab-count">{partners.length}</span></button>
        </div>

        {tab === 'employees' && (
          <>
            <div style={{ marginBottom: 14 }}><button className="btn-primary btn-sm" onClick={() => setModal('employee')}>+ Add Employee</button></div>
            {loading ? <div className="empty-state">Loading…</div> : (
              <div style={{ overflowX: 'auto' }}>
                <table className="lead-table">
                  <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Added</th><th></th></tr></thead>
                  <tbody>
                    {employees.map((e) => (
                      <tr key={e.id}>
                        <td className="lead-name">{e.name}</td>
                        <td>{e.email}</td>
                        <td>{ROLE_LABEL[e.role] || e.role}</td>
                        <td>
                          <span className="badge" style={e.active !== false ? { color: '#16A34A', background: '#DCFCE7' } : { color: '#C0392B', background: '#FEE2E2' }}>
                            <span className="badge-dot" />{e.active !== false ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>{fmtDateTime(e.createdAt)}</td>
                        <td><button className="chip-btn" onClick={() => toggleEmployee(e.id, e.active !== false)}>{e.active !== false ? 'Deactivate' : 'Activate'}</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === 'partners' && (
          <>
            <div style={{ marginBottom: 14 }}><button className="btn-primary btn-sm" onClick={() => setModal('partner')}>+ Add Partner</button></div>
            {loading ? <div className="empty-state">Loading…</div> : (
              <div style={{ overflowX: 'auto' }}>
                <table className="lead-table">
                  <thead><tr><th>Business</th><th>Contact</th><th>Phone</th><th>Type</th><th>Status</th><th>Added</th><th></th></tr></thead>
                  <tbody>
                    {partners.map((p) => (
                      <tr key={p.id}>
                        <td className="lead-name">{p.businessName || p.name}</td>
                        <td>{p.name}</td>
                        <td>{p.phone}</td>
                        <td>{p.type}</td>
                        <td>
                          <span className="badge" style={p.active !== false ? { color: '#16A34A', background: '#DCFCE7' } : { color: '#C0392B', background: '#FEE2E2' }}>
                            <span className="badge-dot" />{p.active !== false ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>{fmtDateTime(p.createdAt)}</td>
                        <td><button className="chip-btn" onClick={() => togglePartner(p.id, p.active !== false)}>{p.active !== false ? 'Deactivate' : 'Activate'}</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {modal === 'employee' && <AddEmployeeModal onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />}
      {modal === 'partner' && <AddPartnerModal onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />}
    </div>
  );
}

function AddEmployeeModal({ onClose, onDone }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('presales');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError(''); setSaving(true);
    try {
      const res = await fetch('/api/admin/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password, role }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      onDone();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">
        <div className="modal-title">Add employee</div>
        <div className="modal-sub">Pre-sales, sales engineer or admin</div>
        <div className="lf-field"><label className="lf-label">Full name</label><input className="lf-input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="lf-field"><label className="lf-label">Email</label><input className="lf-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="lf-field"><label className="lf-label">Temporary password</label><input className="lf-input" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <div className="lf-field">
          <label className="lf-label">Role</label>
          <div className="lf-pills cols-3">
            {EMPLOYEE_ROLES.map((r) => (
              <button key={r} type="button" className={`lf-pill${role === r ? ' active' : ''}`} onClick={() => setRole(r)}>{ROLE_LABEL[r]}</button>
            ))}
          </div>
        </div>
        {error && <div className="lf-error">{error}</div>}
        <div className="lf-actions">
          <button className="lf-btn-back" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="lf-btn-next" onClick={submit} disabled={saving || !name || !email || !password}>{saving ? 'Saving…' : 'Create'}</button>
        </div>
      </div>
    </div>
  );
}

function AddPartnerModal({ onClose, onDone }) {
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [type, setType] = useState('shop');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError(''); setSaving(true);
    try {
      const res = await fetch('/api/admin/partners', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, businessName, phone, password, type }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      onDone();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">
        <div className="modal-title">Add partner</div>
        <div className="modal-sub">A distribution partner who can log leads via the partner portal</div>
        <div className="lf-field"><label className="lf-label">Contact name</label><input className="lf-input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="lf-field"><label className="lf-label">Business name</label><input className="lf-input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Shown on their dashboard" /></div>
        <div className="lf-field"><label className="lf-label">Phone (login)</label><input className="lf-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile number" /></div>
        <div className="lf-field"><label className="lf-label">Temporary password</label><input className="lf-input" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <div className="lf-field">
          <label className="lf-label">Type</label>
          <div className="lf-pills">
            {PARTNER_TYPES.map((t) => (
              <button key={t} type="button" className={`lf-pill${type === t ? ' active' : ''}`} onClick={() => setType(t)}>{t.replace('_', ' ')}</button>
            ))}
          </div>
        </div>
        {error && <div className="lf-error">{error}</div>}
        <div className="lf-actions">
          <button className="lf-btn-back" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="lf-btn-next" onClick={submit} disabled={saving || !name || !phone || !password}>{saving ? 'Saving…' : 'Create'}</button>
        </div>
      </div>
    </div>
  );
}
