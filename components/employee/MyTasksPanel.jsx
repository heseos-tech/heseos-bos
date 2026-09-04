'use client';
// components/employee/MyTasksPanel.jsx — the personal slice of the shared team task board
// (see app/api/tasks's header for the trust model: any employee can see/act on any task, this
// is just the default filter) scoped to tasks assigned to the current employee. Dropped into
// PresalesPanel and SalesEngineerPanel as a "My Tasks" mode next to their existing lead-stage
// tabs, not a separate route. The Team App gets its own hp-*-styled equivalent
// (components/team/TasksScreen.jsx) hitting the same API rather than sharing this component —
// a component shared verbatim across the dash-/lf-* (desktop employee) and hp-* (Team App)
// stylesheet scopes silently loses its styling outside whichever one it was built against, the
// exact bug fixed on components/shared/QuotationBuilder.jsx earlier this session — so each
// surface gets its own small view instead. Uses mt-* prefixed CSS (app/globals.css) so it can
// never collide with Admin's own .task-* classes in app/admin/admin.css, since globals.css loads
// on every route including /admin.
import { useMemo, useState } from 'react';
import { fmtDate } from '@/lib/date';
import { useApiResource, invalidate } from '@/lib/useApiResource';
import { IconTasks, IconX } from '@/components/admin/icons';

const PRIORITY_LABEL = { low: 'Low', medium: 'Medium', high: 'High' };
const PRIORITY_COLOR = { low: '#6b7e96', medium: '#B7791F', high: '#C0392B' };

function isOverdue(t) {
  return t.status === 'open' && t.dueAt && new Date(t.dueAt) < new Date(new Date().toDateString());
}

