'use client';
// Sales Engineer panel — two kinds of leads live here: "Available Leads" (open demos in this
// engineer's city that nobody has claimed yet — first to accept gets it, everyone else stops
// seeing it) and everything already claimed/assigned to them ("mine"). Their job: claim,
// visit, send a quotation, and log the final demo outcome.
//
// Same visual system as PresalesPanel.jsx — see that file's header comment.
import { useMemo, useState } from 'react';
import { fmtDateTime, fmtDate } from '@/lib/date';
import { stageOf, displayStatus, subUpdateOf, needsReschedule, DEMO_OUTCOMES, DEMO_OUTCOME_KIND, DEMO_REJECT_REASONS } from '@/lib/leadStage';
import { PRODUCT_INTEREST, PROPERTY_TYPE, LEAD_SOURCES } from '@/lib/formOptions';
import { windowDelta } from '@/lib/adminMetrics';
import { useApiResource } from '@/lib/useApiResource';
import { IconLeads, IconDemo, IconQuotation, IconConversions, IconSearch, IconEye } from '@/components/admin/icons';
import { Pagination } from '@/components/admin/ui';
import {
  EmployeeShell, TrendKpiCard, sourceLabelFor, sourceIconFor, attributionFor, partnerDisplayName,
  SOURCE_FILTER_OPTIONS, matchesSourceFilter, RowActionsMenu,
} from '@/components/employee/ui';
import QuotationBuilderModal from '@/components/shared/QuotationBuilder';

const PI_LABEL = Object.fromEntries(PRODUCT_INTEREST.map((p) => [p.v, p.l]));
const PT_LABEL = Object.fromEntries(PROPERTY_TYPE.map((p) => [p.v, p.l]));
const PAGE_SIZE = 8;

function norm(s) { return String(s || '').trim().toLowerCase(); }

