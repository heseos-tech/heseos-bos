// app/api/tasks/[id]/route.js — edit, complete/reopen, or remove one task. Any logged-in
// employee can act on any task (same open-team-board trust level as the list/create route),
// not just the assignee or creator — mirrors how any employee can already update any lead.
import { dbGetById, dbPatch, dbDelete } from '@/lib/db';
import { getEmployee } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const PRIORITIES = new Set(['low', 'medium', 'high']);

export async function PATCH(request, { params }) {
  const employee = await getEmployee();
  if (!employee) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const existing = await dbGetById('tasks', id);
  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const patch = { updatedAt: new Date().toISOString() };

  if (body.title !== undefined) {
    const title = String(body.title || '').trim();
    if (!title) return Response.json({ error: 'Title cannot be empty' }, { status: 400 });
    patch.title = title;
  }
  if (body.description !== undefined) patch.description = body.description || '';
  if (body.assigneeId !== undefined) patch.assigneeId = body.assigneeId || employee.id;
  if (body.dueAt !== undefined) patch.dueAt = body.dueAt || null;
  if (body.leadId !== undefined) patch.leadId = body.leadId || null;
  if (body.priority !== undefined && PRIORITIES.has(body.priority)) patch.priority = body.priority;
  if (body.status !== undefined) {
    if (body.status !== 'open' && body.status !== 'done') {
      return Response.json({ error: 'status must be "open" or "done"' }, { status: 400 });
    }
    patch.status = body.status;
    patch.completedAt = body.status === 'done' ? new Date().toISOString() : null;
  }

  const updated = await dbPatch('tasks', id, patch);
  return Response.json(updated);
}

export async function DELETE(request, { params }) {
  const employee = await getEmployee();
  if (!employee) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const ok = await dbDelete('tasks', id);
  if (!ok) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ success: true });
}
