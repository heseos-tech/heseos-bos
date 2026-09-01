// Leads captured by the tenant's bot — any bot_chats row with a `lead` object attached (set once
// a chat's Quick Menu selection or Flow Builder path marks it qualified — see lib/botEngine.js /
// lib/botFlowEngine.js). This is every tenant's OWN simple lead list, scoped to bot_chats —
// separate from and never synced with Heseos's real Leads CRM (the `leads` table), which only
// ever receives a copy when the tenant is Heseos's own in-house bot (see
// app/api/bot/webhook's linkToHeseosLeads / botKind check). A white-label tenant's leads live
// here and only here.
//
// GET lists them. PATCH lets the tenant mark a lead's status and/or send that customer a
// WhatsApp update — two independent actions in one call: `status` alone just relabels the lead,
// `notify: true` with a `message` sends it (regardless of whether status also changed), so a
// tenant can nudge a customer without necessarily changing their stage.
import { dbGetById, dbPatch, dbWhere } from '@/lib/db';
import { getBotTenant } from '@/lib/auth';
import { botReply } from '@/lib/botReply';

export const dynamic = 'force-dynamic';

const STATUSES = ['new', 'contacted', 'qualified', 'converted'];

export async function GET() {
  const tenant = await getBotTenant();
  if (!tenant) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const chats = await dbWhere('bot_chats', 'tenantId', tenant.id);
  const leads = chats
    .filter((c) => c.lead)
    .map((c) => ({ chatId: c.id, name: c.name, phone: c.phone, city: c.city, status: c.lead.status, capturedAt: c.firstMessageAt, notifiedAt: c.lead.notifiedAt || null }))
    .sort((a, b) => new Date(b.capturedAt || 0) - new Date(a.capturedAt || 0));
  return Response.json(leads);
}

export async function PATCH(request) {
  const tenant = await getBotTenant();
  if (!tenant) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const chatId = String(body.chatId || '');
  if (!chatId) return Response.json({ error: 'chatId is required' }, { status: 400 });

  const chat = await dbGetById('bot_chats', chatId);
  if (!chat || chat.tenantId !== tenant.id || !chat.lead) return Response.json({ error: 'Not found' }, { status: 404 });

  let lead = chat.lead;
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return Response.json({ error: `status must be one of: ${STATUSES.join(', ')}` }, { status: 400 });
    lead = { ...lead, status: body.status, statusUpdatedAt: new Date().toISOString() };
    await dbPatch('bot_chats', chatId, { lead });
  }

  if (body.notify === true) {
    const message = String(body.message || '').trim();
    if (!message) return Response.json({ error: 'message is required to notify a customer' }, { status: 400 });
    await botReply(tenant, { ...chat, phone: chat.phone }, message);
    lead = { ...lead, notifiedAt: new Date().toISOString() };
    await dbPatch('bot_chats', chatId, { lead });
  }

  return Response.json({ chatId, name: chat.name, phone: chat.phone, city: chat.city, status: lead.status, capturedAt: chat.firstMessageAt, notifiedAt: lead.notifiedAt || null });
}
