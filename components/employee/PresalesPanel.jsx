'use client';
// Pre-sales panel — shows ONLY the leads assigned to this exec (city auto-assigned, or handed
// to them by an admin), not the whole pipeline. Their job: work New leads, log Follow-ups,
// and Schedule Demo to hand a qualified lead over to a sales engineer.
//
// Visual system: the same sidebar + topbar + stat-card + table + pagination language as
// Admin (components/employee/ui.jsx's EmployeeShell/TrendKpiCard, reusing app/admin/admin.css
// — see app/employee/layout.jsx) instead of this panel's own bespoke look, so Pre-sales,
// Sales Engineer and Admin all read as one product. See SalesEngineerPanel.jsx for the same
// treatment applied to that role.
import { useMemo, useState } from 'react';
import { fmtDateTime, fmtDate } from '@/lib/date';
import { stageOf, displayStatus, subUpdateOf, isFollowUpLead, CONTACT_STAGES, CONTACT_REJECT_REASONS } from '@/lib/leadStage';
import { PRODUCT_INTEREST, PROPERTY_TYPE, LEAD_SOURCES } from '@/lib/formOptions';
import { windowDelta } from '@/lib/adminMetrics';
import { useApiResource } from '@/lib/useApiResource';
import { IconLeads, IconPhone, IconDemo, IconConversions, IconSearch, IconRefresh, IconEye } from '@/components/admin/icons';
import { Pagination } from '@/components/admin/ui';
import {
  EmployeeShell, TrendKpiCard, sourceLabelFor, sourceIconFor, attributionFor, partnerDisplayName,
  SOURCE_FILTER_OPTIONS, matchesSourceFilter, RowActionsMenu,
} from '@/components/employee/ui';

const PI_LABEL = Object.fromEntries(PRODUCT_INTEREST.map((p) => [p.v, p.l]));
const PT_LABEL = Object.fromEntries(PROPERTY_TYPE.map((p) => [p.v, p.l]));
const PAGE_SIZE = 8;

