// Heseos's own default WhatsApp flow for a customer who arrives through a QR scan or a referral
// link — "HESEOS Buddy" greets them, tells them who sent them our way (partner QR/referral, a
// location QR, or a customer referral — see lib/attribution.js's referrerNoteFor and the
// {{referrerNote}} template var), and then sends ONE tappable card whose button opens the HESEOS
// smart-home enquiry landing page (public/smart-home/index.html — see lib/heseosSmartHome.js).
// The customer fills their details there instead of answering a long chain of questions in chat.
//
// (v1 of this flow was the full in-chat questionnaire — name, city, property type, configuration,
// budget, timeline. v2 replaces it entirely: the landing page asks the same things on one screen.)
//
// The LEAD is created by the landing page's form (app/api/leads/landing/route.js), NOT by this
// flow: the page is opened with ?ref=<this chat's attribution code> (the {{landingLink}} template
// var — lib/botFlowEngine.js's templateVars), so the lead is credited to the partner / QR location /
// referrer exactly like a lead the Partner App or the old chat flow would have produced (same
// first-touch rule — lib/heseosLandingLead.js). A customer who only taps nothing never becomes a
// lead. The flow is just Start -> one message with NO handoff node, so reaching its end neither
// silences the bot nor creates a lead (see lib/botFlowEngine.js's endHandoff); if the customer
// types anything afterwards the flow simply restarts and sends the card again.
//
// ONLY reached via an actual QR-scan/referral-link attribution match (see triggers below) — a
// brand-new chat with no attribution and no existing lead gets lib/heseosOrganicFlow.js's lighter
// menu instead. A phone number that already has an open lead always overrides straight to
// lib/heseosReturningFlow.js regardless of what's picked here — see the webhook's
// `existingLeadId` handling. The webhook (app/api/bot/webhook/route.js) also sends a chat that has
// closed out an earlier lead back here for a fresh enquiry.
//
// HESEOS-BRAND content — only ever seeded for tenant.botKind === 'heseos' (see
// ensureHeseosDefaultFlow's one caller in the webhook). Fully editable afterwards in Flow Builder;
// an already-seeded older copy is upgraded in place once (FLOW_VERSION), keeping its on/off switch.

import { dbInsert } from '@/lib/db';

export const HESEOS_DEFAULT_FLOW_ID = 'heseos_default_lead_capture';
// Bumped whenever buildHeseosDefaultFlow's content changes in a way stored copies should pick up.
// 1 = the old in-chat questionnaire (no `version` field stored at all); 2 = landing-page link.
const FLOW_VERSION = 3;

const GREETING = [
  '{{referrerNote}}',
  '',
  "Namaste 🙏 I'm *HESEOS Buddy* — your smart home guide at HESEOS.",
  '',
  'We help design and set up smart switches, lighting, security cameras and voice control for homes and offices — from your very first idea to the final installation. 🏠✨',
].join('\n');

function buildHeseosDefaultFlow(tenantId) {
  const now = new Date().toISOString();

  const nodes = [
    { id: 'start', type: 'start', x: 60, y: 200, data: {} },
    {
      id: 'n_greet', type: 'message', x: 340, y: 200,
      data: {
        // Plain-text version — link included. What the Inbox transcript shows, and what a customer
        // whose WhatsApp can't render the button below receives instead.
        text: [
          GREETING,
          '',
          'Share a few details about your space here — it takes under a minute, no long chat needed 👇',
          '{{landingLink}}',
          '',
          'Our smart home expert will call you right after.',
          '',
          '— Team HESEOS',
        ].join('\n'),
        // Product-card version (lib/botFlowEngine.js's data.cta): the HESEOS poster as the header
        // image, this body, and one tappable button that opens the landing page — it opens inside
        // WhatsApp's own browser on most phones, same as the door-lock "Order Now" card.
        cta: {
          url: '{{landingLink}}',
          label: 'Share Requirement',
          imagePath: '/whatsapp/heseos-welcome-wide.jpg',
          footer: 'Team HESEOS',
          text: [
            GREETING,
            '',
            'Tap *Share Requirement* and tell us about your space — it takes under a minute, no long chat needed. Our smart home expert will call you right after.',
          ].join('\n'),
        },
      },
    },
  ];

  const edges = [
    { id: 'e_start', source: 'start', sourceHandle: 'default', target: 'n_greet' },
  ];

  return {
    id: HESEOS_DEFAULT_FLOW_ID,
    tenantId,
    name: 'Smart Home Enquiry (QR / referral → landing page)',
    enabled: true,
    version: FLOW_VERSION,
    triggers: { keywords: [], attribution: ['qr', 'referral'], isDefault: false },
    nodes,
    edges,
    createdAt: now,
    updatedAt: now,
  };
}

// Self-heals into existence the first time Heseos's own tenant's webhook fires — inserts when
// missing, and upgrades a stored copy that predates FLOW_VERSION (the v1 in-chat questionnaire) to
// the current definition, keeping its own enabled on/off switch — an admin who turned this flow
// OFF stays off. A copy already at the current version is never touched, so edits made in Flow
// Builder after this upgrade are left alone. Returns the (possibly updated) flows array so the
// caller's already-in-hand list stays correct without a second DB round trip.
export async function ensureHeseosDefaultFlow(tenant, existingFlows) {
  const list = existingFlows || [];
  const current = list.find((f) => f.id === HESEOS_DEFAULT_FLOW_ID);
  if (current && (current.version || 1) >= FLOW_VERSION) return list;
  const flow = buildHeseosDefaultFlow(tenant.id);
  if (current) {
    flow.enabled = current.enabled !== false;
    flow.createdAt = current.createdAt || flow.createdAt;
  }
  await dbInsert('bot_flows', flow.id, flow);
  return current ? list.map((f) => (f.id === HESEOS_DEFAULT_FLOW_ID ? flow : f)) : [...list, flow];
}
