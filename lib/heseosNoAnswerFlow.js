// Heseos's automated "we tried calling but couldn't reach you" nudge — the WhatsApp side of
// the no-answer follow-up sequence. Pre-sales marking a lead Call Not Picked
// (app/api/leads/[id]/route.js's 'contact' PATCH type) doesn't fire this by itself; it's
// app/api/cron/lead-reminders/route.js, running on a schedule, that notices a lead has sat in
// Call Not Picked for a while and fires lib/heseosNotify.js's notifyHeseosNoAnswerNudge, which
// sends the opening template and then activates THIS flow — same "role/outcome travels as
// chat.answers, not a flow trigger" pattern as lib/heseosRatingFlow.js. Never auto-picked by
// lib/botFlowEngine.js's pickFlow (triggers.isDefault stays false) — always reached explicitly,
// by id, the same way lib/heseosReturningFlow.js and lib/heseosRatingFlow.js are.
//
// One menu, two branches, no questions: "Still interested" vs "Not right now" — mirrors
// lib/heseosReturningFlow.js's plain menu-to-handoff shape (a menu option's `valueTemplate` is
// a literal, not a template var, exactly like that flow's yes/no confirm options). Which one
// the customer picked travels as chat.answers.noAnswerReply, read back by
// lib/heseosLeadSync.js's resolveHeseosNoAnswerReply (called unconditionally from every
// handoff, same pattern as submitHeseosRating) to actually move the lead: "Still interested"
// reopens it as a Follow-up Later due right away (so it lands back in pre-sales' queue for an
// immediate callback); "Not right now" closes it as Not Interested with reason 'no_response' —
// deliberately with NO rating ask on either branch, since pre-sales never actually got to speak
// with this customer (see lib/leadStage.js's own comment on ratings only firing once a role's
// stage genuinely concludes with them).
//
// HESEOS-brand content, same as the other lib/heseos*Flow.js files — only ever seeded for
// tenant.botKind === 'heseos'.

import { dbInsert } from '@/lib/db';

export const HESEOS_NO_ANSWER_FLOW_ID = 'heseos_no_answer_nudge_v1';

function buildHeseosNoAnswerFlow(tenantId) {
  const now = new Date().toISOString();

  const nodes = [
    { id: 'start', type: 'start', x: 60, y: 200, data: {} },
    {
      id: 'n_menu', type: 'menu', x: 340, y: 200,
      data: {
        text: 'Are you still interested in a HESEOS smart home setup?',
        fieldKey: 'noAnswerReply',
        options: [
          { id: 'opt_interested', label: '👍 Yes, still interested', valueTemplate: 'interested' },
          { id: 'opt_not_interested', label: '🙅 Not right now', valueTemplate: 'not_interested' },
        ],
      },
    },
    {
      id: 'n_interested_handoff', type: 'handoff', x: 620, y: 120,
      data: { text: "Great to hear! 😊 We've flagged this and our team will call you back shortly." },
    },
    {
      id: 'n_not_interested_handoff', type: 'handoff', x: 620, y: 280,
      data: { text: "No problem at all, thank you for letting us know! Whenever you're ready to explore a smarter home, we'll be here. 💚" },
    },
  ];

  const edges = [
    { id: 'e_start', source: 'start', sourceHandle: 'default', target: 'n_menu' },
    { id: 'e_interested', source: 'n_menu', sourceHandle: 'opt_interested', target: 'n_interested_handoff' },
    { id: 'e_not_interested', source: 'n_menu', sourceHandle: 'opt_not_interested', target: 'n_not_interested_handoff' },
  ];

  return {
    id: HESEOS_NO_ANSWER_FLOW_ID,
    tenantId,
    name: 'No-Answer Follow-up Nudge',
    enabled: true,
    // Never auto-picked — see this file's header comment. Only reached via
    // lib/heseosNotify.js's activateHeseosNoAnswerFlow setting chat.activeFlowId directly.
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
export async function ensureHeseosNoAnswerFlow(tenant, existingFlows) {
  if ((existingFlows || []).some((f) => f.id === HESEOS_NO_ANSWER_FLOW_ID)) return existingFlows;
  const flow = buildHeseosNoAnswerFlow(tenant.id);
  await dbInsert('bot_flows', flow.id, flow);
  return [...(existingFlows || []), flow];
}
