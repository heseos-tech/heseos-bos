// PATCH — mark a chat read, change its Open/Resolved status, toggle the per-chat bot on/off,
// or assign it to a team member. Scoped to the signed-in tenant so one tenant can never touch
// another tenant's conversations.

import { dbPatch, dbGetById } from '@/lib/db';
import { getBotTenant } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PATCH(request, { params }) {
  const tenant = await getBotTenant();
  if (!tenant) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const chatId = decodeURIComponent(id);

  const existing = await dbGetById('bot_chats', chatId);
  if (!existing || existing.tenantId !== tenant.id) return Response.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const patch = {};
  if (body.markRead) patch.unread = 0;
  if (body.status && ['open', 'resolved'].includes(body.status)) patch.status = body.status;
  if (typeof body.botOn === 'boolean') patch.botOn = body.botOn;
  if (body.assign) patch.assignedTo = tenant.contactName || tenant.businessName;
  if (body.unassign) patch.assignedTo = null;

  const updated = await dbPatch('bot_chats', chatId, patch);
  return Response.json(updated);
}
