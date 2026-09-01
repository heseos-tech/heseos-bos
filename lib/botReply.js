// Shared "the bot sends one WhatsApp message" helper — used by every conversation engine on the
// Heseos Bot platform: lib/botEngine.js (the fixed welcome/menu flow driven by Bot
// Configuration) and lib/botFlowEngine.js (a tenant's own self-built visual flow). Sends via the
// tenant's own WhatsApp credentials, persists the message exactly like a human-sent one so the
// Inbox thread (components/bot/InboxScreen.jsx) shows one continuous conversation either way,
// and updates the chat's lastText/lastAt preview.
import { dbInsert, dbPatch } from '@/lib/db';
import { botSendText } from '@/lib/botWhatsapp';

export async function botReply(tenant, chat, body) {
  const creds = { phoneNumberId: tenant.waPhoneNumberId, token: tenant.waAccessToken };
  const res = await botSendText(creds, chat.phone, body);
  const now = new Date().toISOString();
  const id = res.id || `${chat.id}_B${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await dbInsert('bot_messages', id, {
    id, tenantId: tenant.id, chatId: chat.id, direction: 'out', body, ts: now,
    status: res.ok ? 'sent' : 'failed', sender: 'bot', error: res.ok ? null : res.error,
  });
  await dbPatch('bot_chats', chat.id, { lastText: body, lastAt: now });
  return res;
}
