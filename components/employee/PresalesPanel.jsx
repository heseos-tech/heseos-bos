'use client';
// Pre-sales panel — shows ONLY the leads assigned to this exec (city auto-assigned, or handed
// to them by an admin), not the whole pipeline. Their job: work New leads, log Follow-ups,
// and Schedule Demo to hand a qualified lead over to a sales engineer.
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { fmtDateTime, fmtDate } from '@/lib/date';
import { stageOf, displayStatus, subUpdateOf, isFollowUpLead, CONTACT_STAGES } from '@/lib/leadStage';
import { PRODUCT_INTEREST, PROPERTY_TYPE, LEAD_SOURCES } from '@/lib/formOptions';

const PI_LABEL = Object.fromEntries(PRODUCT_INTEREST.map((p) => [p.v, p.l]));
const PT_LABEL = Object.fromEntries(PROPERTY_TYPE.map((p) => [p.v, p.l]));

export default function PresalesPanel({ employee }) {
  const router = useRouter();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('new');
  const [modal, setModal] = useState(null); // { type: 'contact'|'schedule'|'timeline', lead }

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
    await fetch('/api/auth/employee', { method: 'DELETE' });
    router.push('/employee/login');
    router.refresh();
  }

  // Only what's assigned to me — never the whole pipeline.
  const mine = useMemo(() => leads.filter((l) => l.assignedTo === employee.id), [leads, employee.id]);

  const groups = useMemo(() => {
    const g = { new: [], followup: [], demo: [], converted: [], rejected: [], all: mine };
    for (const l of mine) {
      const st = stageOf(l);
      if (st === 'Rejected') g.rejected.push(l);
      else if (st === 'Converted') g.converted.push(l);
      else if (st === 'Demo Scheduled') g.demo.push(l);
      else if (isFollowUpLead(l)) g.followup.push(l);
      else g.new.push(l);
    }
    return g;
  }, [mine]);

  const TABS = [
    { key: 'new', label: 'New Leads', list: groups.new },
    { key: 'followup', label: 'Follow-ups', list: groups.followup },
    { key: 'demo', label: 'Demo Scheduled', list: groups.demo },
    { key: 'converted', label: 'Converted', list: groups.converted },
    { key: 'rejected', label: 'Rejected', list: groups.rejected },
    { key: 'all', label: 'All Mine', list: groups.all },
  ];
  const active = TABS.find((t) => t.key === tab) || TABS[0];
  const canWork = tab === 'new' || tab === 'followup';

  return (
    <div className="dash">
      <div className="dash-topbar">
        <div className="dash-topbar-inner">
          <div className="dash-brand" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Image src="/brand/lockup-navy.png" alt="Heseos" width={282} height={64} style={{ height: 24, width: 'auto' }} />
            <span style={{ fontWeight: 500, color: 'var(--ink-soft)', fontSize: 13 }}>Pre-sales</span>
          </div>
          <div className="dash-user">
            <span className="dash-user-name">{employee.name || employee.email}</span>
            <span className="dash-user-role">{employee.location || 'pre-sales'}</span>
            <button className="dash-logout" onClick={logout}>Log out</button>
          </div>
        </div>
      </div>

      <div className="dash-body">
        <div className="kpi-row">
          <div className="kpi-card"><div className="kpi-label">New Leads</div><div className="kpi-val">{groups.new.length}</div></div>
          <div className="kpi-card"><div className="kpi-label">Follow-ups</div><div className="kpi-val">{groups.followup.length}</div></div>
          <div className="kpi-card"><div className="kpi-label">Demo Scheduled</div><div className="kpi-val">{groups.demo.length}</div></div>
          <div className="kpi-card"><div className="kpi-label">Converted</div><div className="kpi-val">{groups.converted.length}</div></div>
        </div>

        <div className="dash-tabs">
          {TABS.map((t) => (
            <button key={t.key} className={`dash-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
              {t.label} <span className="dash-tab-count">{t.list.length}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="empty-state">Loading your leads…</div>
        ) : active.list.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            {mine.length === 0 ? 'No leads assigned to you yet.' : `Nothing in ${active.label.toLowerCase()} right now.`}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="lead-table">
              <thead>
                <tr><th>Lead</th><th>Interest</th><th>Source</th><th>Status</th><th>Submitted</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {active.list.map((l) => {
                  const status = displayStatus(l);
                  const sub = subUpdateOf(l);
                  return (
                    <tr key={l.id}>
                      <td>
                        <div className="lead-name">{l.name}</div>
                        <div className="lead-meta">{l.phone} · {l.city}</div>
                      </td>
                      <td>
                        <div>{(l.productInterest || []).map((p) => PI_LABEL[p] || p).join(', ') || '—'}</div>
                        <div className="lead-meta">{PT_LABEL[l.propertyType] || ''}</div>
                      </td>
                      <td>{LEAD_SOURCES[l.source] || l.source}</td>
                      <td>
                        <span className="badge" style={{ color: status.c, background: status.bg }}>
                          <span className="badge-dot" />{status.label}
                        </span>
                        {sub && <div className="lead-meta" style={{ color: '#B7791F', marginTop: 4 }}>{sub.label}</div>}
                        {l.demoScheduledAt && stageOf(l) === 'Demo Scheduled' && (
                          <div className="lead-meta">{fmtDate(l.demoDate)} · {l.demoTime}</div>
                        )}
                      </td>
                      <td>{fmtDateTime(l.createdAt)}</td>
                      <td>
                        <div className="row-actions">
                          {canWork && (
                            <>
                              <button className="chip-btn" onClick={() => quickContact(l, 'call_not_picked')}>Not Picked</button>
                              <button className="chip-btn danger" onClick={() => quickContact(l, 'not_interested')}>Not Interested</button>
                              <button className="chip-btn" onClick={() => setModal({ type: 'contact', lead: l })}>Follow-up</button>
                              <button className="chip-btn primary" onClick={() => setModal({ type: 'schedule', lead: l })}>Schedule Demo</button>
                            </>
                          )}
                          <button className="chip-btn" onClick={() => setModal({ type: 'timeline', lead: l })}>Timeline</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && <PresalesModal modal={modal} onClose={() => setModal(null)} onDone={() => { setModal(null); fetchLeads(); }} />}
    </div>
  );

  async function quickContact(lead, contactStage) {
    await fetch(`/api/leads/${lead.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'contact', contactStage }) });
    fetchLeads();
  }
}

