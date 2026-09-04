// Heseos's "welcome back" flow — what a customer who ALREADY has a lead in the system gets
// instead of lib/heseosDefaultFlow.js's full new-enquiry questionnaire, when they message
// HESEOS Buddy. Routed here by app/api/bot/webhook/route.js's chat-creation branch: before
// picking a flow for a brand-new chat, it checks whether this phone number already has a lead
// (lib/leadOrigin.js's findFirstLeadByPhone — the same helper the first-touch attribution check
// already uses) and, if so, links the new chat straight to that EXISTING lead (chat.leadId) and
// routes here instead of pickFlow's normal attribution/keyword/default selection. Because
// chat.leadId is already set before this flow ever runs, reaching this flow's handoff node is a
// no-op for lib/heseosLeadSync.js's finalizeHeseosLead (it only ever creates a lead when one
// doesn't already exist) — so a returning customer saying "hi" again can never spawn a
// duplicate lead, no matter what they pick below.
//
// Deliberately simpler than the full intake: three short options relevant to someone we already
// know, not another 15-node questionnaire. "I have a new requirement" captures free text (not
// wired to any HESEOS_LEAD_FIELDS key, so it lands only in this chat's answers/transcript for a
// human to read — a second, unrelated need doesn't belong bolted onto the existing lead's
// structured fields) and still hands off so a human sees it.
//
// HESEOS-brand content, same as lib/heseosDefaultFlow.js — only ever seeded for
// tenant.botKind === 'heseos'.

import { dbInsert } from '@/lib/db';

export const HESEOS_RETURNING_FLOW_ID = 'heseos_returning_customer';

function buildHeseosReturningFlow(tenantId) {
  const now = new Date().toISOString();

  const nodes = [
    { id: 'start', type: 'start', x: 60, y: 220, data: {} },
    {
      id: 'n_greet', type: 'message', x: 340, y: 220,
      data: { text: "Hi again! 👋 I'm *{{botName}}* from HESEOS.\n\nLooks like you've already spoken with our team before — no need to go through everything again. What can I help you with today? 👇" },
    },
    {
      id: 'n_menu', type: 'menu', x: 620, y: 220,
      data: {
        text: '',
        fieldKey: '',
        options: [
          { id: 'opt_status', label: '📋 Check my enquiry status' },
          { id: 'opt_new', label: '🆕 I have a new requirement' },
          { id: 'opt_team', label: '💬 Talk to our team' },
        ],
      },
    },
    {
      id: 'n_status_handoff', type: 'handoff', x: 900, y: 60,
      data: { text: "Sure thing! Let me flag this to our team — they'll share the latest update on your enquiry shortly. 🙌" },
    },
    {
      id: 'n_ask_new_need', type: 'question', x: 900, y: 220,
      data: { text: "Sure! Tell me a bit about what you're looking for this time — go ahead, I'm listening. 😊", fieldKey: 'newRequirement' },
    },
    {
      id: 'n_new_handoff', type: 'handoff', x: 1180, y: 220,
      data: { text: "Got it, thank you! 🙌 Our team will reach out shortly to discuss this with you." },
    },
    {
      id: 'n_team_handoff', type: 'handoff', x: 900, y: 380,
      data: { text: 'Of course! Connecting you with our team now — they\'ll be with you shortly. 😊' },
    },
  ];

  const edges = [
    { id: 'e_start', source: 'start', sourceHandle: 'default', target: 'n_greet' },
    { id: 'e_greet', source: 'n_greet', sourceHandle: 'default', target: 'n_menu' },
    { id: 'e_status', source: 'n_menu', sourceHandle: 'opt_status', target: 'n_status_handoff' },
    { id: 'e_new', source: 'n_menu', sourceHandle: 'opt_new', target: 'n_ask_new_need' },
    { id: 'e_team', source: 'n_menu', sourceHandle: 'opt_team', target: 'n_team_handoff' },
    { id: 'e_new_done', source: 'n_ask_new_need', sourceHandle: 'default', target: 'n_new_handoff' },
  ];

  return {
    id: HESEOS_RETURNING_FLOW_ID,
    tenantId,
    name: 'Welcome Back (returning customer)',
    enabled: true,
    // Never auto-picked by lib/botFlowEngine.js's pickFlow — app/api/bot/webhook/route.js routes
    // to this flow explicitly (by id) once it finds an existing lead for the phone number, so
    // this never needs (or should have) isDefault/attribution/keyword triggers of its own.
    triggers: { keywords: [], attribution: [], isDefault: false },
    nodes,
    edges,
    createdAt: now,
    updatedAt: now,
  };
}

// Same self-healing seed pattern as lib/heseosDefaultFlow.js's ensureHeseosDefaultFlow — only
// ever inserts when a flow with this exact id is missing, never overwrites a tenant's own edits.
export async function ensureHeseosReturningFlow(tenant, existingFlows) {
  if ((existingFlows || []).some((f) => f.id === HESEOS_RETURNING_FLOW_ID)) return existingFlows;
  const flow = buildHeseosReturningFlow(tenant.id);
  await dbInsert('bot_flows', flow.id, flow);
  return [...(existingFlows || []), flow];
}
