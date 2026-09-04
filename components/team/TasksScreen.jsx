'use client';
// components/team/TasksScreen.jsx — Team-app "My Tasks": the personal slice of the shared team
// task board (see app/api/tasks's header for the trust model) filtered to tasks assigned to the
// current employee, as a bottom-sheet mobile screen. Reached from Home's "My Tasks" card, not a
// bottom-nav tab — the nav is already full at five slots (same reasoning as Catalogue, see
// app/team/(app)/catalogue/page.jsx). Mirrors components/employee/MyTasksPanel.jsx one-for-one
// in behavior (same /api/tasks endpoints, same "assigned to me" filter, same add/toggle/delete
// actions) but is its OWN component built with this app's hp-* classes rather than that one's
// dash-/lf-* classes — a component shared verbatim across those two very different stylesheet
// scopes silently loses its styling outside whichever one it was built against, the exact bug
// fixed on components/shared/QuotationBuilder.jsx earlier this session.
import { useMemo, useState } from 'react';
import { ScreenHeader } from '@/components/partner/ui';
import { IconPlus, IconCheck } from '@/components/partner/icons';
import { IconTasks, IconX, IconTrash } from '@/components/admin/icons';
import { fmtDate } from '@/lib/date';
import { useApiResource, invalidate } from '@/lib/useApiResource';

const PRIORITY_LABEL = { low: 'Low', medium: 'Medium', high: 'High' };
const PRIORITY_COLOR = { low: '#8a97a6', medium: '#f5a524', high: '#ff8484' };

function isOverdue(t) {
  return t.status === 'open' && t.dueAt && new Date(t.dueAt) < new Date(new Date().toDateString());
}

export default function TasksScreen({ employee, backHref = '/team/home' }) {
  const { data: tasks, loading, refresh } = useApiResource('/api/tasks');
  const { data: leads } = useApiResource('/api/leads');
  const [status, setStatus] = useState('open');
  const [modal, setModal] = useState(null); // { type: 'add'|'edit', task }

  function load() { invalidate('/api/tasks'); refresh(); }

  const mine = useMemo(() => tasks.filter((t) => t.assigneeId === employee.id), [tasks, employee.id]);

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

  return (
    <>
      <ScreenHeader title="My Tasks" backHref={backHref} />

      <div className="hp-tabs">
        <button type="button" className={`hp-tab${status === 'open' ? ' active' : ''}`} onClick={() => setStatus('open')}>Open</button>
        <button type="button" className={`hp-tab${status === 'done' ? ' active' : ''}`} onClick={() => setStatus('done')}>Completed</button>
        <button type="button" className={`hp-tab${status === 'all' ? ' active' : ''}`} onClick={() => setStatus('all')}>All</button>
      </div>

      <div style={{ padding: '0 20px 16px' }}>
        <button type="button" className="hp-btn hp-btn-primary hp-btn-block" onClick={() => setModal({ type: 'add' })}>
          <IconPlus size={16} /> Add Task
        </button>
      </div>

      {loading ? (
        <div className="hp-empty"><div className="hp-empty-sub">Loading…</div></div>
      ) : filtered.length === 0 ? (
        <div className="hp-empty">
          <div className="hp-empty-icon"><IconTasks size={24} /></div>
          <div className="hp-empty-title">{mine.length === 0 ? 'No tasks yet' : 'Nothing here'}</div>
          <div className="hp-empty-sub">{mine.length === 0 ? 'Add a follow-up or reminder for yourself.' : `Nothing ${status === 'all' ? '' : status} right now.`}</div>
        </div>
      ) : (
        <div className="hp-task-list">
          {filtered.map((t) => {
            const lead = t.leadId ? leads.find((l) => l.id === t.leadId) : null;
            return (
              <div key={t.id} className={`hp-task-card${t.status === 'done' ? ' hp-task-card--done' : ''}${isOverdue(t) ? ' hp-task-card--overdue' : ''}`}>
                <button type="button" className={`hp-task-check${t.status === 'done' ? ' checked' : ''}`} onClick={() => toggleDone(t)}>
                  {t.status === 'done' && <IconCheck size={13} />}
                </button>
                <div className="hp-task-info" onClick={() => setModal({ type: 'edit', task: t })}>
                  <div className="hp-task-title">{t.title}</div>
                  <div className="hp-task-meta">
                    {t.dueAt ? <>{isOverdue(t) ? 'Overdue — ' : ''}{fmtDate(t.dueAt)}</> : 'No due date'}
                    {lead && <> · {lead.name}</>}
                  </div>
                </div>
                <span className="hp-task-priority" style={{ color: PRIORITY_COLOR[t.priority], background: `${PRIORITY_COLOR[t.priority]}26` }}>{PRIORITY_LABEL[t.priority] || 'Medium'}</span>
              </div>
            );
          })}
        </div>
      )}

      {(modal?.type === 'add' || modal?.type === 'edit') && (
        <TaskSheet
          task={modal.task}
          employee={employee}
          leads={leads}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); load(); }}
        />
      )}
    </>
  );
}

