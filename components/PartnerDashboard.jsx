'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { fmtDateTime } from '@/lib/date';
import { displayStatus } from '@/lib/leadStage';
import { PRODUCT_INTEREST } from '@/lib/formOptions';
import LeadForm from './LeadForm';

const PI_LABEL = Object.fromEntries(PRODUCT_INTEREST.map((p) => [p.v, p.l]));

export default function PartnerDashboard({ partner }) {
  const router = useRouter();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch('/api/leads');
      if (res.ok) setLeads(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
    const t = setInterval(fetchLeads, 20000);
    return () => clearInterval(t);
  }, [fetchLeads]);

  async function logout() {
    await fetch('/api/auth/partner', { method: 'DELETE' });
    router.push('/partner/login');
    router.refresh();
  }

  const converted = leads.filter((l) => l.demoOutcome === 'converted').length;

  return (
    <div className="dash">
      <div className="dash-topbar">
        <div className="dash-topbar-inner">
          <div className="dash-brand" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Image src="/brand/lockup-navy.png" alt="Heseos" width={282} height={64} style={{ height: 24, width: 'auto' }} /> <span style={{ fontWeight: 500, color: 'var(--ink-soft)', fontSize: 13 }}>Partner</span></div>
          <div className="dash-user">
            <span className="dash-user-name">{partner.businessName || partner.name}</span>
            <button className="dash-logout" onClick={logout}>Log out</button>
          </div>
        </div>
      </div>

      <div className="dash-body">
        <div className="kpi-row">
          <div className="kpi-card"><div className="kpi-label">Leads Submitted</div><div className="kpi-val">{leads.length}</div></div>
          <div className="kpi-card"><div className="kpi-label">Converted</div><div className="kpi-val">{converted}</div></div>
          <div className="kpi-card"><div className="kpi-label">In Progress</div><div className="kpi-val">{leads.length - converted}</div></div>
          <div className="kpi-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button className="btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Add Lead</button>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">Loading your leads…</div>
        ) : leads.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🧾</div>
            No leads yet — add your first one to get started.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="lead-table">
              <thead>
                <tr><th>Lead</th><th>Interest</th><th>Status</th><th>Submitted</th></tr>
              </thead>
              <tbody>
                {leads.map((l) => {
                  const status = displayStatus(l);
                  return (
                    <tr key={l.id}>
                      <td><div className="lead-name">{l.name}</div><div className="lead-meta">{l.phone} · {l.city}</div></td>
                      <td>{(l.productInterest || []).map((p) => PI_LABEL[p] || p).join(', ') || '—'}</td>
                      <td><span className="badge" style={{ color: status.c, background: status.bg }}><span className="badge-dot" />{status.label}</span></td>
                      <td>{fmtDateTime(l.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowForm(false)}>
          <LeadForm source="partner_app" onSuccess={() => { setShowForm(false); fetchLeads(); }} />
        </div>
      )}
    </div>
  );
}
