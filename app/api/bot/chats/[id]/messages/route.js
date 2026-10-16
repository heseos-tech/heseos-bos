// GET the message history for one chat; POST an outbound reply from the console (the tenant's
// side of the conversation — same idea as components/InboxView.jsx's send() for Heseos's own
// single-number Team Inbox, just scoped to a bot_tenant instead of an employee).

import { dbWhere, dbInsert, dbPatch, dbGetById } from '@/lib/db';
import { getBotTenant } from '@/lib/auth';
import { botSendText, botSendTemplate } from '@/lib/botWhatsapp';
import { renderTemplate, paramCount } from '@/lib/botTemplates';

export const dynamic = 'force-dynamic';

async function loadChat(id, tenantId) {
  const chat = await dbGetById('bot_chats', id);
  return chat && chat.tenantId === tenantId ? chat : null;
}

export async function GET(request, { params }) {
  const tenant = await getBotTenant();
  if (!tenant) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const chatId = decodeURIComponent(id);
  const chat = await loadChat(chatId, tenant.id);
  if (!chat) return Response.json({ error: 'Not found' }, { status: 404 });

  const messages = await dbWhere('bot_messages', 'chatId', chatId);
  messages.sort((a, b) => new Date(a.ts || 0) - new Date(b.ts || 0));
  return Response.json(messages);
}

export async function POST(request, { params }) {
  const tenant = await getBotTenant();
  if (!tenant) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const chatId = decodeURIComponent(id);
  const chat = await loadChat(chatId, tenant.id);
  if (!chat) return Response.json({ error: 'Not found' }, { status: 404 });

  const payload = await request.json().catch(() => ({}));

  // Template send (Inbox -> Template button): works outside the 24h window, unlike plain text.
  if (payload.template && payload.template.name) {
    const { name, language = 'en_US', body: tplBody = '' } = payload.template;
    const params = Array.isArray(payload.template.params) ? payload.template.params.map((p) => String(p ?? '').trim()) : [];
    if (params.length < paramCount(tplBody) || params.slice(0, paramCount(tplBody)).some((p) => !p)) {
      return Response.json({ error: 'Fill in every variable before sending' }, { status: 400 });
    }
    const now = new Date().toISOString();
    const msgId = `${chatId}_M${Date.now()}`;
    const sender = tenant.contactName || tenant.businessName || 'Agent';
    const logBody = renderTemplate(tplBody, params) || `[Template: ${name}]`;
    const sent = await botSendTemplate({ phoneNumberId: tenant.waPhoneNumberId, token: tenant.waAccessToken }, chatId, { name: String(name), language: String(language), params });
    await dbInsert('bot_messages', msgId, {
      id: msgId, tenantId: tenant.id, chatId, direction: 'out', body: logBody, ts: now, sender,
      status: sent.ok ? 'sent' : 'failed', error: sent.ok ? null : sent.error,
    });
    await dbPatch('bot_chats', chatId, { lastText: logBody, lastAt: now, unread: 0, assignedTo: chat.assignedTo || sender });
    return Response.json({ success: true, id: msgId, delivered: sent.ok, error: sent.ok ? null : sent.error });
  }

  const { text } = payload;
  const body = String(text || '').trim();
  if (!body) return Response.json({ error: 'text is required' }, { status: 400 });

  const now = new Date().toISOString();
  const msgId = `${chatId}_M${Date.now()}`;
  const sender = tenant.contactName || tenant.businessName || 'Agent';

  // Actually deliver it over WhatsApp using this tenant's own connected number — falls back to
  // recording the message with status 'failed' (visible in the thread, never silently dropped)
  // when the tenant hasn't connected a WhatsApp number yet, same as any other send failure.
  const sent = await botSendText({ phoneNumberId: tenant.waPhoneNumberId, token: tenant.waAccessToken }, chatId, body);

  await dbInsert('bot_messages', msgId, {
    id: msgId, tenantId: tenant.id, chatId, direction: 'out', body, ts: now, sender,
    status: sent.ok ? 'sent' : 'failed', error: sent.ok ? null : sent.error,
  });
  await dbPatch('bot_chats', chatId, { lastText: body, lastAt: now, unread: 0, assignedTo: chat.assignedTo || sender });

  return Response.json({ success: true, id: msgId, delivered: sent.ok, error: sent.ok ? null : sent.error });
}
