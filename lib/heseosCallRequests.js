// "Call Requests" — a customer on WhatsApp who taps "Talk to someone" / "Talk to our team" is
// asking for a phone call, NOT enquiring about a smart home yet. So the number goes into its own
// queue (Admin -> Call Requests) instead of becoming a lead in the sales pipeline. If the same
// person later fills the Home Automation form, the landing page creates a proper lead then.
//
// Called from lib/botFlowEngine.js's endHandoff for handoff nodes flagged `callRequest: true`.
// One OPEN request per phone number: a second tap while the first is still "new" just bumps its
// counter and timestamp, so an impatient customer doesn't flood the queue.

import { dbInsert, dbList, dbPatch } from '@/lib/db';
import { normalizePhone } from '@/lib/leadOrigin';

export const CALL_REQUEST_STATUSES = ['new', 'called', 'closed'];

export async function createHeseosCallRequest(chat) {
  const phone = chat?.phone;
  if (!phone) return null;
  const key = normalizePhone(phone);
  const now = new Date().toISOString();
  const all = await dbList('call_requests');
  const open = all.find((r) => r.status === 'new' && normalizePhone(r.phone) === key);
  if (open) {
    const history = [...(open.history || []), { event: 'Asked for a call again', at: now, by: 'WhatsApp' }];
    return dbPatch('call_requests', open.id, {
      requestCount: (open.requestCount || 1) + 1,
      lastRequestedAt: now,
      leadId: open.leadId || chat.leadId || null,
      history,
      updatedAt: now,
    });
  }
  const id = `CR-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const request = {
    id,
    phone,
    name: chat.answers?.name || chat.name || '',
    chatId: chat.id || null,
    leadId: chat.leadId || null,
    hasLead: !!(chat.hasLead || chat.leadId),
    hasOrder: !!chat.hasOrder,
    attributionKind: chat.attributionKind || null,
    attributionLinkId: chat.attributionLinkId || null,
    source: 'whatsapp',
    status: 'new',
    requestCount: 1,
    notes: '',
    history: [{ event: 'Asked to talk to our team on WhatsApp', at: now, by: 'WhatsApp' }],
    createdAt: now,
    lastRequestedAt: now,
    updatedAt: now,
  };
  await dbInsert('call_requests', id, request);
  return request;
}
