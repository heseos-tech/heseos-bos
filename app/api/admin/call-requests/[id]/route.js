// Admin -> Call Requests: change status (new / called / closed) and/or save a note for one request.
import { dbGetById, dbPatch } from '@/lib/db';
import { getEmployee } from '@/lib/auth';
import { CALL_REQUEST_STATUSES } from '@/lib/heseosCallRequests';

export const dynamic = 'force-dynamic';

export async function PATCH(request, { params }) {
  const employee = await getEmployee();
  if (!employee) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const existing = await dbGetById('call_requests', id);
  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const now = new Date().toISOString();
  const by = employee.name || 'Admin';
  const patch = { updatedAt: now };
  const history = [...(existing.history || [])];

  if (body.status !== undefined) {
    if (!CALL_REQUEST_STATUSES.includes(body.status)) {
      return Response.json({ error: `Unknown status "${body.status}"` }, { status: 400 });
    }
    if (body.status !== existing.status) {
      patch.status = body.status;
      history.push({ event: `Marked ${body.status}`, at: now, by });
      if (body.status === 'called') patch.calledAt = now;
      if (body.status === 'closed') patch.closedAt = now;
    }
  }
  if (typeof body.notes === 'string' && body.notes !== (existing.notes || '')) {
    patch.notes = body.notes.slice(0, 2000);
    history.push({ event: 'Note updated', at: now, by });
  }
  if (history.length !== (existing.history || []).length) patch.history = history;
  const updated = await dbPatch('call_requests', id, patch);
  return Response.json(updated);
}