export default function MyTasksPanel({ employee }) {
  const { data: tasks, loading, refresh } = useApiResource('/api/tasks');
  const { data: leads } = useApiResource('/api/leads');
  const [status, setStatus] = useState('open');
  const [modal, setModal] = useState(null); // { type: 'add'|'edit', task }
  const [notice, setNotice] = useState('');

  function flash(msg) { setNotice(msg); setTimeout(() => setNotice(''), 3000); }
  function load() { invalidate('/api/tasks'); refresh(); }

  const mine = useMemo(() => tasks.filter((t) => t.assigneeId === employee.id), [tasks, employee.id]);
  const openCount = useMemo(() => mine.filter((t) => t.status === 'open').length, [mine]);
  const overdueCount = useMemo(() => mine.filter(isOverdue).length, [mine]);
  const doneCount = useMemo(() => mine.filter((t) => t.status === 'done').length, [mine]);

  const filtered = useMemo(() => mine
    .filter((t) => (status === 'all' ? true : t.status === status))
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
      if (!a.dueAt && !b.dueAt) return 0;
      if (!a.dueAt) return 1;
      if (!b.dueAt) return -1;
      return new Date(a.dueAt) - new Date(b.dueAt);
    }), [mine, status]);

  async function toggleDone(t) {
    await fetch(`/api/tasks/${t.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: t.status === 'done' ? 'open' : 'done' }) });
    load();
  }
  async function remove(t) {
    await fetch(`/api/tasks/${t.id}`, { method: 'DELETE' });
    setModal(null);
    load();
    flash('Task removed');
  }

  return (
    <>
      {notice && <div className="dash-notice" style={{ marginBottom: 16 }}>{notice}</div>}

      <div className="kpi-row">
        <div className="kpi-card"><div className="kpi-label">Open</div><div className="kpi-val">{openCount}</div></div>
        <div className="kpi-card"><div className="kpi-label">Overdue</div><div className="kpi-val">{overdueCount}</div></div>
        <div className="kpi-card"><div className="kpi-label">Completed</div><div className="kpi-val">{doneCount}</div></div>
        <div className="kpi-card"><div className="kpi-label">Total</div><div className="kpi-val">{mine.length}</div></div>
      </div>

      <div className="dash-tabs" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button className={`dash-tab${status === 'open' ? ' active' : ''}`} onClick={() => setStatus('open')}>Open</button>
          <button className={`dash-tab${status === 'done' ? ' active' : ''}`} onClick={() => setStatus('done')}>Completed</button>
          <button className={`dash-tab${status === 'all' ? ' active' : ''}`} onClick={() => setStatus('all')}>All</button>
        </div>
        <button className="chip-btn primary" onClick={() => setModal({ type: 'add' })}>+ Add Task</button>
      </div>

      {loading ? (
        <div className="empty-state">Loading your tasks…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">✅</div>
          {mine.length === 0 ? 'No tasks assigned to you yet.' : `Nothing ${status === 'all' ? '' : status} right now.`}
        </div>
      ) : (
        <div className="mt-task-list">
          {filtered.map((t) => {
            const lead = t.leadId ? leads.find((l) => l.id === t.leadId) : null;
            return (
              <div key={t.id} className={`mt-task-row${t.status === 'done' ? ' mt-task-row--done' : ''}${isOverdue(t) ? ' mt-task-row--overdue' : ''}`}>
                <button type="button" className={`mt-task-check${t.status === 'done' ? ' checked' : ''}`} onClick={() => toggleDone(t)}>
                  {t.status === 'done' && <IconTasks size={12} />}
                </button>
                <div className="mt-task-body" onClick={() => setModal({ type: 'edit', task: t })}>
                  <div className="mt-task-title">{t.title}</div>
                  <div className="mt-task-meta">
                    {t.dueAt ? <>{isOverdue(t) ? 'Overdue — ' : ''}{fmtDate(t.dueAt)}</> : 'No due date'}
                    {lead && <> · {lead.name}</>}
                  </div>
                </div>
                <span className="mt-task-priority" style={{ color: PRIORITY_COLOR[t.priority], background: `${PRIORITY_COLOR[t.priority]}1a` }}>{PRIORITY_LABEL[t.priority] || 'Medium'}</span>
                <button type="button" className="dash-icon-btn" onClick={() => remove(t)}><IconX size={14} /></button>
              </div>
            );
          })}
        </div>
      )}

      {(modal?.type === 'add' || modal?.type === 'edit') && (
        <TaskModal
          task={modal.task}
          employee={employee}
          leads={leads}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); load(); flash(modal.type === 'add' ? 'Task added' : 'Task updated'); }}
        />
      )}
    </>
  );
}

function TaskModal({ task = null, employee, leads, onClose, onDone }) {
  const editing = !!task;
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [dueAt, setDueAt] = useState(task?.dueAt ? task.dueAt.slice(0, 10) : '');
  const [priority, setPriority] = useState(task?.priority || 'medium');
  const [leadQuery, setLeadQuery] = useState('');
  const [leadId, setLeadId] = useState(task?.leadId || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedLead = leads.find((l) => l.id === leadId) || null;
  const leadMatches = leadQuery.trim().length > 0
    ? leads.filter((l) => `${l.name} ${l.phone}`.toLowerCase().includes(leadQuery.trim().toLowerCase())).slice(0, 6)
    : [];

  async function submit() {
    if (!title.trim()) { setError('Title is required'); return; }
    setError(''); setSaving(true);
    try {
      const body = { title, description, assigneeId: employee.id, dueAt: dueAt || null, priority, leadId: leadId || null };
      const url = editing ? `/api/tasks/${task.id}` : '/api/tasks';
      const res = await fetch(url, { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      onDone();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">
        <div className="modal-title">{editing ? 'Edit task' : 'Add task'}</div>
        <div className="modal-sub">Just for you — this won&rsquo;t show up on a teammate&rsquo;s list.</div>

        <div className="lf-field"><label className="lf-label">Title</label><input className="lf-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Call back about pending quotation" /></div>
        <div className="lf-field"><label className="lf-label">Description (optional)</label><input className="lf-input" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="lf-field" style={{ flex: 1 }}><label className="lf-label">Due date (optional)</label><input className="lf-input" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></div>
          <div className="lf-field" style={{ flex: 1 }}>
            <label className="lf-label">Priority</label>
            <select className="lf-input" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
            </select>
          </div>
        </div>
        <div className="lf-field">
          <label className="lf-label">Linked lead (optional)</label>
          {selectedLead ? (
            <div className="mt-lead-chip">{selectedLead.name} · {selectedLead.phone} <button type="button" onClick={() => setLeadId('')}><IconX size={12} /></button></div>
          ) : (
            <>
              <input className="lf-input" value={leadQuery} onChange={(e) => setLeadQuery(e.target.value)} placeholder="Search by lead name or phone…" />
              {leadMatches.length > 0 && (
                <div className="mt-lead-matches">
                  {leadMatches.map((l) => (
                    <button type="button" key={l.id} className="mt-lead-match" onClick={() => { setLeadId(l.id); setLeadQuery(''); }}>{l.name} · {l.phone}</button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {error && <div className="lf-error">{error}</div>}

        <div className="lf-actions">
          <button className="lf-btn-back" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="lf-btn-next" onClick={submit} disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add task'}</button>
        </div>
      </div>
    </div>
  );
}
