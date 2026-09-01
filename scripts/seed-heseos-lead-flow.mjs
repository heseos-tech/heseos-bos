// One-off seed script — inserts Heseos's own end-to-end customer-journey lead-capture flow as a
// bot_flows row, ready to switch on in Flow Builder (Bot Console → Flow Builder). This flow
// greets a customer arriving from a QR scan, a referral link, or just saying "hi" on WhatsApp,
// walks them through the same fields a partner fills in on the Add Lead wizard (name, city,
// property type, budget, configuration, timeline), and hands off with a thank-you — see
// lib/heseosLeadSync.js for how each answer lands on the actual lead record, and
// lib/attribution.js's referrerNoteFor() for the "so-and-so said you might love this" opener.
//
// This is Heseos-ONLY by design: the flow only ever affects a chat that already has a
// leadId, which the platform only ever sets for the tenant marked as the Heseos Bot (botKind
// === 'heseos' — see Settings → Bot Signups). A white-label tenant can freely build and enable
// its own flows without any of this lead-sync behaviour ever running for them.
//
// Why this has to be a script instead of something Claude inserts directly: this sandbox has no
// live network/database access — only you, running this in your own Terminal against your real
// Neon database, can actually write the row.
//
// Usage (run from the heseos-bos project root, in your own Terminal — not through any bridge):
//
//   DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require" node scripts/seed-heseos-lead-flow.mjs
//
// Safe to re-run: if a flow named "Heseos Lead Capture" already exists for the Heseos tenant,
// this leaves it alone rather than inserting a duplicate — delete it first in Flow Builder (or
// rename the existing one) if you want a fresh copy.

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. Pass it inline, e.g.:');
  console.error('  DATABASE_URL="postgresql://..." node scripts/seed-heseos-lead-flow.mjs');
  process.exit(1);
}

function newId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

// Same vocabulary as the Partner App's Add Lead wizard — see lib/formOptions.js /
// lib/partnerMock.js / components/partner/LeadWizard.jsx. Kept as plain literals here (this
// script runs standalone, outside the Next.js module graph) but every value below was copied
// verbatim from those files — keep them in sync if that vocabulary ever changes.
const PROPERTY_TYPES = [
  { v: '1bhk', l: '1 BHK Apartment' },
  { v: '2bhk', l: '2 BHK Apartment' },
  { v: '3bhk_plus', l: '3 BHK & Above / Villa' },
  { v: 'commercial', l: 'Office / Commercial' },
];
const BUDGET_BY_PROPERTY = {
  '1bhk': [{ l: '₹20k – ₹40k' }, { l: '₹40k – ₹60k' }, { l: '₹60k & Above' }],
  '2bhk': [{ l: '₹40k – ₹60k' }, { l: '₹60k – ₹90k' }, { l: '₹90k & Above' }],
  '3bhk_plus': [{ l: '₹50k – ₹70k' }, { l: '₹70k – ₹1 Lakh' }, { l: '₹1 Lakh & Above' }],
  commercial: [{ l: '₹50k – ₹90k' }, { l: '₹90k – ₹1.5 Lakh' }, { l: '₹2 Lakh & Above' }],
};
const CONFIGURATION = ['Standard', 'Premium', 'Luxury'];
const TIMELINE = ['Within 15 Days', 'Within 30 Days', 'Within 45 Days', '45 Days & Beyond'];

function opt(label) {
  return { id: newId('opt'), label };
}

