'use client';
import { useEffect, useState, Fragment } from 'react';
import { Topbar } from './ConsoleShell';
import { Avatar, Badge } from './ui';
import { IconBell, IconDownload } from './icons';
import { fmtDate } from '@/lib/date';

const TONE = { new: 'teal', contacted: 'amber', qualified: 'amber', converted: 'green' };
const LABEL = { new: 'New', contacted: 'Contacted', qualified: 'Qualified', converted: 'Converted' };
const STATUSES = ['new', 'contacted', 'qualified', 'converted'];

const DEFAULT_MESSAGE = {
  new: "Hi! Thanks for reaching out — we've received your inquiry and will be in touch soon.",
  contacted: "Hi! Just checking in — we've noted your inquiry and our team will reach out shortly.",
  qualified: "Hi! Great news — your inquiry is moving forward. Our team will be in touch with next steps soon.",
  converted: "Hi! Thank you for choosing us — we're excited to get started. Our team will follow up with next steps shortly.",
};

function toCsv(leads) {
  const headers = ['Name', 'Phone', 'City', 'Status', 'Captured On'];
  const esc = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const rows = leads.map((l) => [l.name || '', l.phone || '', l.city || '', LABEL[l.status] || l.status || '', l.capturedAt ? new Date(l.capturedAt).toISOString() : '']);
  return [headers, ...rows].map((r) => r.map(esc).join(',')).join('\n');
}

export default function LeadsScreen() {
  const [leads, setLeads] = useState(null);
  const [savingId, setSavingId] = useState('');
  const [notifyId, setNotifyId] = useState('');
  const [notifyDraft, setNotifyDraft] = useState('');
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [notifyError, setNotifyError] = useState('');

  function load() {
    fetch('/api/bot/leads').then((r) => r.json()).then(setLeads);
  }
  useEffect(() => { load(); }, []);

  async function changeStatus(chatId, status) {
    setSavingId(chatId);
    try {
      const res = await fetch('/api/bot/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, status }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setLeads((ls) => ls.map((l) => (l.chatId === chatId ? { ...l, ...data } : l)));
    } finally {
      setSavingId('');
    }
  }

  function openNotify(lead) {
    setNotifyId(lead.chatId);
    setNotifyDraft(DEFAULT_MESSAGE[lead.status] || DEFAULT_MESSAGE.new);
    setNotifyError('');
  }
  function closeNotify() {
    setNotifyId('');
    setNotifyDraft('');
    setNotifyError('');
  }

  async function sendNotify(chatId) {
    const message = notifyDraft.trim();
    if (!message) return;
    setNotifyBusy(true);
    setNotifyError('');
    try {
      const res = await fetch('/api/bot/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, notify: true, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setNotifyError(data.error || 'Could not send that message.'); return; }
      setLeads((ls) => ls.map((l) => (l.chatId === chatId ? { ...l, ...data } : l)));
      closeNotify();
    } finally {
      setNotifyBusy(false);
    }
  }

  function downloadCsv() {
    if (!leads || !leads.length) return;
    const blob = new Blob([toCsv(leads)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

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
          <div className="bc-card-toprow">
            <div className="bc-card-sub" style={{ margin: 0 }}>Update a lead's status here, and optionally send that customer a WhatsApp update — they'll only be notified when you choose to.</div>
            <button type="button" className="bc-btn bc-btn-outline bc-btn-sm" onClick={downloadCsv} disabled={!leads || !leads.length}><IconDownload size={14} /> Download CSV</button>
          </div>
          <table className="bc-table">
            <thead>
              <tr><th>Name</th><th>Phone</th><th>City</th><th>Captured On</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {(leads || []).map((l) => (
                <Fragment key={l.chatId}>
                  <tr>
                    <td><div className="bc-table-name"><Avatar name={l.name} /> {l.name || '—'}</div></td>
                    <td>{l.phone}</td>
                    <td>{l.city || '—'}</td>
                    <td>{fmtDate(l.capturedAt)}</td>
                    <td>
                      <select className="bc-select bc-select-sm" value={l.status} disabled={savingId === l.chatId} onChange={(e) => changeStatus(l.chatId, e.target.value)}>
                        {STATUSES.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
                      </select>
                    </td>
                    <td>
                      <button type="button" className={`bc-icon-btn${l.notifiedAt ? ' bc-icon-btn-active' : ''}`} onClick={() => (notifyId === l.chatId ? closeNotify() : openNotify(l))} aria-label="Notify customer" title={l.notifiedAt ? `Last notified ${fmtDate(l.notifiedAt)}` : 'Send a WhatsApp update to this customer'}>
                        <IconBell size={15} />
                      </button>
                    </td>
                  </tr>
                  {notifyId === l.chatId && (
                    <tr key={`${l.chatId}-notify`}>
                      <td colSpan={6}>
                        <div className="bc-notify-row">
                          <textarea className="bc-textarea" rows={2} value={notifyDraft} onChange={(e) => setNotifyDraft(e.target.value)} placeholder="Message to send this customer on WhatsApp…" />
                          <div className="bc-notify-actions">
                            {notifyError && <span className="bc-notify-error">{notifyError}</span>}
                            <button type="button" className="bc-btn bc-btn-outline bc-btn-sm" onClick={closeNotify}>Cancel</button>
                            <button type="button" className="bc-btn bc-btn-primary bc-btn-sm" onClick={() => sendNotify(l.chatId)} disabled={notifyBusy || !notifyDraft.trim()}>{notifyBusy ? 'Sending…' : 'Send on WhatsApp'}</button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
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
