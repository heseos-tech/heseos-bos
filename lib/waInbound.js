// WhatsApp inbound handler — the QR entry point's other half. A shop QR (see app/wa/[ref])
// opens WhatsApp with a pre-filled "ref:<partnerId>" message; this is what turns that first
// message into a chat + a lead. Simplified from MARG's lib/waInbound.js: Heseos runs one
// WhatsApp number (no white-label brand routing), and there's no automated conversational bot
// here yet — inbound messages land in the Team Inbox for a human to answer. See README for
// how to layer a bot on top later (MARG's lib/waBot.js is the reference for that).

import { dbInsert, dbPatch, dbGetById } from '@/lib/db';
import { parseWebhook, sendText, waConfigured } from '@/lib/whatsapp';
import { istDateStr } from '@/lib/date';
import { pushHistory } from '@/lib/leadStage';

const REF_RE = /ref:([A-Za-z0-9]{3,20})/i;

// `source`/`note` are overridable so the Heseos Bot platform's webhook
// (app/api/bot/webhook/route.js's bridgeToHeseosLeads()) can reuse this exact lead-creation
// logic for Heseos's own in-house bot tenant, while every other WhatsApp entry point keeps its
// own source tag.
export async function createLeadFromWhatsApp({ phone, name, partnerId, source = 'whatsapp_qr', note = 'WhatsApp QR' }) {
  const id = `L${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;
  const now = new Date().toISOString();
  const lead = {
    id,
    createdAt: now,
    date: istDateStr(),
    status: 'new',
    name: name || 'WhatsApp Lead',
    phone,
    email: '',
    city: '',
    postcode: '',
    productInterest: [],
    propertyType: '',
    budget: '',
    timeline: '',
    persona: '',
    source,
    partnerId: partnerId || null,
    contactStage: null,
    demoOutcome: null,
    assignedTo: null,
    salesEngineerId: null,
    history: [],
  };
  lead.history = pushHistory(lead, { event: 'Lead Submitted', by: partnerId ? `partner:${partnerId}` : 'whatsapp', note });
  await dbInsert('leads', id, lead);
  return lead;
}

export async function handleInbound(payload) {
  const { messages, statuses } = parseWebhook(payload);

  for (const m of messages) {
    try {
      if (await dbGetById('wa_messages', m.id)) continue; // de-dupe Meta's retries
      await dbInsert('wa_messages', m.id, { id: m.id, chatId: m.from, direction: 'in', type: m.type, body: m.text, ts: m.ts, status: 'received' });

      const refMatch = String(m.text || '').match(REF_RE);
      const partnerId = refMatch ? refMatch[1] : null;

      const existing = await dbGetById('wa_chats', m.from);
      if (existing) {
        await dbPatch('wa_chats', m.from, {
          name: existing.name || m.name || m.from,
          lastText: m.text,
          lastAt: m.ts,
          unread: (Number(existing.unread) || 0) + 1,
          status: 'open',
          partnerId: existing.partnerId || partnerId || null,
        });
      } else {
        const lead = await createLeadFromWhatsApp({ phone: m.from, name: m.name, partnerId });
        await dbInsert('wa_chats', m.from, {
          id: m.from, phone: m.from, name: m.name || m.from, lastText: m.text, lastAt: m.ts,
          unread: 1, status: 'open', assignedTo: null, partnerId: partnerId || null, leadId: lead.id, createdAt: m.ts,
        });
        // A one-time auto-acknowledgement so the customer isn't left hanging before pre-sales
        // picks up the chat. Only on the very first message of a brand new conversation.
        if (waConfigured()) {
          const ack = 'Thanks for reaching out to Heseos! 🏡 A member of our team will call you shortly to understand your smart home needs.';
          const sent = await sendText(m.from, ack);
          if (sent.ok && sent.id) {
            await dbInsert('wa_messages', sent.id, { id: sent.id, chatId: m.from, direction: 'out', type: 'text', body: ack, ts: new Date().toISOString(), status: 'sent', by: 'auto' });
          }
        }
      }
    } catch (err) {
      console.error('WhatsApp inbound error:', err);
    }
  }

  for (const s of statuses) {
    try { await dbPatch('wa_messages', s.id, { status: s.status }); } catch { /* not our outbound id — ignore */ }
  }
}
