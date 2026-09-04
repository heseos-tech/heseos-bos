// PATCH — mark a chat read, change its Open/Resolved status, toggle the per-chat bot on/off,
// assign it to a team member, or reset the bot's conversation state. Scoped to the signed-in
// tenant so one tenant can never touch another tenant's conversations.

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
  if (typeof body.botOn === 'boolean') {
    patch.botOn = body.botOn;
    // A human deliberately touching this toggle — either direction — always wins over the
    // "auto-handoff" bookkeeping lib/botFlowEngine.js's endHandoff uses to know it's safe to
    // wake the bot back up on the customer's next "hi" (see app/api/bot/webhook/route.js). Once
    // a person has looked at this chat and made a call, that decision sticks until they (or a
    // fresh flow completion) change it again — the webhook must never override it.
    patch.autoHandoff = false;
  }
  if (body.assign) patch.assignedTo = tenant.contactName || tenant.businessName;
  if (body.unassign) patch.assignedTo = null;
  // Resets the bot's conversation STATE only — the message transcript, the linked lead (leadId),
  // and how this chat was originally attributed (attributionKind/attributionLinkId/referrerNote)
  // are all left untouched. Deliberately does NOT clear activeFlowId: the next inbound message
  // then restarts from that same flow's Start node (lib/botFlowEngine.js's runFlowTurn already
  // treats a null flowNodeId as "begin the active flow again") instead of falling back to the
  // plain welcome/menu engine, which is what would happen if activeFlowId were cleared here too.
  // Useful while testing a flow (Bot Console → Flow Builder) — send "hi" again on the same test
  // number without waiting for a new phone number or manually editing the database.
  if (body.resetBot === true) {
    patch.stage = null;
    patch.flowNodeId = null;
    patch.answers = {};
    patch.menuRetries = 0;
    patch.answerRetries = 0;
    patch.botOn = true;
    patch.autoHandoff = false;
    patch.status = 'open';
  }

  const updated = await dbPatch('bot_chats', chatId, patch);
  return Response.json(updated);
}
