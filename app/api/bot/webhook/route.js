// The Heseos Bot platform's ONE shared WhatsApp webhook — every tenant, Heseos's own in-house
// bot included, configures their own Meta App to call this same URL. That's the whole point of
// "just enter bot configuration and their bot is ready": there is no per-tenant webhook route
// and no per-tenant code path here — every message is routed purely by data (the tenant row
// matching the inbound payload's phone_number_id / verify token), see lib/botWhatsapp.js and
// lib/botEngine.js.

import { dbGetById, dbInsert, dbList, dbPatch, dbWhere } from '@/lib/db';
import { parseWebhookByPhone } from '@/lib/botWhatsapp';
import { runBotTurn } from '@/lib/botEngine';
import { runFlowTurn, pickFlow } from '@/lib/botFlowEngine';
import { parseRefFromText, referrerNoteFor } from '@/lib/attribution';
import { createHeseosLead, heseosLeadSummary } from '@/lib/heseosLeadSync';
import { findFirstLeadByPhone } from '@/lib/leadOrigin';
import { stageOf } from '@/lib/leadStage';
import { HESEOS_DEFAULT_FLOW_ID, ensureHeseosDefaultFlow } from '@/lib/heseosDefaultFlow';
import { HESEOS_RETURNING_FLOW_ID, ensureHeseosReturningFlow } from '@/lib/heseosReturningFlow';

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

