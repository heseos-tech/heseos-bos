// Heseos's shared "rate your experience" WhatsApp flow — asked once each role's stage of the
// journey actually closes, whether that close is a win or a loss (see the trigger points in
// app/api/leads/[id]/route.js's 'contact' and 'demoOutcome' PATCH handlers, both of which call
// lib/heseosNotify.js's activateHeseosRatingFlow right after sending the WhatsApp message that
// opens this). One flow covers BOTH roles (pre-sales exec and sales engineer) — which one is
// being rated is carried entirely in chat.answers.ratingRole/ratingEmployeeName, set by
// activateHeseosRatingFlow before this flow's first question ever sends, not by anything drawn
// here. That's also why this flow has no triggers of its own (never auto-picked by
// lib/botFlowEngine.js's pickFlow) — app/api/leads/[id]/route.js routes into it explicitly by
// id, the same way lib/heseosReturningFlow.js is reached for a returning customer.
//
// Two questions, no branching: a 1-5 star rating (validated — see lib/botFlowEngine.js's new
// 'rating_1_5' QUESTION_VALIDATORS entry, re-asking once on anything else) and an optional
// comment ("reply skip" to leave it out — validated nowhere, since free text is exactly what a
// comment is). lib/heseosLeadSync.js's submitHeseosRating (called unconditionally from every
// handoff, same pattern as scheduleHeseosDemo) persists both onto the linked lead once this
// flow's own handoff node is reached.
//
// HESEOS-brand content, same as the other lib/heseos*Flow.js files — only ever seeded for
// tenant.botKind === 'heseos'.

import { dbInsert } from '@/lib/db';

export const HESEOS_RATING_FLOW_ID = 'heseos_rate_experience_v1';

function buildHeseosRatingFlow(tenantId) {
  const now = new Date().toISOString();

  const nodes = [
    { id: 'start', type: 'start', x: 60, y: 200, data: {} },
    {
      id: 'n_ask_rating', type: 'question', x: 340, y: 200,
      data: {
        text: 'How would you rate your experience with {{ratingEmployeeName}} from HESEOS? Reply with a number from 1 to 5 ⭐',
        fieldKey: 'rating',
        validate: 'rating_1_5',
      },
    },
    {
      id: 'n_ask_comment', type: 'question', x: 620, y: 200,
      data: {
        text: 'Thank you! 🙏 Anything you\'d like to add? Reply with a quick comment, or just reply *skip*.',
        fieldKey: 'ratingComment',
      },
    },
    {
      id: 'n_thanks', type: 'handoff', x: 900, y: 200,
      data: { text: "Thanks so much for the feedback! 😊 It genuinely helps us improve.\n\n— Team HESEOS" },
    },
  ];

  const edges = [
    { id: 'e_start', source: 'start', sourceHandle: 'default', target: 'n_ask_rating' },
    { id: 'e_rating', source: 'n_ask_rating', sourceHandle: 'default', target: 'n_ask_comment' },
    { id: 'e_comment', source: 'n_ask_comment', sourceHandle: 'default', target: 'n_thanks' },
  ];

  return {
    id: HESEOS_RATING_FLOW_ID,
    tenantId,
    name: 'Rate Your Experience',
    enabled: true,
    // Never auto-picked — see this file's header comment. Only reached via
    // lib/heseosNotify.js's activateHeseosRatingFlow setting chat.activeFlowId directly.
    triggers: { keywords: [], attribution: [], isDefault: false },
    nodes,
    edges,
    createdAt: now,
    updatedAt: now,
  };
}

// Same self-healing seed pattern as the other lib/heseos*Flow.js files — only ever inserts when
// a flow with this exact id is missing, never overwrites a tenant's own edits made in Flow
// Builder since.
export async function ensureHeseosRatingFlow(tenant, existingFlows) {
  if ((existingFlows || []).some((f) => f.id === HESEOS_RATING_FLOW_ID)) return existingFlows;
  const flow = buildHeseosRatingFlow(tenant.id);
  await dbInsert('bot_flows', flow.id, flow);
  return [...(existingFlows || []), flow];
}
