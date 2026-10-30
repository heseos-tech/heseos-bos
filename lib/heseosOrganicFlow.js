// Heseos's "first message" welcome — what a genuinely new contact gets: they said "Hi" (or anything
// at all) with no QR scan, no referral link, no door-lock keyword, no open lead and no order on
// file (see lib/heseosCustomerContext.js; app/api/bot/webhook/route.js routes everyone who DOES
// have a lead or an order to lib/heseosReturningFlow.js instead, and a QR/referral scan to
// lib/heseosDefaultFlow.js).
//
// HESEOS Buddy welcomes them, shows the HESEOS poster, and asks what they want — three tappable
// buttons:
//   🏠 Smart Home       -> the landing-page card (lib/heseosDefaultFlow.js's buildLandingCardNode);
//                          the lead the form creates is labelled "WhatsApp Direct" because the link
//                          carries ?via=wa but no ref code (lib/heseosLandingLead.js)
//   🔒 I want Door Lock -> the door-lock product card (lib/heseosShoppingFlow.js's buildDoorLockCardNode)
//   💬 Talk to someone  -> hands off to the team (creates a light lead — lib/heseosLeadSync.js)
// Both cards end the flow quietly (no handoff, no lead from chat alone); whatever the customer types
// next simply starts the welcome again.
//
// Versions: 1 = greeting + poster + "new requirement / talk to team" menu; 2 = single landing card;
// 3 (this) = the three-way menu above. A stored older copy is upgraded in place, keeping its
// enabled switch (same pattern as lib/heseosDefaultFlow.js).
//
// HESEOS-brand content, only ever seeded for tenant.botKind === 'heseos'.

import { dbInsert } from '@/lib/db';
import { buildLandingCardNode } from '@/lib/heseosDefaultFlow';
import { buildDoorLockCardNode } from '@/lib/heseosShoppingFlow';
import { buildAfterMenuNodes, buildAfterMenuEdges, AFTER_MENU_ID } from '@/lib/heseosAfterMenu';

export const HESEOS_ORGANIC_FLOW_ID = 'heseos_organic_enquiry_v1';
const FLOW_VERSION = 13;
// HESEOS's own brand poster, sent right after the greeting text (lib/botFlowEngine.js's play() —
// data.imageAfter) and before the menu buttons.
const HESEOS_GREET_IMAGE = { path: '/whatsapp/heseos-welcome-wide.jpg', delayMs: 0 };

function buildHeseosOrganicFlow(tenantId) {
  const now = new Date().toISOString();

  const nodes = [
    { id: 'start', type: 'start', x: 60, y: 220, data: {} },
    {
      id: 'n_greet', type: 'message', x: 340, y: 220,
      data: {
        text: "Namaste 🙏 I'm *HESEOS Buddy* — your smart home guide at HESEOS.\n\nWhat are you looking for today? 👇",
        imageAfter: HESEOS_GREET_IMAGE,
      },
    },
    {
      id: 'n_menu', type: 'menu', x: 620, y: 220,
      data: {
        // Two unrecognised replies in a row also hand over to the team as a call request, not a lead.
        retryCallRequest: true,
        text: '',
        fieldKey: '',
        // WhatsApp reply buttons: max 3, titles up to 20 characters.
        options: [
          { id: 'opt_home', label: '🏠 Smart Home' },
          { id: 'opt_lock', label: '🔒 I want Door Lock' },
          { id: 'opt_team', label: '💬 Talk to someone' },
        ],
      },
    },
    buildLandingCardNode({ id: 'n_home_card', x: 900, y: 100, intro: false }),
    buildDoorLockCardNode({ id: 'n_lock_card', x: 900, y: 260 }),
    {
      id: 'n_team_handoff', type: 'handoff', x: 900, y: 420,
      // callRequest: the number goes to Admin -> Call Requests, NOT the leads pipeline.
      data: { text: "Of course! Connecting you with our team now — they'll be with you shortly. 😊", callRequest: true },
    },
    ...buildAfterMenuNodes({ x: 1180, y: 180 }),
  ];

  const edges = [
    { id: 'e_start', source: 'start', sourceHandle: 'default', target: 'n_greet' },
    { id: 'e_greet', source: 'n_greet', sourceHandle: 'default', target: 'n_menu' },
    { id: 'e_home', source: 'n_menu', sourceHandle: 'opt_home', target: 'n_home_card' },
    { id: 'e_lock', source: 'n_menu', sourceHandle: 'opt_lock', target: 'n_lock_card' },
    { id: 'e_team', source: 'n_menu', sourceHandle: 'opt_team', target: 'n_team_handoff' },
    // After a link card: "anything else?" -> Main menu / End chat.
    { id: 'e_home_after', source: 'n_home_card', sourceHandle: 'default', target: AFTER_MENU_ID },
    { id: 'e_lock_after', source: 'n_lock_card', sourceHandle: 'default', target: AFTER_MENU_ID },
    ...buildAfterMenuEdges('n_menu'),
  ];

  return {
    id: HESEOS_ORGANIC_FLOW_ID,
    tenantId,
    name: 'Welcome (first message → Smart Home / Door Lock / Talk)',
    enabled: true,
    version: FLOW_VERSION,
    triggers: { keywords: [], attribution: [], isDefault: true },
    nodes,
    edges,
    createdAt: now,
    updatedAt: now,
  };
}

// Inserts when missing; upgrades a stored copy older than FLOW_VERSION in place (keeping its enabled
// switch and createdAt); never touches a copy already at the current version, so later Flow Builder
// edits survive.
export async function ensureHeseosOrganicFlow(tenant, existingFlows) {
  const list = existingFlows || [];
  const current = list.find((f) => f.id === HESEOS_ORGANIC_FLOW_ID);
  if (current && (current.version || 1) >= FLOW_VERSION) return list;
  const flow = buildHeseosOrganicFlow(tenant.id);
  if (current) {
    flow.enabled = current.enabled !== false;
    flow.createdAt = current.createdAt || flow.createdAt;
  }
  await dbInsert('bot_flows', flow.id, flow);
  return current ? list.map((f) => (f.id === HESEOS_ORGANIC_FLOW_ID ? flow : f)) : [...list, flow];
}
