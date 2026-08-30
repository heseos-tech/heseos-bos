// The Heseos Bot platform's ONE shared WhatsApp webhook — every tenant, Heseos's own in-house
// bot included, configures their own Meta App to call this same URL. That's the whole point of
// "just enter bot configuration and their bot is ready": there is no per-tenant webhook route
// and no per-tenant code path here — every message is routed purely by data (the tenant row
// matching the inbound payload's phone_number_id / verify token), see lib/botWhatsapp.js and
// lib/botEngine.js.

import { dbGetById, dbInsert, dbPatch, dbWhere } from '@/lib/db';
import { parseWebhookByPhone } from '@/lib/botWhatsapp';
import { runBotTurn } from '@/lib/botEngine';
import { createLeadFromWhatsApp } from '@/lib/waInbound';

export const dynamic = 'force-dynamic';

// GET — Meta's webhook verification handshake, run once per tenant when they paste this URL
// into their own Meta App's webhook config. Each tenant has their own waVerifyToken (generated
// at signup — see app/api/auth/bot/register/route.js), so this checks it against every
// tenant's stored token rather than one global env var.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');
  if (mode !== 'subscribe' || !token) return new Response('Forbidden', { status: 403 });
  const matches = await dbWhere('bot_tenants', 'waVerifyToken', token);
  if (matches.length) return new Response(challenge || '', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  return new Response('Forbidden', { status: 403 });
}

// Only Heseos's own tenant has this flag set (a manual, trust-based grant — never something a
// tenant can switch on themselves; it is deliberately left out of EDITABLE_FIELDS in
// app/api/bot/config/route.js). When set, every lead this bot captures also lands in the real,
// shared `leads` table so it shows up in Admin/Partner/Employee exactly like any other lead.
async function bridgeToHeseosLeads(tenant, { phone, name }) {
  return createLeadFromWhatsApp({ phone, name, source: 'whatsapp_bot', note: `Heseos Bot (${tenant.businessName || tenant.id})` });
}

// POST — every inbound WhatsApp message + delivery status, from every tenant, lands here.
export async function POST(req) {
  const payload = await req.json().catch(() => ({}));
  const groups = parseWebhookByPhone(payload);

  for (const g of groups) {
    try {
      const tenants = await dbWhere('bot_tenants', 'waPhoneNumberId', g.phoneNumberId);
      const tenant = tenants[0];
      if (!tenant) continue; // number not connected to any tenant — nothing we can do with it

      for (const m of g.messages) {
        if (await dbGetById('bot_messages', m.id)) continue; // de-dupe Meta's retries
        await dbInsert('bot_messages', m.id, {
          id: m.id, tenantId: tenant.id, chatId: m.from, direction: 'in', body: m.text, ts: m.ts,
          status: 'received', sender: m.name || null,
        });

        let chat = await dbGetById('bot_chats', m.from);
        if (!chat) {
          chat = {
            id: m.from, tenantId: tenant.id, phone: m.from, name: m.name || m.from,
            lastText: m.text, lastAt: m.ts, unread: 1, status: 'open', assignedTo: null,
            botOn: true, lead: null, stage: null, menuRetries: 0, city: '',
            firstMessageAt: m.ts, createdAt: m.ts,
          };
          await dbInsert('bot_chats', m.from, chat);
          if (tenant.linkToHeseosLeads === true) {
            const lead = await bridgeToHeseosLeads(tenant, { phone: m.from, name: m.name });
            chat = { ...chat, leadId: lead.id };
            await dbPatch('bot_chats', m.from, { leadId: lead.id });
          }
        } else {
          const patch = {
            name: chat.name || m.name || m.from,
            lastText: m.text,
            lastAt: m.ts,
            unread: (Number(chat.unread) || 0) + 1,
            status: 'open',
          };
          await dbPatch('bot_chats', m.from, patch);
          chat = { ...chat, ...patch };
        }

        if (chat.botOn !== false) {
          try {
            await runBotTurn(tenant, chat, m.text);
          } catch (err) {
            console.error('Bot engine error:', err);
          }
        }
      }

      for (const s of g.statuses) {
        try { await dbPatch('bot_messages', s.id, { status: s.status }); } catch { /* not our outbound id — ignore */ }
      }
    } catch (err) {
      console.error('Bot webhook error:', err);
    }
  }

  return Response.json({ received: true });
}