function buildFlow() {
  const nodes = [];
  const edges = [];
  const addNode = (n) => { nodes.push(n); return n; };
  const addEdge = (source, sourceHandle, target) => edges.push({ id: newId('edge'), source, sourceHandle: sourceHandle || 'default', target });

  const start = addNode({ id: newId('node'), type: 'start', x: 40, y: 360, data: {} });

  const greet = addNode({
    id: newId('node'), type: 'message', x: 320, y: 360,
    data: {
      text: "{{referrerNote}}\n\nHi! 👋 Welcome to {{business}}. I'm {{botName}}, and I'm here to help you explore smart home automation for your space.",
    },
  });
  addEdge(start.id, 'default', greet.id);

  const qName = addNode({
    id: newId('node'), type: 'question', x: 600, y: 200,
    data: { text: 'First things first — what should I call you? 😊', fieldKey: 'name' },
  });
  addEdge(greet.id, 'default', qName.id);

  const qCity = addNode({
    id: newId('node'), type: 'question', x: 600, y: 360,
    data: { text: 'Nice to meet you, {{name}}! Which city are you in?', fieldKey: 'city' },
  });
  addEdge(qName.id, 'default', qCity.id);

  const menuPtype = addNode({
    id: newId('node'), type: 'menu', x: 880, y: 360,
    data: {
      text: 'Great! Now tell me a bit about your space — what type of property is this for?',
      fieldKey: 'propertyType',
      options: PROPERTY_TYPES.map((p) => opt(p.l)),
    },
  });
  addEdge(qCity.id, 'default', menuPtype.id);

  const menuConfig = addNode({
    id: newId('node'), type: 'menu', x: 1440, y: 360,
    data: {
      text: 'Awesome. And what kind of setup are you looking for?',
      fieldKey: 'configuration',
      options: CONFIGURATION.map((l) => opt(l)),
    },
  });

  // One budget menu per property type — Y-spread around the property-type menu, each reached
  // only from that property type's own option (mirrors the Partner App wizard's conditional
  // budget dropdown), all converging back into the single Configuration menu above.
  PROPERTY_TYPES.forEach((p, i) => {
    const budgetOptions = BUDGET_BY_PROPERTY[p.v];
    const menuBudget = addNode({
      id: newId('node'), type: 'menu', x: 1160, y: 120 + i * 220,
      data: {
        text: `Got it! What's your budget range for this ${p.l}?`,
        fieldKey: 'budget',
        options: budgetOptions.map((b) => opt(b.l)),
      },
    });
    const ptypeOption = menuPtype.data.options[i];
    addEdge(menuPtype.id, ptypeOption.id, menuBudget.id);
    menuBudget.data.options.forEach((o) => addEdge(menuBudget.id, o.id, menuConfig.id));
  });

  const menuTimeline = addNode({
    id: newId('node'), type: 'menu', x: 1720, y: 360,
    data: {
      text: 'Just one last thing — when are you planning to get started?',
      fieldKey: 'timeline',
      options: TIMELINE.map((l) => opt(l)),
    },
  });
  menuConfig.data.options.forEach((o) => addEdge(menuConfig.id, o.id, menuTimeline.id));

  const handoff = addNode({
    id: newId('node'), type: 'handoff', x: 2000, y: 360,
    data: {
      text: "Thank you so much, {{name}}! 🙌 Our Customer Success team now has everything they need and will reach out to you shortly to take this forward. Talk soon!",
    },
  });
  menuTimeline.data.options.forEach((o) => addEdge(menuTimeline.id, o.id, handoff.id));

  return { nodes, edges };
}

async function main() {
  const sql = neon(DATABASE_URL);

  await sql`CREATE TABLE IF NOT EXISTS bot_tenants (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now(),
    data JSONB NOT NULL
  )`;
  await sql`CREATE TABLE IF NOT EXISTS bot_flows (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now(),
    data JSONB NOT NULL
  )`;

  const tenantRows = await sql`SELECT data FROM bot_tenants WHERE data->>'botKind' = 'heseos' OR data->>'linkToHeseosLeads' = 'true' LIMIT 1`;
  const tenant = tenantRows[0]?.data;
  if (!tenant) {
    console.error("No tenant is marked as the Heseos Bot yet. In the app, go to Settings → Bot Signups and mark your in-house tenant as \"Heseos Bot\" first, then re-run this script.");
    process.exit(1);
  }

  const existing = await sql`SELECT data FROM bot_flows WHERE data->>'tenantId' = ${tenant.id} AND data->>'name' = 'Heseos Lead Capture' LIMIT 1`;
  if (existing.length > 0) {
    console.log(`A flow named "Heseos Lead Capture" already exists for tenant ${tenant.id} (flow ${existing[0].data.id}) — leaving it as-is. Delete or rename it in Flow Builder first if you want a fresh copy.`);
    process.exit(0);
  }

  const { nodes, edges } = buildFlow();
  const id = newId('flow');
  const now = new Date().toISOString();
  const flow = {
    id,
    tenantId: tenant.id,
    name: 'Heseos Lead Capture',
    enabled: false, // review it in Flow Builder and flip the switch on when you're happy with it
    triggers: { keywords: [], attribution: ['qr', 'referral'], isDefault: true },
    nodes,
    edges,
    createdAt: now,
    updatedAt: now,
  };
  await sql`INSERT INTO bot_flows (id, data) VALUES (${id}, ${JSON.stringify(flow)}::jsonb)`;

  console.log(`Created flow "Heseos Lead Capture" (${id}) for tenant ${tenant.id} — ${nodes.length} nodes, ${edges.length} edges.`);
  console.log('It is saved DISABLED and marked as the fallback/default flow (also matches QR + referral attribution). Open it in Flow Builder, review the wording, then switch it on when ready.');
  console.log('Done.');
}

main().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
