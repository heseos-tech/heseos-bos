import { dbPatch } from '@/lib/db';
import { getEmployee } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// PATCH — mark a chat read and/or claim it (assign to the acting employee).
export async function PATCH(request, { params }) {
  const employee = await getEmployee();
  if (!employee) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const patch = {};
  if (body.markRead) patch.unread = 0;
  if (body.claim) { patch.assignedTo = employee.id; patch.assignedToName = employee.name || employee.email; }

  const updated = await dbPatch('wa_chats', decodeURIComponent(id), patch);
  if (!updated) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json(updated);
}