function TaskSheet({ task = null, employee, leads, onClose, onDone }) {
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

  async function remove() {
    setSaving(true);
    try {
      await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
      onDone();
    } finally { setSaving(false); }
  }

  return (
    <div className="hp-sheet-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="hp-sheet">
        <div className="hp-sheet-handle" />
        <div className="hp-sheet-title">{editing ? 'Edit task' : 'Add task'}</div>
        <div className="hp-sheet-sub">Just for you — this won&rsquo;t show up on a teammate&rsquo;s list.</div>

        <div className="hp-field">
          <label className="hp-field-label">Title</label>
          <div className="hp-input-wrap"><input className="hp-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Call back about pending quotation" /></div>
        </div>
        <div className="hp-field">
          <label className="hp-field-label">Description (optional)</label>
          <div className="hp-input-wrap"><input className="hp-input" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="hp-field" style={{ flex: 1 }}>
            <label className="hp-field-label">Due date</label>
            <div className="hp-input-wrap"><input className="hp-input" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></div>
          </div>
          <div className="hp-field" style={{ flex: 1 }}>
            <label className="hp-field-label">Priority</label>
            <div className="hp-input-wrap">
              <select className="hp-input" value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
              </select>
            </div>
          </div>
        </div>
        <div className="hp-field">
          <label className="hp-field-label">Linked lead (optional)</label>
          {selectedLead ? (
            <div className="hp-lead-picker-chip">{selectedLead.name} · {selectedLead.phone} <button type="button" onClick={() => setLeadId('')}><IconX size={12} /></button></div>
          ) : (
            <>
              <div className="hp-input-wrap"><input className="hp-input" value={leadQuery} onChange={(e) => setLeadQuery(e.target.value)} placeholder="Search by lead name or phone…" /></div>
              {leadMatches.length > 0 && (
                <div className="hp-lead-picker-matches">
                  {leadMatches.map((l) => (
                    <button type="button" key={l.id} className="hp-lead-picker-match" onClick={() => { setLeadId(l.id); setLeadQuery(''); }}>{l.name} · {l.phone}</button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {error && <div className="hp-summary-label" style={{ color: '#ff8484', marginBottom: 10 }}>{error}</div>}

        <div className="hp-sheet-actions">
          <button type="button" className="hp-btn hp-btn-outline hp-btn-block" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="hp-btn hp-btn-primary hp-btn-block" onClick={submit} disabled={saving}>{saving ? 'Saving…' : editing ? 'Save' : 'Add'}</button>
        </div>
        {editing && (
          <button type="button" className="hp-btn hp-btn-ghost hp-btn-block" style={{ marginTop: 10, color: '#ff8484' }} onClick={remove} disabled={saving}>
            <IconTrash size={15} /> Delete task
          </button>
        )}
      </div>
    </div>
  );
}
