// Heseos's own default WhatsApp lead-capture flow — "HESEOS Buddy" greets a customer, tells
// them who sent them our way (partner QR/referral, a location QR, or a customer referral — see
// lib/attribution.js's referrerNoteFor and the {{referrerNote}} template var), asks whether they
// want a smart home, and only THEN — if they say yes — walks them through the same requirement
// questions a partner would ask in the Partner App's Add Lead wizard (components/partner/
// LeadWizard.jsx): name, city, property type, configuration, budget (branches per property
// type — see lib/formOptions.js's BUDGET_BY_PROPERTY) and timeline. Answers sync onto the real
// lead as they're collected (lib/heseosLeadSync.js's syncLeadField); the LEAD ITSELF is only
// ever created once the whole journey completes and this flow reaches its handoff node — see
// lib/heseosLeadSync.js's finalizeHeseosLead, called from lib/botFlowEngine.js's endHandoff.
// That's deliberate: a customer who only ever says "hi" (or says "Not right now") must never
// show up as a lead — see app/api/bot/webhook/route.js's chat-creation branch for the other half
// of that change.
//
// This is HESEOS-BRAND content — the "welcome to the HESEOS family" copy below is only ever
// seeded for tenant.botKind === 'heseos' (see ensureHeseosDefaultFlow's one caller in
// app/api/bot/webhook/route.js). White-label tenants get no flow at all until they build their
// own in Flow Builder; nothing here ever touches their bot_flows rows.
//
// Fully editable afterwards: this is seeded as a completely normal bot_flows row — HESEOS's own
// team can open Bot Console → Flow Builder and tweak any line of copy, add languages, or
// restructure it like any flow they'd built by hand. Seeding it here just means day one already
// has a real, working flow instead of a blank canvas.

import { dbInsert } from '@/lib/db';

export const HESEOS_DEFAULT_FLOW_ID = 'heseos_default_lead_capture';

const Y = { greet: 20, propertyRow: [20, 220, 420, 620] };

function propertyBranch({ key, ptOptionId, x, y, budgetOptions }) {
  return {
    configNode: {
      id: `n_config_${key}`, type: 'menu', x, y,
      data: {
        text: 'Perfect 👍 What kind of setup are you picturing — how premium should it feel? 👇',
        fieldKey: 'configuration',
        options: [
          { id: `cfg_${key}_standard`, label: 'Standard' },
          { id: `cfg_${key}_premium`, label: 'Premium' },
          { id: `cfg_${key}_luxury`, label: 'Luxury' },
        ],
      },
    },
    budgetNode: {
      id: `n_budget_${key}`, type: 'menu', x: x + 280, y,
      data: {
        text: 'And what budget range are you comfortable with for this? 💰',
        fieldKey: 'budget',
        options: budgetOptions.map((l, i) => ({ id: `bud_${key}_${i}`, label: l })),
      },
    },
    edges: [
      { id: `e_pt_${key}`, source: 'n_ask_propertytype', sourceHandle: ptOptionId, target: `n_config_${key}` },
      { id: `e_cfg_${key}_standard`, source: `n_config_${key}`, sourceHandle: `cfg_${key}_standard`, target: `n_budget_${key}` },
      { id: `e_cfg_${key}_premium`, source: `n_config_${key}`, sourceHandle: `cfg_${key}_premium`, target: `n_budget_${key}` },
      { id: `e_cfg_${key}_luxury`, source: `n_config_${key}`, sourceHandle: `cfg_${key}_luxury`, target: `n_budget_${key}` },
      ...budgetOptions.map((_, i) => ({ id: `e_bud_${key}_${i}`, source: `n_budget_${key}`, sourceHandle: `bud_${key}_${i}`, target: 'n_timeline' })),
    ],
  };
}

