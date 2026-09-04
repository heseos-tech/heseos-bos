// Heseos's "welcome back" flow — what a customer who ALREADY has a lead in the system gets
// instead of lib/heseosDefaultFlow.js's full new-enquiry questionnaire, when they message
// HESEOS Buddy. Reached two different ways, both from app/api/bot/webhook/route.js: (1) a
// brand-new chat whose phone number already matches a lead from ANY source — Meta, Google,
// website, a partner, an employee, or an earlier WhatsApp chat (lib/leadOrigin.js's
// findFirstLeadByPhone is source-agnostic by design) — gets linked straight to that EXISTING
// lead (chat.leadId) and routed here instead of pickFlow's normal attribution/keyword/default
// selection; (2) a chat that already finished a flow and went quiet (botOn: false) gets woken
// back up here the moment the customer says "hi" again — see chat.autoHandoff, set by
// lib/botFlowEngine.js's endHandoff and consumed right here in the webhook. Either way,
// chat.leadId is already set before this flow ever runs, so reaching this flow's own handoff
// nodes is always a no-op for lib/heseosLeadSync.js's finalizeHeseosLead (it only ever creates a
// lead when one doesn't already exist) — a returning customer can never spawn a duplicate lead,
// no matter what they pick below.
//
// Deliberately simpler than the full intake: short options relevant to someone we already know,
// not another 15-node questionnaire. "I have a new requirement" captures free text (not wired to
// any HESEOS_LEAD_FIELDS key, so it lands only in this chat's answers/transcript for a human to
// read — a second, unrelated need doesn't belong bolted onto the existing lead's structured
// fields) and still hands off so a human sees it. "Schedule a demo" asks for the visit address,
// date (DD-MM-YYYY) and time (HH:MM AM/PM) — validated and retried via
// lib/botFlowEngine.js's QUESTION_VALIDATORS — then books it straight onto the linked lead via
// lib/heseosLeadSync.js's scheduleHeseosDemo (called unconditionally from endHandoff, same as
// finalizeHeseosLead), pushing it into the sales-engineer claim pool for that city exactly like
// a pre-sales rep booking it by hand would.
//
// HESEOS-brand content, same as lib/heseosDefaultFlow.js — only ever seeded for
// tenant.botKind === 'heseos'.

import { dbInsert } from '@/lib/db';

// v3: v2 added the lead-details recap ({{leadSummary}}) and the "Schedule a demo" branch; v3
// makes that branch check whether the linked lead already has a pending demo booked and, if so,
// shows the existing date/time/address back to the customer and asks whether they'd like it
// changed, instead of walking straight into asking for a fresh address/date/time. Bumped to a
// new id again rather than mutating the v2 row in place — the self-healing seed
// (ensureHeseosReturningFlow below) never overwrites an existing flow row because a tenant may
// have hand-edited it in the Flow Builder since it was first seeded, so a structural change like
// this one needs a fresh id to actually reach any tenant who already got an earlier seed; older
// rows, if they exist, are simply orphaned and harmless.
export const HESEOS_RETURNING_FLOW_ID = 'heseos_returning_customer_v3';