export default function SalesEngineerPanel({ employee }) {
  // Shared via useApiResource (lib/useApiResource.js) — refresh is aliased to fetchLeads so
  // every existing call site below (claim, the modal's onDone) keeps working unchanged. Polls
  // faster than Pre-sales (15s vs 20s) since open demos get claimed fast — first come first
  // served. Partners/employees/attribution links are only for the Source column's "who
  // referred this" line — see attributionFor in components/employee/ui.jsx.
  const { data: leads, loading, refresh: fetchLeads } = useApiResource('/api/leads', { pollMs: 15000 });
  const { data: partners } = useApiResource('/api/admin/partners', { pollMs: 30000 });
  const { data: employees } = useApiResource('/api/admin/employees', { pollMs: 30000 });
  const { data: links } = useApiResource('/api/admin/attribution', { pollMs: 30000 });

  const [section, setSection] = useState('leads'); // 'leads' | 'analytics' | 'settings'
  const [tab, setTab] = useState('available');
  const [q, setQ] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [partnerFilter, setPartnerFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null); // { type: 'quotation'|'outcome'|'timeline', lead }
  const [claimingId, setClaimingId] = useState(null);
  const [notice, setNotice] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);

  // Sidebar "Follow-ups" maps to this role's closest equivalent working queue — leads whose
  // demo needs rescheduling — and "Demos" maps to Scheduled Demos, same shortcut-into-the-
  // same-table idea as PresalesPanel.jsx's goSection.
  function goSection(key) {
    if (key === 'analytics' || key === 'settings') { setSection(key); return; }
    setSection('leads');
    setPage(1);
    if (key === 'followups') setTab('reschedule');
    else if (key === 'demos') setTab('upcoming');
    else setTab('available');
  }
  const activeNavKey = section !== 'leads' ? section : (tab === 'reschedule' ? 'followups' : tab === 'upcoming' ? 'demos' : 'leads');

  function flash(msg) { setNotice(msg); setTimeout(() => setNotice(''), 4000); }

  // Open demos in my city that nobody has claimed yet — first to accept wins.
  const myCity = norm(employee.location);
  const available = useMemo(
    () => leads.filter((l) => l.demoScheduledAt && !l.salesEngineerId && myCity && norm(l.city) === myCity),
    [leads, myCity]
  );

  // What's already mine (claimed by me, or assigned by an admin).
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
    { key: 'available', label: 'Available Leads', list: available },
    { key: 'upcoming', label: 'Scheduled Demos', list: groups.upcoming },
    { key: 'reschedule', label: 'Needs Reschedule', list: groups.reschedule },
    { key: 'quoted', label: 'Quotation Sent', list: groups.quoted },
    { key: 'converted', label: 'Converted', list: groups.converted },
    { key: 'lost', label: 'Lost', list: groups.lost },
    { key: 'all', label: 'All Mine', list: groups.all },
  ];
  const active = TABS.find((t) => t.key === tab) || TABS[0];

  // Same "only partners who actually show up in my leads" reasoning as PresalesPanel.jsx's
  // partnerOptions.
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

  const dAvailable = useMemo(() => windowDelta(available, 'demoScheduledAt'), [available]);
  const dUpcoming = useMemo(() => windowDelta(groups.upcoming, 'demoScheduledAt'), [groups.upcoming]);
  const dQuoted = useMemo(() => windowDelta(groups.quoted, 'quotationSentAt'), [groups.quoted]);
  const dConverted = useMemo(() => windowDelta(groups.converted, 'demoOutcomeAt'), [groups.converted]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = (employee.name || employee.email || '').split(' ')[0];
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  function setTabAndReset(key) { setTab(key); setPage(1); }

  async function acceptLead(lead) {
    setClaimingId(lead.id);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'claim' }) });
      const data = await res.json();
      if (!res.ok) {
        flash(res.status === 409 ? `Too slow — ${lead.name} was just claimed by someone else.` : (data.error || 'Could not claim this lead.'));
        fetchLeads();
        return;
      }
      flash(`${lead.name} is now yours.`);
      fetchLeads();
    } finally {
      setClaimingId(null);
    }
  }

  return (
    <EmployeeShell employee={employee} section={activeNavKey} onSection={goSection}>
      {section === 'leads' && (
        <>
          <div className="adm-page-head">
            <div>
              <h1 className="adm-greeting">{greeting}, {firstName}</h1>
              <p className="adm-page-sub">Here&rsquo;s your sales engineering overview</p>
            </div>
            <div className="adm-date-chip">{today}</div>
          </div>

          {notice && <div className="adm-notice">{notice}</div>}
          {!myCity && (
            <div className="adm-notice">Your profile has no city set — ask an admin to set it from Sales Engineers so open demos in your city show up here.</div>
          )}

          <div className="adm-stat-row">
            <TrendKpiCard label="Claim Demos" value={available.length} deltaValue={dAvailable.value} Icon={IconLeads} />
            <TrendKpiCard label="Scheduled Demos" value={groups.upcoming.length} deltaValue={dUpcoming.value} Icon={IconDemo} />
            <TrendKpiCard label="Quotation Sent" value={groups.quoted.length} deltaValue={dQuoted.value} Icon={IconQuotation} />
            <TrendKpiCard label="Converted" value={groups.converted.length} deltaValue={dConverted.value} Icon={IconConversions} />
          </div>

          <div className="adm-card">
            <div className="adm-toolbar">
              <div className="adm-search adm-search--inline"><IconSearch size={16} /><input placeholder="Search by name, phone or city…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
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
                {tab === 'available' ? 'No open demos in your city right now.' : (mine.length === 0 ? 'No leads assigned to you yet.' : `Nothing in ${active.label.toLowerCase()} right now.`)}
              </div>
            ) : (
              <div className="adm-table-scroll">
                <table className="adm-table">
                  <thead>
                    <tr><th>Lead</th><th>Interest</th><th>Source</th><th>Demo</th><th>Status</th><th></th></tr>
                  </thead>
                  <tbody>
                    {pageRows.map((l) => {
                      const status = displayStatus(l);
                      const sub = subUpdateOf(l);
                      const SourceIcon = sourceIconFor(l);
                      const attr = attributionFor(l, { partners, employees, links, leads });
                      const canAct = tab === 'upcoming' || tab === 'quoted' || tab === 'reschedule';
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
                          <td>{l.demoDate ? <>{fmtDate(l.demoDate)} · {l.demoTime}<div className="adm-lead-sub">{l.demoAddress}</div></> : '—'}</td>
                          <td>
                            {tab === 'available' ? (
                              <span className="badge" style={{ color: '#0EA5E9', background: '#E0F2FE' }}><span className="badge-dot" />Open — unclaimed</span>
                            ) : (
                              <>
                                <span className="badge" style={{ color: status.c, background: status.bg }}>
                                  <span className="badge-dot" />{status.label}
                                </span>
                                {sub && <div className="adm-lead-sub" style={{ color: '#B7791F', marginTop: 4 }}>{sub.label}</div>}
                                {l.rescheduleRequestedAt && (
                                  <div className="adm-lead-sub" style={{ color: '#C0392B', marginTop: 4, fontWeight: 600 }}>🔔 Customer asked to reschedule</div>
                                )}
                                {l.quotationSentAt && (
                                  <div className="adm-lead-sub" style={{ marginTop: 4 }}>
                                    Quoted {l.quotationAmount ? `₹${l.quotationAmount}` : ''}
                                    {(l.quotationRevisions?.length || 0) > 1 && ` (rev ${l.quotationRevisions.length})`}
                                  </div>
                                )}
                                {l.finalPrice != null && <div className="adm-lead-sub" style={{ marginTop: 4, fontWeight: 700, color: '#16A34A' }}>Final ₹{l.finalPrice}</div>}
                              </>
                            )}
                          </td>
                          <td className="adm-row-actions">
                            <RowActionsMenu
                              rowId={l.id}
                              openId={openMenuId}
                              onToggle={setOpenMenuId}
                              primary={tab === 'available'
                                ? { label: claimingId === l.id ? 'Claiming…' : 'Accept Lead', onClick: () => acceptLead(l), disabled: claimingId === l.id }
                                : canAct ? { label: tab === 'reschedule' ? 'Reschedule' : 'Mark Outcome', onClick: () => setModal({ type: 'outcome', lead: l }) }
                                : null}
                              items={[
                                ...(tab === 'upcoming' ? [{ label: 'Reschedule Demo', onClick: () => setModal({ type: 'reschedule', lead: l }) }] : []),
                                ...(canAct ? [{ label: l.quotationSentAt ? 'Revise Quotation' : 'Send Quotation', onClick: () => setModal({ type: 'quotation', lead: l }) }] : []),
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

      {modal?.type === 'quotation' && (
        <QuotationBuilderModal lead={modal.lead} onClose={() => setModal(null)} onDone={() => { setModal(null); fetchLeads(); flash('Quotation saved'); }} />
      )}
      {modal && modal.type !== 'quotation' && <EngineerModal modal={modal} onClose={() => setModal(null)} onDone={() => { setModal(null); fetchLeads(); }} />}
    </EmployeeShell>
  );
}

// Same idea as PresalesPanel.jsx's AnalyticsSection, scoped to this role's own numbers.
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
        <div className="adm-stat-card"><div className="adm-stat-label">Quotation Sent</div><div className="adm-stat-value">{groups.quoted.length}</div></div>
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
          <div><div className="adm-stat-label">Role</div><div style={{ fontSize: 14, fontWeight: 600 }}>Sales Engineer</div></div>
          <div><div className="adm-stat-label">City</div><div style={{ fontSize: 14, fontWeight: 600 }}>{employee.location || '—'}</div></div>
        </div>
      </div>
    </>
  );
}

function EngineerModal({ modal, onClose, onDone }) {
  const { type, lead } = modal;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [outcome, setOutcome] = useState(needsReschedule(lead) ? lead.demoOutcome : '');
  const [reason, setReason] = useState('');
  const [finalPrice, setFinalPrice] = useState(lead.quotationAmount || '');
  const [note, setNote] = useState('');
  const [demoDate, setDemoDate] = useState(lead.demoDate || '');
  const [demoTime, setDemoTime] = useState(lead.demoTime || '');
  const [demoAddress, setDemoAddress] = useState(lead.demoAddress || '');

  async function submit() {
    setError('');
    setSubmitting(true);
    try {
      let body;
      if (type === 'outcome') {
        if (!outcome) { setError('Choose an outcome.'); setSubmitting(false); return; }
        if (outcome === 'converted' && !finalPrice) { setError('Enter the final price to mark this Converted.'); setSubmitting(false); return; }
        if (DEMO_OUTCOME_KIND[outcome] === 'dead' && !reason) { setError('Choose a reason.'); setSubmitting(false); return; }
        body = {
          type: 'demoOutcome',
          demoOutcome: outcome,
          reason: DEMO_OUTCOME_KIND[outcome] === 'dead' ? reason : undefined,
          note,
          ...(outcome === 'converted' ? { finalPrice: Number(finalPrice) } : {}),
          ...(demoDate && demoTime ? { demoDate, demoTime, demoAddress } : {}),
        };
      } else if (type === 'reschedule') {
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
            {(outcome === 'out_of_station' || outcome === 'future_demo' || outcome === 'engineer_no_contact') && (
              <>
                <div className="lf-field"><label className="lf-label">New date</label><input className="lf-input" type="date" value={demoDate} onChange={(e) => setDemoDate(e.target.value)} /></div>
                <div className="lf-field"><label className="lf-label">New time</label><input className="lf-input" type="time" value={demoTime} onChange={(e) => setDemoTime(e.target.value)} /></div>
                <div className="lf-field"><label className="lf-label">Address (if changed)</label><input className="lf-input" value={demoAddress} onChange={(e) => setDemoAddress(e.target.value)} /></div>
              </>
            )}
            {outcome === 'converted' && (
              <div className="lf-field">
                <label className="lf-label">Final price (₹) — after negotiation</label>
                <input className="lf-input" type="number" value={finalPrice} onChange={(e) => setFinalPrice(e.target.value)} placeholder="The price the deal actually closed at" />
                {lead.quotationAmount != null && <div className="adm-lead-sub" style={{ marginTop: 4 }}>Last quoted: ₹{lead.quotationAmount}</div>}
              </div>
            )}
            {DEMO_OUTCOME_KIND[outcome] === 'dead' && (
              <div className="lf-field">
                <label className="lf-label">Reason</label>
                <select className="lf-input" value={reason} onChange={(e) => setReason(e.target.value)}>
                  <option value="">Choose a reason…</option>
                  {DEMO_REJECT_REASONS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                </select>
              </div>
            )}
            <div className="lf-field">
              <label className="lf-label">Note (optional)</label>
              <input className="lf-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Any context" />
            </div>
          </>
        )}

        {type === 'reschedule' && (
          <>
            <div className="modal-title">Reschedule demo</div>
            <div className="modal-sub">{lead.name} · currently {fmtDate(lead.demoDate)} {lead.demoTime}</div>
            {lead.rescheduleRequestedAt && (
              <div className="lf-error" style={{ background: '#FEE2E2', color: '#C0392B' }}>Customer asked to reschedule this via WhatsApp.</div>
            )}
            <div className="lf-field"><label className="lf-label">New date</label><input className="lf-input" type="date" value={demoDate} onChange={(e) => setDemoDate(e.target.value)} /></div>
            <div className="lf-field"><label className="lf-label">New time</label><input className="lf-input" type="time" value={demoTime} onChange={(e) => setDemoTime(e.target.value)} /></div>
            <div className="lf-field"><label className="lf-label">Address (if changed)</label><input className="lf-input" value={demoAddress} onChange={(e) => setDemoAddress(e.target.value)} /></div>
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
