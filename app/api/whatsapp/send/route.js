// Employee-side reply — sends a plain WhatsApp text to a chat and records it as an outbound
// message. Requires an employee session (the Team Inbox is internal-only).

import { dbInsert, dbPatch, dbGetById } from '@/lib/db';
import { getEmployee } from '@/lib/auth';
import { sendText } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const employee = await getEmployee();
  if (!employee) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { chatId, text } = await request.json();
  if (!chatId || !text || !text.trim()) return Response.json({ error: 'chatId and text are required' }, { status: 400 });

  const chat = await dbGetById('wa_chats', chatId);
  if (!chat) return Response.json({ error: 'Chat not found' }, { status: 404 });

  const result = await sendText(chatId, text.trim());
  if (!result.ok) return Response.json({ error: result.error || 'WhatsApp send failed' }, { status: 502 });

  const now = new Date().toISOString();
  const msgId = result.id || `OUT${Date.now()}${Math.floor(Math.random() * 900 + 100)}`;
  await dbInsert('wa_messages', msgId, { id: msgId, chatId, direction: 'out', type: 'text', body: text.trim(), ts: now, status: 'sent', by: employee.name || employee.email });
  await dbPatch('wa_chats', chatId, { lastText: text.trim(), lastAt: now, unread: 0, assignedTo: chat.assignedTo || employee.id });

  return Response.json({ success: true, id: msgId });
}