export default function PresalesPanel({ employee }) {
  // Shared via useApiResource (lib/useApiResource.js) — refresh is aliased to fetchLeads so
  // every existing call site below (the modal's onDone, the manual refresh button) keeps
  // working unchanged. Partners/employees/attribution links are only for resolving the Source
  // column's "who referred this" line below the channel name (see attributionFor) — GET on
  // both /api/admin/partners and /api/admin/employees was relaxed from admin-only to any
  // authenticated employee for exactly this.
  const { data: leads, loading, refresh: fetchLeads } = useApiResource('/api/leads', { pollMs: 20000 });
  const { data: partners } = useApiResource('/api/admin/partners', { pollMs: 30000 });
  const { data: employees } = useApiResource('/api/admin/employees', { pollMs: 30000 });
  const { data: links } = useApiResource('/api/admin/attribution', { pollMs: 30000 });

  const [section, setSection] = useState('leads'); // 'leads' | 'analytics' | 'settings'
  const [tab, setTab] = useState('new');
  const [q, setQ] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [partnerFilter, setPartnerFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [modal, setModal] = useState(null); // { type: 'contact'|'schedule'|'timeline', lead }
  const [openMenuId, setOpenMenuId] = useState(null);

  // Sidebar "Follow-ups"/"Demos" are shortcuts into this same Leads table with a tab preset —
  // there's no separate data behind them — while "Analytics"/"Settings" are their own small
  // sections below. The sidebar highlight runs the other way too: whichever tab is active
  // (however it got there — sidebar or a pill click) decides which nav item looks active, so
  // the two stay in sync without duplicating state.
  function goSection(key) {
    if (key === 'analytics' || key === 'settings') { setSection(key); return; }
    setSection('leads');
    setPage(1);
    if (key === 'followups') setTab('followup');
    else if (key === 'demos') setTab('demo');
    else setTab('new');
  }
  const activeNavKey = section !== 'leads' ? section : (tab === 'followup' ? 'followups' : tab === 'demo' ? 'demos' : 'leads');

  async function syncFromMeta() {
    setSyncing(true); setSyncMsg('');
    try {
      const res = await fetch('/api/leads/sync', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setSyncMsg(data.error || 'Could not sync leads.'); return; }
      setSyncMsg(data.inserted > 0 ? `Synced — ${data.inserted} new lead${data.inserted === 1 ? '' : 's'}` : 'Synced — already up to date');
      fetchLeads();
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(''), 3500);
    }
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

  // Partner filter's options are built from partners who actually show up in MY leads, not
  // the company's whole partner list — this view is already scoped to "mine", so a dropdown
  // of every partner in the business (most of whom I've never gotten a lead from) would just
  // be noise.
  const partnerOptions = useMemo(() => {
    const ids = new Set(mine.map((l) => l.partnerId).filter(Boolean));
    return (partners || [])
      .filter((p) => ids.has(p.id))
      .map((p) => ({ id: p.id, name: partnerDisplayName(p) || p.id }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [mine, partners]);

  const filtered = useMemo(() => {
    return active.list.filter((l) => {
      if (!matchesSourceFilter(l, sourceFilter)) return false;
      if (partnerFilter !== 'all' && l.partnerId !== partnerFilter) return false;
      if (q.trim()) {
        const s = q.trim().toLowerCase();
        if (!(`${l.name} ${l.phone} ${l.city}`.toLowerCase().includes(s))) return false;
      }
      return true;
    });
  }, [active.list, q, sourceFilter, partnerFilter]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const dNew = useMemo(() => windowDelta(mine, 'createdAt'), [mine]);
  const dFollowup = useMemo(() => windowDelta(groups.followup, 'contactStageAt'), [groups.followup]);
  const dDemo = useMemo(() => windowDelta(groups.demo, 'demoScheduledAt'), [groups.demo]);
  const dConverted = useMemo(() => windowDelta(groups.converted, 'demoOutcomeAt'), [groups.converted]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = (employee.name || employee.email || '').split(' ')[0];
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  function setTabAndReset(key) { setTab(key); setPage(1); }

  return (
    <EmployeeShell employee={employee} section={activeNavKey} onSection={goSection}>
      {section === 'leads' && (
        <>
          <div className="adm-page-head">
            <div>
              <h1 className="adm-greeting">{greeting}, {firstName}</h1>
              <p className="adm-page-sub">Here&rsquo;s your pre-sales overview</p>
            </div>
            <div className="adm-date-chip">{today}</div>
          </div>

          {syncMsg && <div className="adm-notice">{syncMsg}</div>}

          <div className="adm-stat-row">
            <TrendKpiCard label="New Leads" value={groups.new.length} deltaValue={dNew.value} Icon={IconLeads} />
            <TrendKpiCard label="Follow-ups" value={groups.followup.length} deltaValue={dFollowup.value} Icon={IconPhone} />
            <TrendKpiCard label="Demo Scheduled" value={groups.demo.length} deltaValue={dDemo.value} Icon={IconDemo} />
            <TrendKpiCard label="Converted" value={groups.converted.length} deltaValue={dConverted.value} Icon={IconConversions} />
          </div>

          <div className="adm-card">
            <div className="adm-toolbar">
              <div className="adm-search adm-search--inline"><IconSearch size={16} /><input placeholder="Search by name, phone or interest…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
              <select value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}>
                <option value="all">All Sources</option>
                {SOURCE_FILTER_OPTIONS.map(({ v, l }) => <option key={v} value={v}>{l}</option>)}
              </select>
              {partnerOptions.length > 0 && (
                <select value={partnerFilter} onChange={(e) => { setPartnerFilter(e.target.value); setPage(1); }}>
                  <option value="all">All Partners</option>
                  {partnerOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
              <button className={`adm-icon-btn${syncing ? ' adm-spinning' : ''}`} title="Sync leads from Meta" onClick={syncFromMeta} disabled={syncing}><IconRefresh size={17} /></button>
            </div>

            <div className="dash-tabs">
              {TABS.map((t) => (
                <button key={t.key} className={`dash-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTabAndReset(t.key)}>
                  {t.label} <span className="dash-tab-count">{t.list.length}</span>
                </button>
              ))}
            </div>

            {loading ? (
              <div className="adm-empty">Loading your leads…</div>
            ) : pageRows.length === 0 ? (
              <div className="adm-empty">
                {mine.length === 0 ? 'No leads assigned to you yet.' : `Nothing in ${active.label.toLowerCase()} right now.`}
              </div>
            ) : (
              <div className="adm-table-scroll">
                <table className="adm-table">
                  <thead>
                    <tr><th>Lead</th><th>Interest</th><th>Source</th><th>Status</th><th>Submitted</th><th></th></tr>
                  </thead>
                  <tbody>
                    {pageRows.map((l) => {
                      const status = displayStatus(l);
                      const sub = subUpdateOf(l);
                      const SourceIcon = sourceIconFor(l);
                      const attr = attributionFor(l, { partners, employees, links, leads });
                      return (
                        <tr key={l.id}>
                          <td>
                            <div className="adm-lead-name">{l.name}</div>
                            <div className="adm-lead-sub">{l.phone} · {l.city}</div>
                          </td>
                          <td>
                            <button className="adm-icon-btn" title="View interest & property type" onClick={() => setModal({ type: 'interest', lead: l })}><IconEye size={17} /></button>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <SourceIcon size={14} />
                              <span className="adm-lead-name" style={{ fontSize: 12.5 }}>{sourceLabelFor(l)}</span>
                            </div>
                            {attr && <div className="adm-lead-sub">{attr}</div>}
                          </td>
                          <td>
                            <span className="badge" style={{ color: status.c, background: status.bg }}>
                              <span className="badge-dot" />{status.label}
                            </span>
                            {sub && <div className="adm-lead-sub" style={{ color: '#B7791F', marginTop: 4 }}>{sub.label}</div>}
                            {l.rescheduleRequestedAt && (
                              <div className="adm-lead-sub" style={{ color: '#C0392B', marginTop: 4, fontWeight: 600 }}>🔔 Customer asked to reschedule</div>
                            )}
                            {l.demoScheduledAt && stageOf(l) === 'Demo Scheduled' && (
                              <div className="adm-lead-sub">{fmtDate(l.demoDate)} · {l.demoTime}</div>
                            )}
                          </td>
                          <td>{fmtDateTime(l.createdAt)}</td>
                          <td className="adm-row-actions">
                            <RowActionsMenu
                              rowId={l.id}
                              openId={openMenuId}
                              onToggle={setOpenMenuId}
                              primary={canWork ? { label: 'Schedule Demo', onClick: () => setModal({ type: 'schedule', lead: l }) }
                                : (tab === 'demo' && !l.salesEngineerId && !l.demoOutcome) ? { label: 'Reschedule Demo', onClick: () => setModal({ type: 'reschedule', lead: l }) }
                                : null}
                              items={[
                                ...(canWork ? [
                                  { label: 'Not Picked', onClick: () => quickContact(l, 'call_not_picked') },
                                  { label: 'Not Interested', onClick: () => setModal({ type: 'contact', lead: l, initialStage: 'not_interested' }), danger: true },
                                  { label: 'Follow-up', onClick: () => setModal({ type: 'contact', lead: l }) },
                                ] : []),
                                { label: 'Timeline', onClick: () => setModal({ type: 'timeline', lead: l }) },
                              ]}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <Pagination page={page} pageCount={pageCount} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
          </div>
        </>
      )}

      {section === 'analytics' && <AnalyticsSection mine={mine} groups={groups} />}
      {section === 'settings' && <SettingsSection employee={employee} />}

      {modal && <PresalesModal modal={modal} onClose={() => setModal(null)} onDone={() => { setModal(null); fetchLeads(); }} />}
    </EmployeeShell>
  );

  async function quickContact(lead, contactStage) {
    await fetch(`/api/leads/${lead.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'contact', contactStage }) });
    fetchLeads();
  }
}

// A light "how am I doing" recap — the same four numbers as the KPI row above, just given
// their own page since the sidebar has a dedicated slot for it. Built entirely from leads
// already assigned to me (no extra endpoint), same as the rest of this panel.
function AnalyticsSection({ mine, groups }) {
  const bySource = useMemo(() => {
    const counts = {};
    for (const l of mine) {
      const key = LEAD_SOURCES[l.source] || l.source || 'Unknown';
      counts[key] = (counts[key] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [mine]);
  const total = mine.length;
  const convRate = total ? Math.round((groups.converted.length / total) * 1000) / 10 : 0;

  return (
    <>
      <div className="adm-page-head">
        <div><h1 className="adm-h1">Analytics</h1><p className="adm-page-sub">How your own leads are moving, at a glance</p></div>
      </div>
      <div className="adm-stat-row">
        <div className="adm-stat-card"><div className="adm-stat-label">Total Assigned</div><div className="adm-stat-value">{total}</div></div>
        <div className="adm-stat-card"><div className="adm-stat-label">Demo Scheduled</div><div className="adm-stat-value">{groups.demo.length}</div></div>
        <div className="adm-stat-card"><div className="adm-stat-label">Converted</div><div className="adm-stat-value">{groups.converted.length}</div></div>
        <div className="adm-stat-card"><div className="adm-stat-label">Conversion Rate</div><div className="adm-stat-value">{convRate}%</div></div>
      </div>
      <div className="adm-card">
        <div className="adm-card-title">Leads by Source</div>
        <div className="adm-card-sub">Where your assigned leads are coming from</div>
        {bySource.length === 0 ? <div className="adm-empty">No leads yet.</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {bySource.map(([label, count]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                <span>{label}</span>
                <span style={{ fontWeight: 700 }}>{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function SettingsSection({ employee }) {
  return (
    <>
      <div className="adm-page-head">
        <div><h1 className="adm-h1">Settings</h1><p className="adm-page-sub">Your account details</p></div>
      </div>
      <div className="adm-card" style={{ maxWidth: 480 }}>
        <div className="adm-card-title">Profile</div>
        <div className="adm-card-sub">Contact an admin to change any of this, including your password.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><div className="adm-stat-label">Name</div><div style={{ fontSize: 14, fontWeight: 600 }}>{employee.name || '—'}</div></div>
          <div><div className="adm-stat-label">Email</div><div style={{ fontSize: 14, fontWeight: 600 }}>{employee.email || '—'}</div></div>
          {employee.phone && <div><div className="adm-stat-label">Phone</div><div style={{ fontSize: 14, fontWeight: 600 }}>{employee.phone}</div></div>}
          <div><div className="adm-stat-label">Role</div><div style={{ fontSize: 14, fontWeight: 600 }}>Pre-Sales</div></div>
          <div><div className="adm-stat-label">City</div><div style={{ fontSize: 14, fontWeight: 600 }}>{employee.location || '—'}</div></div>
        </div>
      </div>
    </>
  );
}

function PresalesModal({ modal, onClose, onDone }) {
  const { type, lead } = modal;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [contactStage, setContactStage] = useState(modal.initialStage || 'follow_up');
  const [reason, setReason] = useState('');
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
      if (type === 'contact') {
        if (contactStage === 'not_interested' && !reason) { setError('Choose a reason.'); setSubmitting(false); return; }
        body = { type: 'contact', contactStage, reason: contactStage === 'not_interested' ? reason : undefined, note, followUpAt: followUpAt || null };
      }
      else if (type === 'schedule') {
        if (!demoAddress || !demoDate || !demoTime) { setError('Address, date and time are all required.'); setSubmitting(false); return; }
        body = { type: 'scheduleDemo', demoAddress, demoDate, demoTime };
      }
      else if (type === 'reschedule') {
        if (!demoDate || !demoTime) { setError('Date and time are required.'); setSubmitting(false); return; }
        body = { type: 'reschedule', demoDate, demoTime, demoAddress };
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
            {contactStage === 'not_interested' && (
              <div className="lf-field">
                <label className="lf-label">Reason</label>
                <select className="lf-input" value={reason} onChange={(e) => setReason(e.target.value)}>
                  <option value="">Choose a reason…</option>
                  {CONTACT_REJECT_REASONS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                </select>
              </div>
            )}
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

        {type === 'reschedule' && (
          <>
            <div className="modal-title">Reschedule demo</div>
            <div className="modal-sub">{lead.name} · {lead.phone} · currently {fmtDate(lead.demoDate)} {lead.demoTime}</div>
            {lead.rescheduleRequestedAt && (
              <div className="lf-error" style={{ background: '#FEE2E2', color: '#C0392B' }}>Customer asked to reschedule this via WhatsApp.</div>
            )}
            <div className="lf-field"><label className="lf-label">Demo address</label><input className="lf-input" value={demoAddress} onChange={(e) => setDemoAddress(e.target.value)} placeholder="Full address for the visit" /></div>
            <div className="lf-field"><label className="lf-label">New date</label><input className="lf-input" type="date" value={demoDate} onChange={(e) => setDemoDate(e.target.value)} /></div>
            <div className="lf-field"><label className="lf-label">New time</label><input className="lf-input" type="time" value={demoTime} onChange={(e) => setDemoTime(e.target.value)} /></div>
          </>
        )}

        {type === 'interest' && (
          <>
            <div className="modal-title">Interest &amp; property type</div>
            <div className="modal-sub">{lead.name} · {lead.phone}</div>
            <div className="lf-field">
              <label className="lf-label">Product interest</label>
              <div style={{ fontSize: 13.5, color: 'var(--adm-ink)' }}>
                {(lead.productInterest || []).length > 0 ? (lead.productInterest || []).map((p) => PI_LABEL[p] || p).join(', ') : '—'}
              </div>
            </div>
            <div className="lf-field">
              <label className="lf-label">Property type</label>
              <div style={{ fontSize: 13.5, color: 'var(--adm-ink)' }}>{PT_LABEL[lead.propertyType] || lead.propertyType || '—'}</div>
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
          <button className="lf-btn-back" onClick={onClose} disabled={submitting}>{(type === 'timeline' || type === 'interest') ? 'Close' : 'Cancel'}</button>
          {type !== 'timeline' && type !== 'interest' && <button className="lf-btn-next" onClick={submit} disabled={submitting}>{submitting ? 'Saving…' : 'Save'}</button>}
        </div>
      </div>
    </div>
  );
}
