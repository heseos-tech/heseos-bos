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
// v6: the flow is now for ANYONE HESEOS already knows — an open lead, an order, or both (see
// lib/heseosCustomerContext.js). The greeting ({{returningIntro}}) and the menu adapt: options carry a
// `showIf` ('hasLead' / 'hasOrder' / 'noOrder', read off the chat by lib/botFlowEngine.js), so a
// lead-only customer sees their enquiry recap + enquiry/demo options, an order-only customer sees
// their latest order + order options, and someone with both sees both. "I have a new requirement"
// (free text) was replaced by "Home Automation", which sends the smart-home landing-page card.
//
// HESEOS-brand content, same as lib/heseosDefaultFlow.js — only ever seeded for
// tenant.botKind === 'heseos'.

import { dbInsert } from '@/lib/db';
import { buildLandingCardNode } from '@/lib/heseosDefaultFlow';
import { buildDoorLockCardNode } from '@/lib/heseosShoppingFlow';
import { buildAfterMenuNodes, buildAfterMenuEdges, AFTER_MENU_ID } from '@/lib/heseosAfterMenu';

// v3: v2 added the lead-details recap ({{leadSummary}}) and the "Schedule a demo" branch; v3
// makes that branch check whether the linked lead already has a pending demo booked and, if so,
// shows the existing date/time/address back to the customer and asks whether they'd like it
// changed, instead of walking straight into asking for a fresh address/date/time. v4 adds
// {{leadOriginNote}} to the greeting — telling the customer plainly HOW they're already in the
// system (scanned a partner's QR code, came via a referral link, punched in by a partner/team
// member, etc — see lib/heseosLeadSync.js's heseosLeadOriginNote), instead of just showing the
// lead recap with no explanation of why they're seeing it. v5 adds flagRescheduleRequested:
// true to n_demo_change_handoff ("Yes, change it") so the request actually shows up as a badge
// on the lead card in components/employee/PresalesPanel.jsx / SalesEngineerPanel.jsx (see
// lib/heseosLeadSync.js's flagHeseosRescheduleRequested) instead of only being findable in the
// lead's timeline. Bumped to a new id again each time rather than mutating the previous row in
// place — the self-healing seed (ensureHeseosReturningFlow below) never overwrites an existing
// flow row because a tenant may have hand-edited it in the Flow Builder since it was first
// seeded, so a change like this one needs a fresh id to actually reach any tenant who already
// got an earlier seed; older rows, if they exist, are simply orphaned and harmless.
export const HESEOS_RETURNING_FLOW_ID = 'heseos_returning_customer_v5';
// Stored copies older than this are upgraded in place (keeping enabled/createdAt) — the row id above
// stays as it is so nothing that already references it breaks. Unversioned rows count as 5. (v7: "Talk to our team" files a Call Request instead of a lead; v8: Main menu / End chat buttons after status + link cards.)
const FLOW_VERSION = 14;

