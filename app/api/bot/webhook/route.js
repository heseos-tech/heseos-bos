// The Heseos Bot platform's ONE shared WhatsApp webhook — every tenant, Heseos's own in-house
// bot included, configures their own Meta App to call this same URL. That's the whole point of
// "just enter bot configuration and their bot is ready": there is no per-tenant webhook route
// and no per-tenant code path here — every message is routed purely by data (the tenant row
// matching the inbound payload's phone_number_id / verify token), see lib/botWhatsapp.js and
// lib/botEngine.js.

import { dbGetById, dbInsert, dbPatch, dbWhere } from '@/lib/db';
import { parseWebhookByPhone } from '@/lib/botWhatsapp';
import { runBotTurn } from '@/lib/botEngine';
import { runFlowTurn, pickFlow } from '@/lib/botFlowEngine';
import { createLeadFromWhatsApp } from '@/lib/waInbound';
import { parseRefFromText } from '@/lib/attribution';

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

// Resolves a customer's first inbound message to the attribution_links row it was tagged with
// (a `(ref:<code>)` suffix — see app/go/[code] and lib/attribution.js), if any. Used both to
// bridge Heseos's own leads (below) and, generically for every tenant, to know whether a brand
// new chat started from a QR scan / partner link vs. a plain WhatsApp message — see where this
// is called in POST, and lib/botEngine.js's welcomeText().
async function resolveAttributionLink(text) {
  const code = parseRefFromText(text);
  if (!code) return null;
  try {
    const link = await dbGetById('attribution_links', code);
    if (link && link.active !== false) return link;
  } catch (err) {
    console.error('Attribution resolve error:', err);
  }
  return null;
}

// Only Heseos's own tenant has this flag set (a manual, trust-based grant — never something a
// tenant can switch on themselves; it is deliberately left out of EDITABLE_FIELDS in
// app/api/bot/config/route.js). When set, every lead this bot captures also lands in the real,
// shared `leads` table so it shows up in Admin/Partner/Employee exactly like any other lead.
//
// `link` (already resolved by resolveAttributionLink, above, so it isn't looked up twice) is the
// attribution_links row the customer's first message was tagged with, if any — partner QR/referral
// gets partnerId set, so it shows up in that partner's Partner App; location QR / customer
// referral is tracked without a partnerId. No link (untagged / unrecognised ref) just falls back
// to the plain 'whatsapp_bot' source, same as before this existed.
async function bridgeToHeseosLeads(tenant, { phone, name, link }) {
  if (link) {
    return createLeadFromWhatsApp({
      phone, name,
      source: link.kind,
      note: `Heseos Bot via ${link.kind} (${link.label || link.id})`,
      partnerId: link.partnerId || null,
      attributionLinkId: link.id,
      attributionKind: link.kind,
      referredByLeadId: link.customerLeadId || null,
    });
  }
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
      // Defense in depth: a pending/rejected tenant can never actually reach this point in
      // practice (they can't log in to set WhatsApp credentials in the first place — see
      // lib/auth.js's getBotTenant()), but skip explicitly rather than assume that holds forever.
      if (tenant.approvalStatus === 'pending' || tenant.approvalStatus === 'rejected') continue;

      // A tenant can build several flows (components/bot/FlowListScreen.jsx), each switched on
      // and triggered independently — pickFlow (lib/botFlowEngine.js) matches a brand-new chat
      // to whichever one applies (QR scan / referral / keyword / their marked default), and the
      // chat then sticks with that same flow (chat.activeFlowId) for the rest of the
      // conversation. No match at all — including no flows built, or none enabled — falls
      // straight back to the simpler, Bot-Configuration-driven lib/botEngine.js exactly as
      // before Flow Builder existed. Read once per batch, not per message.
      const tenantFlows = await dbWhere('bot_flows', 'tenantId', tenant.id);

      for (const m of g.messages) {
        if (await dbGetById('bot_messages', m.id)) continue; // de-dupe Meta's retries
        await dbInsert('bot_messages', m.id, {
          id: m.id, tenantId: tenant.id, chatId: m.from, direction: 'in', body: m.text, ts: m.ts,
          status: 'received', sender: m.name || null,
        });

        let chat = await dbGetById('bot_chats', m.from);
        let flow = null;
        if (!chat) {
          // Resolved once here (not just for Heseos) so any tenant's first-ever message on a
          // chat can carry a QR-vs-organic signal — used both for pickFlow's attribution match
          // below and lib/botEngine.js's welcomeText(). Today only Heseos's own QR/referral
          // codes exist, so this only ever resolves for Heseos's tenant, but nothing here is
          // Heseos-specific.
          const link = await resolveAttributionLink(m.text);
          const picked = pickFlow(tenantFlows, { attributionKind: link?.kind || null, text: m.text });
          chat = {
            id: m.from, tenantId: tenant.id, phone: m.from, name: m.name || m.from,
            lastText: m.text, lastAt: m.ts, unread: 1, status: 'open', assignedTo: null,
            botOn: true, lead: null, stage: null, menuRetries: 0, city: '',
            attributionKind: link?.kind || null, flowNodeId: null, answers: {}, activeFlowId: picked?.id || null,
            firstMessageAt: m.ts, createdAt: m.ts,
          };
          await dbInsert('bot_chats', m.from, chat);
          if (tenant.botKind === 'heseos' || tenant.linkToHeseosLeads === true) {
            const lead = await bridgeToHeseosLeads(tenant, { phone: m.from, name: m.name, link });
            chat = { ...chat, leadId: lead.id };
            await dbPatch('bot_chats', m.from, { leadId: lead.id });
          }
          flow = picked;
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
          // Once a chat has entered a flow it stays on that same one for its whole
          // conversation — re-matching triggers on every reply would let an unrelated later
          // message ("hi" mid-conversation, say) hijack the chat into a different flow.
          if (chat.activeFlowId) {
            const f = tenantFlows.find((tf) => tf.id === chat.activeFlowId) || null;
            if (f && f.enabled && (f.nodes || []).some((n) => n.type === 'start')) flow = f;
          }
        }

        if (chat.botOn !== false) {
          try {
            if (flow) await runFlowTurn(tenant, flow, chat, m.text);
            else await runBotTurn(tenant, chat, m.text);
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
