'use client';
// Sales Engineer panel — shows ONLY the leads assigned to this engineer (city auto-assigned,
// or handed over by pre-sales/admin once a demo is booked). Their job: visit, send a
// quotation, and log the final demo outcome.
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { fmtDateTime, fmtDate } from '@/lib/date';
import { stageOf, displayStatus, subUpdateOf, needsReschedule, DEMO_OUTCOMES } from '@/lib/leadStage';
import { PRODUCT_INTEREST, PROPERTY_TYPE, LEAD_SOURCES } from '@/lib/formOptions';

const PI_LABEL = Object.fromEntries(PRODUCT_INTEREST.map((p) => [p.v, p.l]));
const PT_LABEL = Object.fromEntries(PROPERTY_TYPE.map((p) => [p.v, p.l]));

export default function SalesEngineerPanel({ employee }) {
  const router = useRouter();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('upcoming');
  const [modal, setModal] = useState(null); // { type: 'quotation'|'outcome'|'timeline', lead }

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
  const mine = useMemo(() => leads.filter((l) => l.salesEngineerId === employee.id), [leads, employee.id]);

  const groups = useMemo(() => {
    const g = { upcoming: [], reschedule: [], quoted: [], converted: [], lost: [], all: mine };
    for (const l of mine) {
      const st = stageOf(l);
      if (st === 'Rejected') g.lost.push(l);
      else if (st === 'Converted') g.converted.push(l);
      else if (needsReschedule(l)) g.reschedule.push(l);
      else if (l.quotationSentAt) g.quoted.push(l);
      else if (l.demoScheduledAt) g.upcoming.push(l);
    }
    return g;
  }, [mine]);

  const TABS = [
    { key: 'upcoming', label: 'Upcoming Demos', list: groups.upcoming },
    { key: 'reschedule', label: 'Needs Reschedule', list: groups.reschedule },
    { key: 'quoted', label: 'Quotation Sent', list: groups.quoted },
    { key: 'converted', label: 'Converted', list: groups.converted },
    { key: 'lost', label: 'Lost', list: groups.lost },
    { key: 'all', label: 'All Mine', list: groups.all },
  ];
  const active = TABS.find((t) => t.key === tab) || TABS[0];

  return (
    <div className="dash">
      <div className="dash-topbar">
        <div className="dash-topbar-inner">
          <div className="dash-brand" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Image src="/brand/lockup-navy.png" alt="Heseos" width={282} height={64} style={{ height: 24, width: 'auto' }} />
            <span style={{ fontWeight: 500, color: 'var(--ink-soft)', fontSize: 13 }}>Sales Engineer</span>
          </div>
          <div className="dash-user">
            <Link href="/employee/inbox" className="chip-btn">WhatsApp Inbox</Link>
            <span className="dash-user-name">{employee.name || employee.email}</span>
            <span className="dash-user-role">{employee.location || 'sales engineer'}</span>
            <button className="dash-logout" onClick={logout}>Log out</button>
          </div>
        </div>
      </div>

      <div className="dash-body">
        <div className="kpi-row">
          <div className="kpi-card"><div className="kpi-label">Upcoming Demos</div><div className="kpi-val">{groups.upcoming.length}</div></div>
          <div className="kpi-card"><div className="kpi-label">Quotation Sent</div><div className="kpi-val">{groups.quoted.length}</div></div>
          <div className="kpi-card"><div className="kpi-label">Converted</div><div className="kpi-val">{groups.converted.length}</div></div>
          <div className="kpi-card"><div className="kpi-label">Needs Reschedule</div><div className="kpi-val">{groups.reschedule.length}</div></div>
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
                <tr><th>Lead</th><th>Interest</th><th>Source</th><th>Demo</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {active.list.map((l) => {
                  const status = displayStatus(l);
                  const sub = subUpdateOf(l);
                  const canAct = tab === 'upcoming' || tab === 'quoted' || tab === 'reschedule';
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
                      <td>{l.demoDate ? <>{fmtDate(l.demoDate)} · {l.demoTime}<div className="lead-meta">{l.demoAddress}</div></> : '—'}</td>
                      <td>
                        <span className="badge" style={{ color: status.c, background: status.bg }}>
                          <span className="badge-dot" />{status.label}
                        </span>
                        {sub && <div className="lead-meta" style={{ color: '#B7791F', marginTop: 4 }}>{sub.label}</div>}
                        {l.quotationSentAt && <div className="lead-meta" style={{ marginTop: 4 }}>Quoted {l.quotationAmount ? `₹${l.quotationAmount}` : ''}</div>}
                      </td>
                      <td>
                        <div className="row-actions">
                          {canAct && (
                            <>
                              {!l.quotationSentAt && <button className="chip-btn" onClick={() => setModal({ type: 'quotation', lead: l })}>Send Quotation</button>}
                              <button className="chip-btn primary" onClick={() => setModal({ type: 'outcome', lead: l })}>{tab === 'reschedule' ? 'Reschedule' : 'Mark Outcome'}</button>
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

      {modal && <EngineerModal modal={modal} onClose={() => setModal(null)} onDone={() => { setModal(null); fetchLeads(); }} />}
    </div>
  );
}

function EngineerModal({ modal, onClose, onDone }) {
  const { type, lead } = modal;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [amount, setAmount] = useState(lead.quotationAmount || '');
  const [outcome, setOutcome] = useState(needsReschedule(lead) ? lead.demoOutcome : '');
  const [note, setNote] = useState('');
  const [demoDate, setDemoDate] = useState(lead.demoDate || '');
  const [demoTime, setDemoTime] = useState(lead.demoTime || '');
  const [demoAddress, setDemoAddress] = useState(lead.demoAddress || '');

  async function submit() {
    setError('');
    setSubmitting(true);
    try {
      let body;
      if (type === 'quotation') {
        body = { type: 'quotation', amount: amount ? Number(amount) : null };
      } else if (type === 'outcome') {
        if (!outcome) { setError('Choose an outcome.'); setSubmitting(false); return; }
        body = { type: 'demoOutcome', demoOutcome: outcome, note, ...(demoDate && demoTime ? { demoDate, demoTime, demoAddress } : {}) };
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
        {type === 'quotation' && (
          <>
            <div className="modal-title">Send quotation</div>
            <div className="modal-sub">{lead.name} · {lead.phone}</div>
            <div className="lf-field">
              <label className="lf-label">Amount (₹, optional)</label>
              <input className="lf-input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 185000" />
            </div>
          </>
        )}

        {type === 'outcome' && (
          <>
            <div className="modal-title">{needsReschedule(lead) ? 'Reschedule demo' : 'Mark demo outcome'}</div>
            <div className="modal-sub">{lead.name} · {fmtDate(lead.demoDate)} {lead.demoTime}</div>
            <div className="lf-field">
              <label className="lf-label">Outcome</label>
              <div className="lf-pills cols-1">
                {DEMO_OUTCOMES.map((d) => (
                  <button key={d.key} type="button" className={`lf-pill${outcome === d.key ? ' active' : ''}`} onClick={() => setOutcome(d.key)}>{d.label}</button>
                ))}
              </div>
            </div>
            {(outcome === 'out_of_station' || outcome === 'future_demo') && (
              <>
                <div className="lf-field"><label className="lf-label">New date</label><input className="lf-input" type="date" value={demoDate} onChange={(e) => setDemoDate(e.target.value)} /></div>
                <div className="lf-field"><label className="lf-label">New time</label><input className="lf-input" type="time" value={demoTime} onChange={(e) => setDemoTime(e.target.value)} /></div>
                <div className="lf-field"><label className="lf-label">Address (if changed)</label><input className="lf-input" value={demoAddress} onChange={(e) => setDemoAddress(e.target.value)} /></div>
              </>
            )}
            <div className="lf-field">
              <label className="lf-label">Note (optional)</label>
              <input className="lf-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Any context" />
            </div>
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
