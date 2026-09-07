// Heseos's "organic enquiry" flow — what a genuinely untracked contact gets: no QR scan, no
// referral link (see lib/heseosDefaultFlow.js's attribution triggers, and
// app/api/bot/webhook/route.js's resolveAttributionLink), and no existing lead on file for their
// phone number (an existing lead of ANY source always overrides straight to
// lib/heseosReturningFlow.js instead, before pickFlow's result even matters — see the
// `existingLeadId` handling in the webhook). Someone who just found the number and typed "Hi"
// with no tracking signal at all still deserves a reply, just not the full
// lib/heseosDefaultFlow.js questionnaire (that one is reserved for QR/referral traffic, where the
// business already knows this person came in through a specific partner/location/customer and
// wants the complete structured intake).
//
// Deliberately lightweight: a short menu, not a 15-node questionnaire — "I have a new
// requirement" captures whatever the customer types as free text (chat.answers.newRequirement,
// same field lib/heseosReturningFlow.js's identical branch uses) rather than walking them through
// property/budget/timeline questions one at a time, and hands off either way so a human always
// sees it. lib/heseosLeadSync.js's finalizeHeseosLead (called unconditionally from every flow's
// handoff — see lib/botFlowEngine.js's endHandoff) still creates a real lead once either branch
// reaches its handoff node — just a lighter one than the full questionnaire produces, since only
// name/phone (and newRequirement, logged in the chat transcript rather than a structured field)
// are ever known at that point. A human reviewing it in the Leads list can always follow up to
// fill in the rest by phone.
//
// This is now the FALLBACK DEFAULT for any brand-new Heseos chat with no attribution match (see
// its triggers.isDefault below) — lib/heseosDefaultFlow.js no longer carries isDefault itself,
// so pickFlow only reaches that one via an actual qr/referral attribution match.
//
// HESEOS-brand content, same as lib/heseosDefaultFlow.js and lib/heseosReturningFlow.js — only
// ever seeded for tenant.botKind === 'heseos'.

import { dbInsert } from '@/lib/db';

export const HESEOS_ORGANIC_FLOW_ID = 'heseos_organic_enquiry_v1';

function buildHeseosOrganicFlow(tenantId) {
  const now = new Date().toISOString();

  const nodes = [
    { id: 'start', type: 'start', x: 60, y: 220, data: {} },
    {
      id: 'n_greet', type: 'message', x: 340, y: 220,
      data: { text: "Namaste 🙏 I'm *{{botName}}* — your smart home guide at HESEOS.\n\nWhat can I help you with today? 👇" },
    },
    {
      id: 'n_menu', type: 'menu', x: 620, y: 220,
      data: {
        text: '',
        fieldKey: '',
        options: [
          { id: 'opt_new', label: '🆕 I have a new requirement' },
          { id: 'opt_team', label: '💬 Talk to our team' },
        ],
      },
    },
    {
      id: 'n_ask_new_need', type: 'question', x: 900, y: 140,
      data: { text: "Sure! Tell me a bit about what you're looking for — go ahead, I'm listening. 😊", fieldKey: 'newRequirement' },
    },
    {
      id: 'n_new_handoff', type: 'handoff', x: 1180, y: 140,
      data: { text: 'Got it, thank you! 🙌 Our team will reach out shortly to discuss this with you.' },
    },
    {
      id: 'n_team_handoff', type: 'handoff', x: 900, y: 320,
      data: { text: "Of course! Connecting you with our team now — they'll be with you shortly. 😊" },
    },
  ];

  const edges = [
    { id: 'e_start', source: 'start', sourceHandle: 'default', target: 'n_greet' },
    { id: 'e_greet', source: 'n_greet', sourceHandle: 'default', target: 'n_menu' },
    { id: 'e_new', source: 'n_menu', sourceHandle: 'opt_new', target: 'n_ask_new_need' },
    { id: 'e_team', source: 'n_menu', sourceHandle: 'opt_team', target: 'n_team_handoff' },
    { id: 'e_new_done', source: 'n_ask_new_need', sourceHandle: 'default', target: 'n_new_handoff' },
  ];

  return {
    id: HESEOS_ORGANIC_FLOW_ID,
    tenantId,
    name: 'Organic Enquiry (no referral)',
    enabled: true,
    triggers: { keywords: [], attribution: [], isDefault: true },
    nodes,
    edges,
    createdAt: now,
    updatedAt: now,
  };
}

// Same self-healing seed pattern as lib/heseosDefaultFlow.js/lib/heseosReturningFlow.js — only
// ever inserts when a flow with this exact id is missing, never overwrites a tenant's own edits.
export async function ensureHeseosOrganicFlow(tenant, existingFlows) {
  if ((existingFlows || []).some((f) => f.id === HESEOS_ORGANIC_FLOW_ID)) return existingFlows;
  const flow = buildHeseosOrganicFlow(tenant.id);
  await dbInsert('bot_flows', flow.id, flow);
  return [...(existingFlows || []), flow];
}