function PresalesModal({ modal, onClose, onDone }) {
  const { type, lead } = modal;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [contactStage, setContactStage] = useState('follow_up');
  const [note, setNote] = useState('');
  const [followUpAt, setFollowUpAt] = useState('');

  const [demoAddress, setDemoAddress] = useState(lead.demoAddress || '');
  const [demoDate, setDemoDate] = useState(lead.demoDate || '');
  const [demoTime, setDemoTime] = useState(lead.demoTime || '');

  async function submit() {
    setError('');
    setSubmitting(true);
    try {
      let body;
      if (type === 'contact') body = { type: 'contact', contactStage, note, followUpAt: followUpAt || null };
      else if (type === 'schedule') {
        if (!demoAddress || !demoDate || !demoTime) { setError('Address, date and time are all required.'); setSubmitting(false); return; }
        body = { type: 'scheduleDemo', demoAddress, demoDate, demoTime };
      }
      const res = await fetch(`/api/leads/${lead.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">
        {type === 'contact' && (
          <>
            <div className="modal-title">Log contact outcome</div>
            <div className="modal-sub">{lead.name} · {lead.phone}</div>
            <div className="lf-field">
              <label className="lf-label">Outcome</label>
              <div className="lf-pills cols-1">
                {CONTACT_STAGES.filter((c) => c.key !== 'qualified').map((c) => (
                  <button key={c.key} type="button" className={`lf-pill${contactStage === c.key ? ' active' : ''}`} onClick={() => setContactStage(c.key)}>{c.label}</button>
                ))}
              </div>
            </div>
            {contactStage === 'follow_up' && (
              <div className="lf-field">
                <label className="lf-label">Follow up at</label>
                <input className="lf-input" type="datetime-local" value={followUpAt} onChange={(e) => setFollowUpAt(e.target.value)} />
              </div>
            )}
            <div className="lf-field">
              <label className="lf-label">Note (optional)</label>
              <input className="lf-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Any context for the next call" />
            </div>
          </>
        )}

        {type === 'schedule' && (
          <>
            <div className="modal-title">Schedule demo</div>
            <div className="modal-sub">{lead.name} · {lead.phone} · {lead.city}</div>
            <div className="lf-field"><label className="lf-label">Demo address</label><input className="lf-input" value={demoAddress} onChange={(e) => setDemoAddress(e.target.value)} placeholder="Full address for the visit" /></div>
            <div className="lf-field"><label className="lf-label">Date</label><input className="lf-input" type="date" value={demoDate} onChange={(e) => setDemoDate(e.target.value)} /></div>
            <div className="lf-field"><label className="lf-label">Time</label><input className="lf-input" type="time" value={demoTime} onChange={(e) => setDemoTime(e.target.value)} /></div>
          </>
        )}

        {type === 'timeline' && (
          <>
            <div className="modal-title">Lead timeline</div>
            <div className="modal-sub">{lead.name} · {lead.phone}</div>
            <div className="timeline">
              {(lead.history || []).slice().reverse().map((h, i) => (
                <div className="timeline-item" key={i}>
                  <div className="timeline-dot" />
                  <div>
                    <div className="timeline-label">{h.event}</div>
                    <div className="timeline-meta">{fmtDateTime(h.at)} {h.by ? `· ${h.by}` : ''}</div>
                    {h.note && <div className="timeline-note">{h.note}</div>}
                  </div>
                </div>
              ))}
              {(!lead.history || lead.history.length === 0) && <div className="empty-state">No history yet.</div>}
            </div>
          </>
        )}

        {error && <div className="lf-error">{error}</div>}

        <div className="lf-actions">
          <button className="lf-btn-back" onClick={onClose} disabled={submitting}>{type === 'timeline' ? 'Close' : 'Cancel'}</button>
          {type !== 'timeline' && <button className="lf-btn-next" onClick={submit} disabled={submitting}>{submitting ? 'Saving…' : 'Save'}</button>}
        </div>
      </div>
    </div>
  );
}
