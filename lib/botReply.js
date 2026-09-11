// Shared "the bot sends one WhatsApp message" helper — used by every conversation engine on the
// Heseos Bot platform: lib/botEngine.js (the fixed welcome/menu flow driven by Bot
// Configuration) and lib/botFlowEngine.js (a tenant's own self-built visual flow). Sends via the
// tenant's own WhatsApp credentials, persists the message exactly like a human-sent one so the
// Inbox thread (components/bot/InboxScreen.jsx) shows one continuous conversation either way,
// and updates the chat's lastText/lastAt preview.
import { dbInsert, dbPatch } from '@/lib/db';
import { botSendText, botSendButtons, botSendList } from '@/lib/botWhatsapp';

// `body` is always the plain-text version persisted to bot_messages and shown in the Inbox
// transcript (components/bot/InboxScreen.jsx) — the admin record reads the same whether a
// message actually went out as plain text or as tappable buttons/a list. Passing
// `options.buttons` or `options.list` (see lib/botMenu.js) sends WhatsApp's native interactive
// message instead of plain text; `options.sendText`, when given, is what that interactive
// message's own (usually shorter) body reads — otherwise `body` itself is reused for both.
export async function botReply(tenant, chat, body, options = {}) {
  const creds = { phoneNumberId: tenant.waPhoneNumberId, token: tenant.waAccessToken };
  const sendText = options.sendText != null ? options.sendText : body;
  let res;
  if (options.buttons && options.buttons.length) {
    res = await botSendButtons(creds, chat.phone, { body: sendText, buttons: options.buttons });
  } else if (options.list && options.list.rows && options.list.rows.length) {
    res = await botSendList(creds, chat.phone, { body: sendText, buttonLabel: options.list.buttonLabel, rows: options.list.rows });
  } else {
    res = await botSendText(creds, chat.phone, body);
  }
  const now = new Date().toISOString();
  const id = res.id || `${chat.id}_B${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await dbInsert('bot_messages', id, {
    id, tenantId: tenant.id, chatId: chat.id, direction: 'out', body, ts: now,
    status: res.ok ? 'sent' : 'failed', sender: 'bot', error: res.ok ? null : res.error,
  });
  await dbPatch('bot_chats', chat.id, { lastText: body, lastAt: now });
  return res;
}
