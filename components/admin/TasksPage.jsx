'use client';
// Admin -> Tasks: assignable follow-up tasks/reminders for the team. Any employee sees and can
// act on the full board (app/api/tasks's header explains the trust model), so this is the
// whole-team view; each employee's own filtered "My Tasks" list lives on /employee and the
// Team App (components/employee/MyTasksPanel.jsx / components/team/TasksScreen.jsx), reusing
// the same API.
import { useMemo, useState } from 'react';
import { fmtDate } from '@/lib/date';
import { StatCard, Modal } from './ui';
import { IconSearch, IconPlus, IconTasks, IconConversions, IconDemo, IconTrash, IconX } from './icons';
import { useApiResource, invalidate } from '@/lib/useApiResource';

const PRIORITY_LABEL = { low: 'Low', medium: 'Medium', high: 'High' };
const PRIORITY_COLOR = { low: '#6b7e96', medium: '#d97706', high: '#dc2626' };

function isOverdue(t) {
  return t.status === 'open' && t.dueAt && new Date(t.dueAt) < new Date(new Date().toDateString());
}
function isDueToday(t) {
  if (!t.dueAt) return false;
  const d = new Date(t.dueAt).toDateString();
  return d === new Date().toDateString();
}

export default function TasksPage() {
  const { data: tasks, loading, refresh } = useApiResource('/api/tasks');
  const { data: employees } = useApiResource('/api/admin/employees');
  const { data: leads } = useApiResource('/api/leads');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('open');
  const [assignee, setAssignee] = useState('all');
  const [modal, setModal] = useState(null); // { type: 'add'|'edit', task }
  const [notice, setNotice] = useState('');

  function flash(msg) { setNotice(msg); setTimeout(() => setNotice(''), 3000); }
  function load() { invalidate('/api/tasks'); refresh(); }
  function nameOf(id) { return employees.find((e) => e.id === id)?.name || 'Unassigned'; }
  function leadOf(id) { return leads.find((l) => l.id === id) || null; }

  const openCount = tasks.filter((t) => t.status === 'open').length;
  const overdueCount = tasks.filter(isOverdue).length;
  const dueTodayCount = tasks.filter(isDueToday).length;
  const doneCount = tasks.filter((t) => t.status === 'done').length;

  const filtered = useMemo(() => tasks.filter((t) => {
    if (status === 'open' && t.status !== 'open') return false;
    if (status === 'done' && t.status !== 'done') return false;
    if (assignee !== 'all' && t.assigneeId !== assignee) return false;
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      if (!(`${t.title} ${t.description || ''}`.toLowerCase().includes(s))) return false;
    }
    return true;
  }).sort((a, b) => {
    if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
    if (!a.dueAt && !b.dueAt) return 0;
    if (!a.dueAt) return 1;
    if (!b.dueAt) return -1;
    return new Date(a.dueAt) - new Date(b.dueAt);
  }), [tasks, status, assignee, q]);

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
      <div className="adm-page-head">
        <div><h1 className="adm-h1">Tasks</h1><p className="adm-page-sub">Assignable follow-ups and reminders for your team</p></div>
        <div className="adm-page-head-actions">
          <button className="adm-btn-primary" onClick={() => setModal({ type: 'add' })}><IconPlus size={15} /> Add Task</button>
        </div>
      </div>

      {notice && <div className="adm-notice">{notice}</div>}

      <div className="adm-stat-row">
        <StatCard label="Open" value={openCount} Icon={IconTasks} tone="orange" />
        <StatCard label="Overdue" value={overdueCount} Icon={IconDemo} tone="purple" />
        <StatCard label="Due Today" value={dueTodayCount} Icon={IconDemo} tone="teal" />
        <StatCard label="Completed" value={doneCount} Icon={IconConversions} tone="green" />
      </div>

      <div className="adm-card">
        <div className="adm-toolbar">
          <div className="adm-search adm-search--inline"><IconSearch size={16} /><input placeholder="Search tasks…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="open">Open</option><option value="done">Completed</option><option value="all">All</option>
          </select>
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="all">Everyone</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>

        <div className="task-list">
          {loading ? (
            <div className="adm-empty">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="adm-empty">No tasks match these filters.</div>
          ) : filtered.map((t) => {
            const lead = t.leadId ? leadOf(t.leadId) : null;
            return (
              <div key={t.id} className={`task-row${t.status === 'done' ? ' task-row--done' : ''}${isOverdue(t) ? ' task-row--overdue' : ''}`}>
                <button type="button" className={`task-check${t.status === 'done' ? ' checked' : ''}`} onClick={() => toggleDone(t)}>
                  {t.status === 'done' && <IconConversions size={13} />}
                </button>
                <div className="task-row-body" onClick={() => setModal({ type: 'edit', task: t })}>
                  <div className="task-row-title">{t.title}</div>
                  <div className="task-row-meta">
                    {nameOf(t.assigneeId)}
                    {t.dueAt && <> · {isOverdue(t) ? 'Overdue — ' : ''}{fmtDate(t.dueAt)}</>}
                    {lead && <> · {lead.name}</>}
                  </div>
                </div>
                <span className="task-priority" style={{ color: PRIORITY_COLOR[t.priority], background: `${PRIORITY_COLOR[t.priority]}1a` }}>{PRIORITY_LABEL[t.priority] || 'Medium'}</span>
                <button type="button" className="adm-icon-btn" onClick={() => remove(t)}><IconTrash size={15} /></button>
              </div>
            );
          })}
        </div>
      </div>

      {(modal?.type === 'add' || modal?.type === 'edit') && (
        <TaskModal
          task={modal.task}
          employees={employees}
          leads={leads}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); load(); flash(modal.type === 'add' ? 'Task added' : 'Task updated'); }}
        />
      )}
    </>
  );
}

function TaskModal({ task = null, employees, leads, onClose, onDone }) {
  const editing = !!task;
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId || employees[0]?.id || '');
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
      const body = { title, description, assigneeId, dueAt: dueAt || null, priority, leadId: leadId || null };
      const url = editing ? `/api/tasks/${task.id}` : '/api/tasks';
      const res = await fetch(url, { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      onDone();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return (
    <Modal title={editing ? 'Edit task' : 'Add task'} onClose={onClose}>
      <div className="lf-field"><label className="lf-label">Title</label><input className="lf-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Follow up on pending quotation" /></div>
      <div className="lf-field"><label className="lf-label">Description (optional)</label><textarea className="lf-input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      <div className="lf-field-row">
        <div className="lf-field">
          <label className="lf-label">Assign to</label>
          <select className="lf-input" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div className="lf-field"><label className="lf-label">Due date (optional)</label><input className="lf-input" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></div>
      </div>
      <div className="lf-field">
        <label className="lf-label">Priority</label>
        <select className="lf-input" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
        </select>
      </div>
      <div className="lf-field">
        <label className="lf-label">Linked lead (optional)</label>
        {selectedLead ? (
          <div className="task-lead-chip">{selectedLead.name} · {selectedLead.phone} <button type="button" onClick={() => setLeadId('')}><IconX size={12} /></button></div>
        ) : (
          <>
            <input className="lf-input" value={leadQuery} onChange={(e) => setLeadQuery(e.target.value)} placeholder="Search by lead name or phone…" />
            {leadMatches.length > 0 && (
              <div className="task-lead-matches">
                {leadMatches.map((l) => (
                  <button type="button" key={l.id} className="task-lead-match" onClick={() => { setLeadId(l.id); setLeadQuery(''); }}>{l.name} · {l.phone}</button>
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
    </Modal>
  );
}
