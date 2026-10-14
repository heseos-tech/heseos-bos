// Heseos's "organic enquiry" flow — what a genuinely untracked contact gets: no QR scan, no
// referral link (see lib/heseosDefaultFlow.js's attribution triggers, and
// app/api/bot/webhook/route.js's resolveAttributionLink), and no existing lead on file for their
// phone number (an existing lead of ANY source always overrides straight to
// lib/heseosReturningFlow.js instead — see the `existingLeadId` handling in the webhook).
//
// v2: it is now the SAME one-card flow as the QR/referral one — "HESEOS Buddy" greets the person
// and sends the card whose button opens the smart-home enquiry landing page
// (lib/heseosDefaultFlow.js's buildLandingGreetNode, public/smart-home/index.html). The link has
// no ?ref= code (nobody sent this customer), only ?via=wa, so the lead the form creates is
// labelled "WhatsApp Direct" (lib/heseosLandingLead.js). v1 was a small in-chat menu ("I have a
// new requirement" / "Talk to our team") that handed off to a human; that is gone — the landing
// form captures the requirement properly and a pre-sales person calls back.
//
// Like the QR/referral flow there is NO handoff node, so the bot never goes silent and no lead
// is created from chat alone: a customer who types again simply gets the card again.
//
// This is the FALLBACK DEFAULT for any brand-new Heseos chat with no attribution match (see its
// triggers.isDefault below). HESEOS-brand content, only ever seeded for tenant.botKind === 'heseos'.

import { dbInsert } from '@/lib/db';
import { buildLandingGreetNode } from '@/lib/heseosDefaultFlow';

export const HESEOS_ORGANIC_FLOW_ID = 'heseos_organic_enquiry_v1';
// Bumped whenever buildHeseosOrganicFlow's content changes in a way stored copies should pick up.
// 1 = greeting + poster + two-option menu (no `version` stored); 2 = landing-page card.
const FLOW_VERSION = 2;

function buildHeseosOrganicFlow(tenantId) {
  const now = new Date().toISOString();
  return {
    id: HESEOS_ORGANIC_FLOW_ID,
    tenantId,
    name: 'Direct Enquiry (no referral → landing page)',
    enabled: true,
    version: FLOW_VERSION,
    triggers: { keywords: [], attribution: [], isDefault: true },
    nodes: [
      { id: 'start', type: 'start', x: 60, y: 200, data: {} },
      buildLandingGreetNode(),
    ],
    edges: [{ id: 'e_start', source: 'start', sourceHandle: 'default', target: 'n_greet' }],
    createdAt: now,
    updatedAt: now,
  };
}

// Same self-healing seed pattern as lib/heseosDefaultFlow.js: inserts when missing, upgrades a
// stored copy older than FLOW_VERSION in place (keeping its enabled switch and createdAt), and
// never touches a copy already at the current version, so later Flow Builder edits survive.
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
