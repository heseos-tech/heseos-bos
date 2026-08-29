'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { fmtDateTime } from '@/lib/date';
import { LEAD_SOURCES } from '@/lib/formOptions';
import { CONTACT_LABEL, DEMO_OUTCOME_LABEL } from '@/lib/leadStage';
import { nextAction } from '@/lib/adminMetrics';
import { StatCard, Pagination } from './ui';
import { IconSearch, IconDownload, IconPresales, IconLeads, IconDemo, IconConversions } from './icons';
import { AddEmployeeModal } from './SalesEngineersPage';
import { IconPlus } from './icons';

const PAGE_SIZE = 8;

function callStatusOf(l) {
  if (!l.contactStageAt) return { key: 'not_called', label: 'Not Called' };
  if (CONTACT_LABEL[l.contactStage]) return { key: l.contactStage, label: CONTACT_LABEL[l.contactStage] };
  return { key: 'called', label: 'Called' };
}
function demoStatusOf(l) {
  if (l.demoOutcomeAt) return { key: 'completed', label: DEMO_OUTCOME_LABEL[l.demoOutcome] || 'Completed' };
  if (l.demoScheduledAt) return { key: 'scheduled', label: `Demo on ${l.demoDate || ''}`.trim() };
  return { key: 'none', label: 'Not Scheduled' };
}
function presalesBucket(l) {
  if (l.contactStage === 'not_interested' || (l.demoOutcome && l.demoOutcome.includes('not_interested'))) return 'not_interested';
  if (l.contactStage === 'call_not_picked') return 'no_response';
  if (l.demoOutcomeAt) return 'demo_completed';
  if (l.demoScheduledAt) return 'demo_scheduled';
  if (l.contactStageAt) return 'called';
  return 'unworked';
}

const TABS = [
  { key: 'all', label: 'All Leads' },
  { key: 'called', label: 'Called' },
  { key: 'demo_scheduled', label: 'Demo Scheduled' },
  { key: 'demo_completed', label: 'Demo Completed' },
  { key: 'no_response', label: 'No Response' },
  { key: 'not_interested', label: 'Not Interested' },
];

export default function PresalesPage() {
  const [leads, setLeads] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [execId, setExecId] = useState('all');
  const [tab, setTab] = useState('all');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const [l, e] = await Promise.all([
      fetch('/api/leads').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/admin/employees').then((r) => (r.ok ? r.json() : [])),
    ]);
    setLeads(l.filter((x) => x.assignedTo)); setEmployees(e.filter((x) => x.role === 'presales')); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  function flash(msg) { setNotice(msg); setTimeout(() => setNotice(''), 3000); }
  const execName = (id) => employees.find((e) => e.id === id)?.name || 'Unassigned';

  const counts = useMemo(() => {
    const c = { all: leads.length };
    for (const t of TABS) if (t.key !== 'all') c[t.key] = 0;
    for (const l of leads) c[presalesBucket(l)] = (c[presalesBucket(l)] || 0) + 1;
    return c;
  }, [leads]);

  const callsMade = leads.filter((l) => l.contactStageAt).length;
  const demosScheduled = leads.filter((l) => l.demoScheduledAt).length;
  const demosCompleted = leads.filter((l) => l.demoOutcomeAt).length;
  const converted = leads.filter((l) => l.demoOutcome === 'converted').length;
  const conversionFromDemo = demosScheduled ? Math.round((converted / demosScheduled) * 1000) / 10 : 0;

  const filtered = useMemo(() => leads.filter((l) => {
    if (tab !== 'all' && presalesBucket(l) !== tab) return false;
    if (execId !== 'all' && l.assignedTo !== execId) return false;
    if (q.trim() && !(`${l.name} ${l.phone}`.toLowerCase().includes(q.trim().toLowerCase()))) return false;
    return true;
  }), [leads, tab, execId, q]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function exportCsv() {
    const cols = ['name', 'phone', 'source', 'presalesExec', 'callStatus', 'demoStatus', 'nextAction'];
    const csv = [cols.join(','), ...filtered.map((l) => [l.name, l.phone, LEAD_SOURCES[l.source] || l.source, execName(l.assignedTo), callStatusOf(l).label, demoStatusOf(l).label, nextAction(l).label].map((v) => `"${String(v ?? '')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'heseos-presales-leads.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="adm-page-head">
        <div><h1 className="adm-h1">Pre-sales</h1><p className="adm-page-sub">Pre-sales team calls leads and schedules demos</p></div>
        <div className="adm-page-head-actions">
          <button className="adm-btn-outline" onClick={exportCsv}><IconDownload size={15} /> Export</button>
          <button className="adm-btn-primary" onClick={() => setModal({ type: 'add' })}><IconPlus size={15} /> Add Pre-sales</button>
        </div>
      </div>

      {notice && <div className="adm-notice">{notice}</div>}

      <div className="adm-stat-row">
        <StatCard label="Total Leads" value={leads.length} Icon={IconLeads} tone="orange" />
        <StatCard label="Calls Made" value={callsMade} Icon={IconPresales} tone="blue" />
        <StatCard label="Demos Scheduled" value={demosScheduled} Icon={IconDemo} tone="purple" />
        <StatCard label="Demos Completed" value={demosCompleted} Icon={IconConversions} tone="teal" />
        <StatCard label="Conversion from Demo" value={`${conversionFromDemo}%`} Icon={IconConversions} tone="green" />
      </div>

      <div className="adm-card">
        <div className="adm-toolbar">
          <div className="adm-search adm-search--inline"><IconSearch size={16} /><input placeholder="Search by lead name or phone number…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
          <select value={execId} onChange={(e) => { setExecId(e.target.value); setPage(1); }}>
            <option value="all">All Pre-sales</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>

        <div className="adm-tabs">
          {TABS.map((t) => (
            <button key={t.key} className={`adm-tab${tab === t.key ? ' active' : ''}`} onClick={() => { setTab(t.key); setPage(1); }}>{t.label} <span className="adm-tab-count">{counts[t.key] || 0}</span></button>
          ))}
        </div>

        <div className="adm-table-scroll">
          <table className="adm-table">
            <thead><tr><th>Lead / Customer</th><th>Phone</th><th>Source</th><th>Pre-sales Exec</th><th>Call Status</th><th>Demo Status</th><th>Next Action</th><th>Last Activity</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={8} className="adm-empty">Loading…</td></tr> : pageRows.length === 0 ? <tr><td colSpan={8} className="adm-empty">No leads match these filters.</td></tr> : pageRows.map((l) => {
                const last = (l.history || [])[l.history.length - 1];
                return (
                  <tr key={l.id}>
                    <td><div className="adm-lead-name">{l.name}</div><div className="adm-lead-sub">{l.city}</div></td>
                    <td>{l.phone}</td>
                    <td>{LEAD_SOURCES[l.source] || l.source}</td>
                    <td>{execName(l.assignedTo)}</td>
                    <td>{callStatusOf(l).label}</td>
                    <td>{demoStatusOf(l).label}</td>
                    <td>{nextAction(l).label}</td>
                    <td>{last ? fmtDateTime(last.at) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageCount={pageCount} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>

      {modal?.type === 'add' && <AddEmployeeModal role="presales" title="Add pre-sales executive" onClose={() => setModal(null)} onDone={() => { setModal(null); flash('Pre-sales executive added'); load(); }} />}
    </>
  );
}