// Only Heseos's own tenant has botKind === 'heseos'; linkToHeseosLeads is a manual, trust-based
// grant for a white-label tenant that still funnels into the real, shared `leads` table (never
// something a tenant can switch on themselves — deliberately left out of EDITABLE_FIELDS in
// app/api/bot/config/route.js). Either way, bridging a chat into a real lead now happens via
// lib/heseosLeadSync.js's createHeseosLead/finalizeHeseosLead — see the chat-creation branch
// below for WHEN each tenant's chats get bridged.
//
// POST — every inbound WhatsApp message + delivery status, from every tenant, lands here.
export async function POST(req) {
  const payload = await req.json().catch(() => ({}));
  const groups = parseWebhookByPhone(payload);

  for (const g of groups) {
    try {
      const tenants = await dbWhere('bot_tenants', 'waPhoneNumberId', g.phoneNumberId);
      const tenant = tenants[0];
      if (!tenant) {
        // Exact-string-match lookup (lib/db.js's dbWhere) against whatever's saved in Bot
        // Configuration — a typo, stray whitespace, or the WABA ID pasted in instead of the
        // Phone Number ID all land here identically: every message from that number silently
        // vanishes, with the console still showing "Connected"/"live". Log it so a mismatch is
        // at least traceable in server logs instead of invisible everywhere.
        console.error(`Bot webhook: no tenant has waPhoneNumberId "${g.phoneNumberId}" — inbound message(s) dropped.`);
        continue;
      }
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
      let tenantFlows = await dbWhere('bot_flows', 'tenantId', tenant.id);
      // Heseos's own tenant always gets its default lead-capture flow, and its "welcome back"
      // flow for customers who already have a lead (see the chat-creation branch below) —
      // self-heal into existence the first time they're needed rather than requiring a manual
      // setup step (same spirit as app/api/bot/config's waVerifyToken backfill). No-op after the
      // first run, and no-op entirely for every other tenant — see lib/heseosDefaultFlow.js and
      // lib/heseosReturningFlow.js.
      if (tenant.botKind === 'heseos') {
        tenantFlows = await ensureHeseosDefaultFlow(tenant, tenantFlows);
        tenantFlows = await ensureHeseosReturningFlow(tenant, tenantFlows);
      }

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
          let picked = pickFlow(tenantFlows, { attributionKind: link?.kind || null, text: m.text });

          // A customer who already has a lead — punched in by a partner, captured on a previous
          // WhatsApp chat, however it got there — gets HESEOS Buddy's "welcome back" flow
          // instead of the full new-enquiry questionnaire, and this brand-new chat is linked
          // straight to that EXISTING lead rather than spawning another one. Heseos-brand only
          // (see lib/heseosReturningFlow.js); a white-label linkToHeseosLeads tenant with no
          // flow of their own keeps the original immediate-bridge behaviour further below.
          let existingLeadId = null;
          let existingLead = null;
          if (tenant.botKind === 'heseos') {
            const existingLeads = await dbList('leads');
            const firstLead = findFirstLeadByPhone(m.from, existingLeads);
            // Only route to the "welcome back" flow when that existing enquiry is still ACTIVE
            // (a demo pending, or a fresh unworked lead) — see lib/leadStage.js's stageOf. A
            // lead that's already closed out (Converted) or declined (Rejected) is done, one way
            // or the other; a customer messaging in after that — even scanning a brand-new
            // QR/referral link — is starting something new, not resuming something old, so
            // `picked` is left alone here and falls through to pickFlow's normal attribution/
            // keyword/default selection (lib/heseosDefaultFlow.js), exactly as if this phone
            // number had never messaged before. createHeseosLead below still independently
            // protects referral/QR payout credit via its own findFirstLeadByPhone check, so a
            // repeat customer scanning a different partner's link still can't shift credit away
            // from whoever brought them in first — only which FLOW they see changes here, never
            // who gets paid.
            if (firstLead && stageOf(firstLead) !== 'Converted' && stageOf(firstLead) !== 'Rejected') {
              existingLeadId = firstLead.id;
              existingLead = firstLead;
              const returningFlow = tenantFlows.find((f) => f.id === HESEOS_RETURNING_FLOW_ID);
              if (returningFlow) picked = returningFlow;
            }
          }

          chat = {
            id: m.from, tenantId: tenant.id, phone: m.from, name: m.name || m.from,
            lastText: m.text, lastAt: m.ts, unread: 1, status: 'open', assignedTo: null,
            botOn: true, lead: null, stage: null, menuRetries: 0, answerRetries: 0, city: '',
            attributionKind: link?.kind || null, attributionLinkId: link?.id || null,
            flowNodeId: null, answers: {}, activeFlowId: picked?.id || null, autoHandoff: false,
            firstMessageAt: m.ts, createdAt: m.ts,
          };
          await dbInsert('bot_chats', m.from, chat);
          if (tenant.botKind === 'heseos' || tenant.linkToHeseosLeads === true) {
            // Only ever computed for Heseos's own tenant — white-label tenants never reach this
            // branch, so their chats simply have no referrerNote and {{referrerNote}} (if a
            // tenant's own flow happens to use it) just renders blank. See lib/attribution.js.
            const referrerNote = await referrerNoteFor(link);
            const patch = { referrerNote };
            chat = { ...chat, referrerNote };
            if (existingLeadId) {
              // Already have a lead for this phone number — link this chat to it directly rather
              // than waiting for a flow to finish (there's no new-enquiry journey to finish here
              // at all). This also makes lib/heseosLeadSync.js's finalizeHeseosLead a no-op once
              // the returning-customer flow reaches its own handoff, since it only ever creates a
              // lead when the chat doesn't already have one — so this can never double-create.
              patch.leadId = existingLeadId;
              patch.leadSummary = heseosLeadSummary(existingLead);
              chat = { ...chat, leadId: existingLeadId, leadSummary: patch.leadSummary };
            } else if (!picked) {
              // A flow is about to walk this chat through its own lead-capture question journey
              // (see lib/heseosDefaultFlow.js and finalizeHeseosLead, called once that flow
              // actually reaches a handoff node) — deferring lead creation to that moment is the
              // whole point: a customer who only ever says "hi", or who declines when asked, must
              // never become a lead at all. A tenant with linkToHeseosLeads but no flow (nothing
              // picked) keeps the original immediate-bridge behaviour, unchanged, for pipeline
              // visibility exactly as before this existed.
              const lead = await createHeseosLead(tenant, { phone: m.from, name: m.name, link });
              patch.leadId = lead.id;
              chat = { ...chat, leadId: lead.id };
            }
            await dbPatch('bot_chats', m.from, patch);
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

          // A chat the bot silenced itself on after a flow finished naturally (autoHandoff —
          // see lib/botFlowEngine.js's endHandoff) is fair game to wake back up on the
          // customer's next message: "come back anytime saying hi" is a promise every Heseos
          // flow's handoff/decline text makes. A chat a HUMAN deliberately silenced via the
          // Inbox's Bot on/off toggle must never be overridden this way — that toggle explicitly
          // clears autoHandoff the moment a person touches it either direction (see
          // app/api/bot/chats/[id]/route.js), so this check alone is enough to tell the two
          // apart. Reaching this point means a flow already completed for this chat once, which
          // — see lib/botFlowEngine.js's endHandoff — only ever happens after finalizeHeseosLead
          // has run, so chat.leadId is always already set at the moment autoHandoff was set; but
          // time may have passed since then, and a human could since have closed that lead out
          // (Converted/Rejected) from the admin/team app — same "still active?" check as the
          // chat-creation branch above, and for the same reason: closed-out is done, and the
          // next message is a fresh enquiry, not a resumed one.
          if (tenant.botKind === 'heseos' && chat.botOn === false && chat.autoHandoff === true) {
            const lead = chat.leadId ? await dbGetById('leads', chat.leadId).catch(() => null) : null;
            const inProcess = lead && stageOf(lead) !== 'Converted' && stageOf(lead) !== 'Rejected';
            if (inProcess) {
              const returningFlow = tenantFlows.find((f) => f.id === HESEOS_RETURNING_FLOW_ID);
              if (returningFlow) {
                patch.botOn = true;
                patch.autoHandoff = false;
                patch.flowNodeId = null;
                patch.activeFlowId = returningFlow.id;
                patch.leadSummary = heseosLeadSummary(lead);
              }
            } else {
              // Old lead is closed out (or this chat somehow has none) — unlink it and fall back
              // to the normal new-enquiry flow, same as a first-ever message from this phone
              // number would get with no active existing lead. A fresh lead is created when
              // THIS flow reaches its own handoff (lib/heseosLeadSync.js's finalizeHeseosLead),
              // never touching the old, already-closed one.
              const defaultFlow = tenantFlows.find((f) => f.id === HESEOS_DEFAULT_FLOW_ID);
              if (defaultFlow) {
                patch.botOn = true;
                patch.autoHandoff = false;
                patch.flowNodeId = null;
                patch.activeFlowId = defaultFlow.id;
                patch.leadId = null;
              }
            }
          }

          await dbPatch('bot_chats', m.from, patch);
          chat = { ...chat, ...patch };
          // Once a chat has entered a flow it stays on that same one for its whole
          // conversation — re-matching triggers on every reply would let an unrelated later
          // message ("hi" mid-conversation, say) hijack the chat into a different flow. (The
          // re-engagement branch above is the one deliberate exception, and it already updated
          // chat.activeFlowId before this check runs.)
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