function buildHeseosReturningFlow(tenantId) {
  const now = new Date().toISOString();

  const nodes = [
    { id: 'start', type: 'start', x: 60, y: 220, data: {} },
    {
      id: 'n_greet', type: 'message', x: 340, y: 220,
      data: { text: "Hi again! 👋 I'm *{{botName}}* from HESEOS.\n\nGreat to hear from you again! Here's what we have on file for you:\n{{leadSummary}}\n\nWhat can I help you with today? 👇" },
    },
    {
      id: 'n_menu', type: 'menu', x: 620, y: 220,
      data: {
        text: '',
        fieldKey: '',
        options: [
          { id: 'opt_status', label: '📋 Check my enquiry status' },
          {
            id: 'opt_demo', label: '📅 Schedule a demo',
            // If this lead already has a pending demo booked, redirect straight to n_demo_existing
            // instead of n_ask_demo_address, and pull the existing date/time/address off the lead
            // into chat.answers first so that branch's text can show them back via {{demoDate}} etc
            // — see lib/heseosLeadSync.js's evaluateLeadRedirect/LEAD_CONDITIONS.
            altIf: 'demoScheduledPending', altHandle: 'opt_demo_existing',
            altAnswers: ['demoDate', 'demoTime', 'demoAddress'],
          },
          { id: 'opt_new', label: '🆕 I have a new requirement' },
          { id: 'opt_team', label: '💬 Talk to our team' },
        ],
      },
    },
    {
      id: 'n_status_handoff', type: 'handoff', x: 900, y: 20,
      data: { text: "Sure thing! Let me flag this to our team — they'll share the latest update on your enquiry shortly. 🙌" },
    },
    {
      id: 'n_ask_new_need', type: 'question', x: 900, y: 260,
      data: { text: "Sure! Tell me a bit about what you're looking for this time — go ahead, I'm listening. 😊", fieldKey: 'newRequirement' },
    },
    {
      id: 'n_new_handoff', type: 'handoff', x: 1180, y: 260,
      data: { text: "Got it, thank you! 🙌 Our team will reach out shortly to discuss this with you." },
    },
    {
      id: 'n_team_handoff', type: 'handoff', x: 900, y: 460,
      data: { text: 'Of course! Connecting you with our team now — they\'ll be with you shortly. 😊' },
    },
    {
      id: 'n_ask_demo_address', type: 'question', x: 900, y: 140,
      data: { text: "Great, let's get your demo booked! 🎉 What's the full address where you'd like our engineer to visit? 📍", fieldKey: 'demoAddress' },
    },
    {
      id: 'n_ask_demo_date', type: 'question', x: 1180, y: 140,
      data: { text: 'Perfect. What date works for you? Please reply as DD-MM-YYYY (e.g. 25-09-2026). 📅', fieldKey: 'demoDate', validate: 'date_ddmmyyyy' },
    },
    {
      id: 'n_ask_demo_time', type: 'question', x: 1460, y: 140,
      data: { text: 'And what time should our engineer arrive? Please reply as HH:MM AM/PM (e.g. 03:30 PM). ⏰', fieldKey: 'demoTime', validate: 'time_12h' },
    },
    {
      id: 'n_demo_handoff', type: 'handoff', x: 1740, y: 140,
      data: { text: "All set! 🎉 Here's your demo request:\n📅 Date: {{demoDate}}\n⏰ Time: {{demoTime}}\n📍 Address: {{demoAddress}}\n\nOne of our sales engineers will confirm shortly. Thank you! 🙌" },
    },
    {
      // Reached instead of n_ask_demo_address when the linked lead already has a pending demo —
      // see the 'opt_demo' menu option's altIf above. {{demoDate}}/{{demoTime}}/{{demoAddress}}
      // here come from the EXISTING lead (copied into chat.answers by evaluateLeadRedirect), not
      // from anything asked in this conversation.
      id: 'n_demo_existing', type: 'menu', x: 900, y: 620,
      data: {
        text: "You've already got a demo booked with us! 🎉\n📅 Date: {{demoDate}}\n⏰ Time: {{demoTime}}\n📍 Address: {{demoAddress}}\n\nWould you like to change the date or time?",
        fieldKey: '',
        options: [
          { id: 'opt_demo_change_yes', label: '✅ Yes, change it' },
          { id: 'opt_demo_change_no', label: '👍 No, that works for me' },
        ],
      },
    },
    {
      id: 'n_demo_change_handoff', type: 'handoff', x: 1180, y: 580,
      data: {
        text: "Ok! We'll notify our sales engineer — they'll coordinate a new date and time with you shortly. 🙌",
        // Logged onto the lead so whoever's assigned actually sees the request — see
        // lib/botFlowEngine.js's endHandoff and lib/heseosLeadSync.js's appendHeseosLeadHistory.
        // Deliberately NOT re-asking for a new date/time here: the bot hands this off for a
        // human to coordinate rather than trying to renegotiate the slot itself.
        leadHistoryEvent: 'Customer requested to reschedule the demo via WhatsApp',
      },
    },
    {
      id: 'n_demo_keep_handoff', type: 'handoff', x: 1180, y: 660,
      data: {
        text: 'Great, see you then! 😊 If anything changes, just message us anytime.',
        leadHistoryEvent: 'Customer confirmed the existing demo date/time via WhatsApp',
      },
    },
  ];

  const edges = [
    { id: 'e_start', source: 'start', sourceHandle: 'default', target: 'n_greet' },
    { id: 'e_greet', source: 'n_greet', sourceHandle: 'default', target: 'n_menu' },
    { id: 'e_status', source: 'n_menu', sourceHandle: 'opt_status', target: 'n_status_handoff' },
    { id: 'e_demo', source: 'n_menu', sourceHandle: 'opt_demo', target: 'n_ask_demo_address' },
    { id: 'e_demo_existing', source: 'n_menu', sourceHandle: 'opt_demo_existing', target: 'n_demo_existing' },
    { id: 'e_new', source: 'n_menu', sourceHandle: 'opt_new', target: 'n_ask_new_need' },
    { id: 'e_team', source: 'n_menu', sourceHandle: 'opt_team', target: 'n_team_handoff' },
    { id: 'e_new_done', source: 'n_ask_new_need', sourceHandle: 'default', target: 'n_new_handoff' },
    { id: 'e_demo_address', source: 'n_ask_demo_address', sourceHandle: 'default', target: 'n_ask_demo_date' },
    { id: 'e_demo_date', source: 'n_ask_demo_date', sourceHandle: 'default', target: 'n_ask_demo_time' },
    { id: 'e_demo_time', source: 'n_ask_demo_time', sourceHandle: 'default', target: 'n_demo_handoff' },
    { id: 'e_demo_change_yes', source: 'n_demo_existing', sourceHandle: 'opt_demo_change_yes', target: 'n_demo_change_handoff' },
    { id: 'e_demo_change_no', source: 'n_demo_existing', sourceHandle: 'opt_demo_change_no', target: 'n_demo_keep_handoff' },
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