function buildHeseosDefaultFlow(tenantId) {
  const now = new Date().toISOString();

  const branches = [
    propertyBranch({ key: '1bhk', ptOptionId: 'pt_1bhk', x: 1740, y: Y.propertyRow[0], budgetOptions: ['₹20k – ₹40k', '₹40k – ₹60k', '₹60k & Above'] }),
    propertyBranch({ key: '2bhk', ptOptionId: 'pt_2bhk', x: 1740, y: Y.propertyRow[1], budgetOptions: ['₹40k – ₹60k', '₹60k – ₹90k', '₹90k & Above'] }),
    propertyBranch({ key: '3bhk', ptOptionId: 'pt_3bhk', x: 1740, y: Y.propertyRow[2], budgetOptions: ['₹50k – ₹70k', '₹70k – ₹1 Lakh', '₹1 Lakh & Above'] }),
    propertyBranch({ key: 'commercial', ptOptionId: 'pt_commercial', x: 1740, y: Y.propertyRow[3], budgetOptions: ['₹50k – ₹90k', '₹90k – ₹1.5 Lakh', '₹2 Lakh & Above'] }),
  ];

  const nodes = [
    { id: 'start', type: 'start', x: 60, y: 320, data: {} },
    {
      id: 'n_greet', type: 'message', x: 340, y: 320,
      data: { text: "{{referrerNote}}\n\nNamaste 🙏 I'm *{{botName}}* — your smart home guide at HESEOS.\n\nWe help design and set up smart switches, lighting, security cameras and voice control for homes and offices — from your very first idea to the final installation. 🏠✨" },
    },
    {
      id: 'n_ask_smart', type: 'menu', x: 620, y: 320,
      data: {
        text: 'So tell me… would you like to explore making your home or office smart? 👇',
        fieldKey: '',
        options: [
          { id: 'opt_yes', label: "Yes, let's do it! 🙂" },
          { id: 'opt_no', label: 'Not right now' },
        ],
      },
    },
    {
      id: 'n_no_thanks', type: 'message', x: 900, y: 520,
      data: { text: "No worries at all! 😊 Whenever you're ready to explore a smarter home, just message *Hi* here and I'll be right back to help.\n\nHave a wonderful day! 🌟" },
    },
    {
      id: 'n_ask_name', type: 'question', x: 900, y: 220,
      data: { text: "Wonderful! 🎉 Let's get started — what's your *full name*?", fieldKey: 'name' },
    },
    {
      id: 'n_ask_city', type: 'question', x: 1180, y: 220,
      data: { text: 'Thanks, {{name}}! 😊 Which *city* are you in?', fieldKey: 'city' },
    },
    {
      id: 'n_ask_propertytype', type: 'menu', x: 1460, y: 220,
      data: {
        text: 'Great! Now tell me about your space — what type of property is this for? 👇',
        fieldKey: 'propertyType',
        options: [
          { id: 'pt_1bhk', label: '1 BHK Apartment' },
          { id: 'pt_2bhk', label: '2 BHK Apartment' },
          { id: 'pt_3bhk', label: '3 BHK & Above / Villa' },
          { id: 'pt_commercial', label: 'Office / Commercial' },
        ],
      },
    },
    ...branches.flatMap((b) => [b.configNode, b.budgetNode]),
    {
      id: 'n_timeline', type: 'menu', x: 2300, y: 320,
      data: {
        text: 'Last one! ⏱️ When are you looking to get started?',
        fieldKey: 'timeline',
        options: [
          { id: 'tl_15', label: 'Within 15 Days' },
          { id: 'tl_30', label: 'Within 30 Days' },
          { id: 'tl_45', label: 'Within 45 Days' },
          { id: 'tl_beyond', label: '45 Days & Beyond' },
        ],
      },
    },
    {
      id: 'n_handoff', type: 'handoff', x: 2580, y: 320,
      data: { text: "That's everything I need, {{name}}! 🙌\n\nHere's what happens next:\n✅ Our smart home expert will review your requirement\n✅ They'll personally reach out within 24 hours\n✅ You'll get a customised plan + free consultation\n\nThank you for choosing *{{botName}}* — welcome to the HESEOS family! 🏡💙" },
    },
  ];

  const edges = [
    { id: 'e_start', source: 'start', sourceHandle: 'default', target: 'n_greet' },
    { id: 'e_greet', source: 'n_greet', sourceHandle: 'default', target: 'n_ask_smart' },
    { id: 'e_yes', source: 'n_ask_smart', sourceHandle: 'opt_yes', target: 'n_ask_name' },
    { id: 'e_no', source: 'n_ask_smart', sourceHandle: 'opt_no', target: 'n_no_thanks' },
    { id: 'e_name', source: 'n_ask_name', sourceHandle: 'default', target: 'n_ask_city' },
    { id: 'e_city', source: 'n_ask_city', sourceHandle: 'default', target: 'n_ask_propertytype' },
    ...branches.flatMap((b) => b.edges),
    { id: 'e_tl_15', source: 'n_timeline', sourceHandle: 'tl_15', target: 'n_handoff' },
    { id: 'e_tl_30', source: 'n_timeline', sourceHandle: 'tl_30', target: 'n_handoff' },
    { id: 'e_tl_45', source: 'n_timeline', sourceHandle: 'tl_45', target: 'n_handoff' },
    { id: 'e_tl_beyond', source: 'n_timeline', sourceHandle: 'tl_beyond', target: 'n_handoff' },
  ];

  return {
    id: HESEOS_DEFAULT_FLOW_ID,
    tenantId,
    name: 'Smart Home Enquiry (default)',
    enabled: true,
    triggers: { keywords: [], attribution: [], isDefault: true },
    nodes,
    edges,
    createdAt: now,
    updatedAt: now,
  };
}

// Self-heals into existence the first time Heseos's own tenant's webhook fires — mirrors
// app/api/bot/config/route.js's waVerifyToken backfill: a brand-new platform capability that an
// existing (or freshly signed-up) Heseos tenant row shouldn't need a manual setup step for.
// Only ever INSERTS when a flow with this exact id doesn't already exist in `existingFlows` — a
// team member who has opened Flow Builder and edited its wording keeps every edit forever; this
// never overwrites an existing row, only fills the gap when it's missing entirely. Returns the
// (possibly updated) flows array so the caller's already-in-hand list stays correct without a
// second DB round trip.
export async function ensureHeseosDefaultFlow(tenant, existingFlows) {
  if ((existingFlows || []).some((f) => f.id === HESEOS_DEFAULT_FLOW_ID)) return existingFlows;
  const flow = buildHeseosDefaultFlow(tenant.id);
  await dbInsert('bot_flows', flow.id, flow);
  return [...(existingFlows || []), flow];
}
