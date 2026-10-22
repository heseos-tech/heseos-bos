// GET the message history for one chat; POST an outbound reply from the console (the tenant's
// side of the conversation — same idea as components/InboxView.jsx's send() for Heseos's own
// single-number Team Inbox, just scoped to a bot_tenant instead of an employee).

import { dbWhere, dbInsert, dbPatch, dbGetById } from '@/lib/db';
import { getBotTenant } from '@/lib/auth';
import { botSendText, botSendTemplate, botSendDocument, botSendImageBuffer } from '@/lib/botWhatsapp';
import { saveBotMedia, safeFilename, MAX_SEND_BYTES, SEND_IMAGE_MIMES, SEND_DOC_MIMES } from '@/lib/botMedia';
import { renderTemplate, paramCount } from '@/lib/botTemplates';
import { getHeseosBotTenant } from '@/lib/attribution';
import { findOrderForChat, buildInstallBookingToken } from '@/lib/installBooking';

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

  // File send (Inbox -> paperclip): a multipart form with `file` (JPG/PNG image or PDF) and an optional
  // `caption`. Free-form files only go out inside WhatsApp's 24h customer-service window — outside it
  // the team has to open the chat with an approved template first.
  if ((request.headers.get('content-type') || '').toLowerCase().includes('multipart/form-data')) {
    const form = await request.formData().catch(() => null);
    const file = form?.get('file');
    if (!file || typeof file === 'string' || !file.size) return Response.json({ error: 'Choose a file to send' }, { status: 400 });
    const mime = String(file.type || '').toLowerCase();
    const isImage = SEND_IMAGE_MIMES.includes(mime);
    const isDoc = SEND_DOC_MIMES.includes(mime);
    if (!isImage && !isDoc) return Response.json({ error: 'Only JPG / PNG images and PDF files can be sent' }, { status: 400 });
    if (file.size > MAX_SEND_BYTES) return Response.json({ error: 'That file is over 4 MB — please send a smaller one' }, { status: 413 });
    const buffer = Buffer.from(await file.arrayBuffer());
    // Trust the contents, not just the label the browser gave the file.
    const head = buffer.subarray(0, 8);
    const okMagic = mime === 'application/pdf' ? head.subarray(0, 4).toString('latin1') === '%PDF'
      : mime === 'image/png' ? head.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      : head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
    if (!okMagic) return Response.json({ error: 'That file does not look like a valid ' + (isDoc ? 'PDF' : 'image') }, { status: 400 });

    const history = await dbWhere('bot_messages', 'chatId', chatId);
    const lastIn = history.filter((x) => x.direction === 'in').reduce((mx, x) => Math.max(mx, new Date(x.ts || 0).getTime()), 0);
    if (!lastIn || Date.now() - lastIn > 24 * 60 * 60 * 1000) {
      return Response.json({ error: "This customer hasn't messaged in the last 24 hours, so WhatsApp only allows approved templates. Send a template first — once they reply you can attach files." }, { status: 409 });
    }

    const caption = String(form.get('caption') || '').trim().slice(0, 1000);
    const filename = safeFilename(file.name, isImage ? 'image.jpg' : 'document.pdf');
    const creds = { phoneNumberId: tenant.waPhoneNumberId, token: tenant.waAccessToken };
    const sent = isImage
      ? await botSendImageBuffer(creds, chatId, { buffer, filename, mimeType: mime, caption })
      : await botSendDocument(creds, chatId, { buffer, filename, mimeType: mime, caption });
    const now = new Date().toISOString();
    const msgId = `${chatId}_M${Date.now()}`;
    const sender = tenant.contactName || tenant.businessName || 'Agent';
    const media = await saveBotMedia(tenant.id, { buffer, mime, filename, type: isImage ? 'image' : 'document' });
    const logBody = caption || (isImage ? '[image]' : '[document]');
    await dbInsert('bot_messages', msgId, {
      id: msgId, tenantId: tenant.id, chatId, direction: 'out', body: logBody, ts: now, sender, media,
      status: sent.ok ? 'sent' : 'failed', error: sent.ok ? null : sent.error,
    });
    await dbPatch('bot_chats', chatId, { lastText: caption || (isImage ? '📷 Photo' : `📄 ${filename}`), lastAt: now, unread: 0, assignedTo: chat.assignedTo || sender });
    return Response.json({ success: true, id: msgId, delivered: sent.ok, error: sent.ok ? null : sent.error });
  }

  const payload = await request.json().catch(() => ({}));

  // Template send (Inbox -> Template button): works outside the 24h window, unlike plain text.
  if (payload.template && payload.template.name) {
    const { name, language = 'en_US', body: tplBody = '' } = payload.template;
    const params = Array.isArray(payload.template.params) ? payload.template.params.map((p) => String(p ?? '').trim()) : [];
    if (params.length < paramCount(tplBody) || params.slice(0, paramCount(tplBody)).some((p) => !p)) {
      return Response.json({ error: 'Fill in every variable before sending' }, { status: 400 });
    }
    // "Book installation" button templates: the URL variable is this customer's signed booking token,
    // built here (never taken from the browser). HESEOS's own bot only, and only for an order that
    // belongs to this chat's phone number and can still be booked.
    let buttons = [];
    let buttonLabel = '';
    if (payload.template.bookingButton) {
      const heseos = await getHeseosBotTenant();
      if (!heseos || heseos.id !== tenant.id) return Response.json({ error: 'This template is only available on the HESEOS account' }, { status: 403 });
      const found = await findOrderForChat(chatId, params[1]);
      if (!found || found.order.id !== params[1]) return Response.json({ error: 'That order ID does not belong to this customer' }, { status: 400 });
      if (found.blocked) return Response.json({ error: found.blocked }, { status: 409 });
      buttons = [{ type: 'url', text: buildInstallBookingToken(found.order.id) }];
      buttonLabel = String(payload.template.buttonLabel || 'Book installation').slice(0, 25);
    }
    const now = new Date().toISOString();
    const msgId = `${chatId}_M${Date.now()}`;
    const sender = tenant.contactName || tenant.businessName || 'Agent';
    const logBody = (renderTemplate(tplBody, params) || `[Template: ${name}]`) + (buttons.length ? `\n\n[ ${buttonLabel} ]` : '');
    const sent = await botSendTemplate({ phoneNumberId: tenant.waPhoneNumberId, token: tenant.waAccessToken }, chatId, { name: String(name), language: String(language), params, buttons });
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
