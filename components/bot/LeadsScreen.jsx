'use client';
import { useEffect, useState } from 'react';
import { Topbar } from './ConsoleShell';
import { Avatar, Badge } from './ui';
import { fmtDate } from '@/lib/date';

const TONE = { new: 'teal', contacted: 'amber', qualified: 'amber', converted: 'green' };
const LABEL = { new: 'New', contacted: 'Contacted', qualified: 'Qualified', converted: 'Converted' };

export default function LeadsScreen() {
  const [leads, setLeads] = useState(null);

  useEffect(() => {
    fetch('/api/bot/leads').then((r) => r.json()).then(setLeads);
  }, []);

  const stats = leads ? {
    total: leads.length,
    qualified: leads.filter((l) => l.status === 'qualified').length,
    converted: leads.filter((l) => l.status === 'converted').length,
  } : null;

  return (
    <>
      <Topbar title="Leads" />
      <div className="bc-page">
        {stats && (
          <div className="bc-stat-grid">
            <div className="bc-stat-card"><div className="bc-stat-val">{stats.total}</div><div className="bc-stat-label">Total leads via bot</div></div>
            <div className="bc-stat-card"><div className="bc-stat-val">{stats.qualified}</div><div className="bc-stat-label">Qualified</div></div>
            <div className="bc-stat-card"><div className="bc-stat-val">{stats.converted}</div><div className="bc-stat-label">Converted</div></div>
          </div>
        )}
        <div className="bc-card" style={{ padding: 0 }}>
          <table className="bc-table">
            <thead>
              <tr><th>Name</th><th>Phone</th><th>City</th><th>Captured On</th><th>Status</th></tr>
            </thead>
            <tbody>
              {(leads || []).map((l) => (
                <tr key={l.chatId}>
                  <td><div className="bc-table-name"><Avatar name={l.name} /> {l.name || '—'}</div></td>
                  <td>{l.phone}</td>
                  <td>{l.city || '—'}</td>
                  <td>{fmtDate(l.capturedAt)}</td>
                  <td><Badge tone={TONE[l.status] || 'gray'}>{LABEL[l.status] || l.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
          {leads && leads.length === 0 && <div className="bc-empty">No leads captured yet.</div>}
          {!leads && <div className="bc-empty">Loading…</div>}
        </div>
      </div>
    </>
  );
}