function buildHeseosReturningFlow(tenantId) {
  const now = new Date().toISOString();

  const nodes = [
    { id: 'start', type: 'start', x: 60, y: 220, data: {} },
    {
      id: 'n_greet', type: 'message', x: 340, y: 220,
      // {{returningIntro}} is built per customer (lib/heseosCustomerContext.js): lead recap, order, or both.
      data: { text: "{{returningIntro}}\n\nWhat can I help you with today? 👇" },
    },
    {
      id: 'n_menu', type: 'menu', x: 620, y: 220,
      data: {
        text: '',
        fieldKey: '',
        // `showIf` (see lib/botFlowEngine.js's optionVisible) hides an option unless the chat matches.
        // Row titles stay <= 24 characters (WhatsApp list limit).
        options: [
          { id: 'opt_order_status', label: '📦 Check order status', showIf: 'hasOrder' },
          { id: 'opt_status', label: '📋 Check enquiry status', showIf: 'hasLead' },
          {
            id: 'opt_demo', label: '📅 Schedule a demo', showIf: 'hasLead',
            // If this lead already has a pending demo booked, redirect straight to n_demo_existing
            // instead of n_ask_demo_address, and pull the existing date/time/address off the lead
            // into chat.answers first so that branch's text can show them back via {{demoDate}} etc
            // — see lib/heseosLeadSync.js's evaluateLeadRedirect/LEAD_CONDITIONS.
            altIf: 'demoScheduledPending', altHandle: 'opt_demo_existing',
            altAnswers: ['demoDate', 'demoTime', 'demoAddress'],
          },
          { id: 'opt_home', label: '🏠 Home Automation' },
          { id: 'opt_lock_again', label: '🔒 Order door lock again', showIf: 'hasOrder' },
          { id: 'opt_lock', label: '🔒 Order a door lock', showIf: 'noOrder' },
          { id: 'opt_team', label: '💬 Talk to our team' },
        ],
      },
    },
    {
      id: 'n_status_handoff', type: 'handoff', x: 900, y: 20,
      data: { text: "Sure thing! Let me flag this to our team — they'll share the latest update on your enquiry shortly. 🙌" },
    },
    {
      // The order(s) as they stand RIGHT NOW — {{orderStatusText}} is rebuilt on every message
      // (lib/heseosCustomerContext.js). No handoff: the flow just ends, and the next message starts
      // the welcome-back menu again.
      id: 'n_order_status', type: 'message', x: 900, y: -60,
      data: { text: '{{orderStatusText}}' },
    },
    buildDoorLockCardNode({ id: 'n_lock_card', x: 900, y: 700 }),
    buildLandingCardNode({ id: 'n_home_card', x: 900, y: 260, intro: false }),
    {
      id: 'n_team_handoff', type: 'handoff', x: 900, y: 460,
      // callRequest: logged under Admin -> Call Requests instead of creating/duplicating a lead.
      data: { text: 'Of course! Connecting you with our team now — they\'ll be with you shortly. 😊', callRequest: true },
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
        // Also flags the lead (lib/heseosLeadSync.js's flagHeseosRescheduleRequested) so
        // components/employee/PresalesPanel.jsx / SalesEngineerPanel.jsx surface this as a
        // visible badge on the lead card, not just a line buried in the timeline — whoever
        // owns the lead (the claimed sales engineer, or pre-sales while it's still unclaimed)
        // can then use their own panel's lightweight "Reschedule" action to actually move it.
        flagRescheduleRequested: true,
      },
    },
    {
      id: 'n_demo_keep_handoff', type: 'handoff', x: 1180, y: 660,
      data: {
        text: 'Great, see you then! 😊 If anything changes, just message us anytime.',
        leadHistoryEvent: 'Customer confirmed the existing demo date/time via WhatsApp',
      },
    },
    // "Anything else?" -> Main menu / End chat, shown after the order-status text and the link cards.
    ...buildAfterMenuNodes({ x: 1180, y: -60 }),
  ];

  const edges = [
    { id: 'e_start', source: 'start', sourceHandle: 'default', target: 'n_greet' },
    { id: 'e_greet', source: 'n_greet', sourceHandle: 'default', target: 'n_menu' },
    { id: 'e_order_status', source: 'n_menu', sourceHandle: 'opt_order_status', target: 'n_order_status' },
    { id: 'e_lock_again', source: 'n_menu', sourceHandle: 'opt_lock_again', target: 'n_lock_card' },
    { id: 'e_lock', source: 'n_menu', sourceHandle: 'opt_lock', target: 'n_lock_card' },
    { id: 'e_status', source: 'n_menu', sourceHandle: 'opt_status', target: 'n_status_handoff' },
    { id: 'e_demo', source: 'n_menu', sourceHandle: 'opt_demo', target: 'n_ask_demo_address' },
    { id: 'e_demo_existing', source: 'n_menu', sourceHandle: 'opt_demo_existing', target: 'n_demo_existing' },
    { id: 'e_home', source: 'n_menu', sourceHandle: 'opt_home', target: 'n_home_card' },
    { id: 'e_team', source: 'n_menu', sourceHandle: 'opt_team', target: 'n_team_handoff' },
    { id: 'e_demo_address', source: 'n_ask_demo_address', sourceHandle: 'default', target: 'n_ask_demo_date' },
    { id: 'e_demo_date', source: 'n_ask_demo_date', sourceHandle: 'default', target: 'n_ask_demo_time' },
    { id: 'e_demo_time', source: 'n_ask_demo_time', sourceHandle: 'default', target: 'n_demo_handoff' },
    { id: 'e_demo_change_yes', source: 'n_demo_existing', sourceHandle: 'opt_demo_change_yes', target: 'n_demo_change_handoff' },
    { id: 'e_demo_change_no', source: 'n_demo_existing', sourceHandle: 'opt_demo_change_no', target: 'n_demo_keep_handoff' },
    { id: 'e_order_after', source: 'n_order_status', sourceHandle: 'default', target: AFTER_MENU_ID },
    { id: 'e_lock_after', source: 'n_lock_card', sourceHandle: 'default', target: AFTER_MENU_ID },
    { id: 'e_home_after', source: 'n_home_card', sourceHandle: 'default', target: AFTER_MENU_ID },
    ...buildAfterMenuEdges('n_menu'),
  ];

  return {
    id: HESEOS_RETURNING_FLOW_ID,
    tenantId,
    name: 'Welcome Back (existing lead / order)',
    enabled: true,
    version: FLOW_VERSION,
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

// Same self-healing seed pattern as lib/heseosDefaultFlow.js's ensureHeseosDefaultFlow: inserts when
// missing, upgrades a stored copy older than FLOW_VERSION in place (keeping its enabled switch and
// createdAt), and never touches a copy already at the current version, so later Flow Builder edits
// survive.
export async function ensureHeseosReturningFlow(tenant, existingFlows) {
  const list = existingFlows || [];
  const current = list.find((f) => f.id === HESEOS_RETURNING_FLOW_ID);
  if (current && (current.version || 5) >= FLOW_VERSION) return list;
  const flow = buildHeseosReturningFlow(tenant.id);
  if (current) {
    flow.enabled = current.enabled !== false;
    flow.createdAt = current.createdAt || flow.createdAt;
  }
  await dbInsert('bot_flows', flow.id, flow);
  return current ? list.map((f) => (f.id === HESEOS_RETURNING_FLOW_ID ? flow : f)) : [...list, flow];
}
