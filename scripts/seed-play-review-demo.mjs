// One-off seed script — creates (or reuses) the demo partner login and gives it a few sample
// leads spanning the whole pipeline (New Lead / Demo Scheduled / Converted), so a Google Play
// reviewer logging into the Partner app with that account sees real content instead of empty
// screens. See PLAY_STORE_LISTING.md's "App access" section for why this exists — a brand-new
// partner signup starts with nothing to show, so review needs a pre-populated account instead.
//
// Reuses the SAME demo partner as scripts/seed-admin.mjs's SEED_PARTNER=1 option (phone
// 9876543210 / partner123, already documented in README's Local Development table) rather than
// inventing a second demo account — creates it here too if it doesn't exist yet, so this script
// works standalone even if you never ran seed-admin.mjs with SEED_PARTNER=1.
//
// Usage (run from the heseos-bos project root, in your own Terminal — not through any bridge;
// this sandbox has no live network/database access, same as every other scripts/*.mjs here):
//
//   DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require" node scripts/seed-play-review-demo.mjs
//
// Safe to re-run: the three sample leads use fixed ids (demoreview_new/demo/converted) and are
// upserted (ON CONFLICT DO UPDATE), so re-running just refreshes their dates to "now" instead of
// creating duplicates — handy to re-run right before a review submission so "Converted" always
// lands inside the current month for Rewards & Earnings.

import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. Pass it inline, e.g.:');
  console.error('  DATABASE_URL="postgresql://..." node scripts/seed-play-review-demo.mjs');
  process.exit(1);
}

const DEMO_PHONE = '9876543210';
const DEMO_PASSWORD = 'partner123';

// ── pbkdf2 hashing — identical scheme to lib/auth.js's hashPassword() ──────────────
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('base64url');
  const iterations = 120000;
  const key = await new Promise((resolve, reject) => {
    crypto.pbkdf2(String(password), salt, iterations, 32, 'sha256', (err, derived) =>
      err ? reject(err) : resolve(derived)
    );
  });
  return `pbkdf2$${iterations}$${salt}$${key.toString('base64url')}`;
}

function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(9).toString('base64url')}`;
}

async function main() {
  const sql = neon(DATABASE_URL);

  await sql`CREATE TABLE IF NOT EXISTS partners (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now(),
    data JSONB NOT NULL
  )`;
  await sql`CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now(),
    data JSONB NOT NULL
  )`;

  // 1. Demo partner — reuse if it already exists (same lookup seed-admin.mjs uses).
  let partnerId;
  const existingPartners = await sql`SELECT data FROM partners WHERE data->>'phone' = ${DEMO_PHONE} LIMIT 1`;
  if (existingPartners.length > 0) {
    partnerId = existingPartners[0].data.id;
    console.log(`Reusing existing demo partner (phone ${DEMO_PHONE}, id ${partnerId}).`);
  } else {
    partnerId = newId('ptr');
    const passwordHash = await hashPassword(DEMO_PASSWORD);
    const partner = {
      id: partnerId,
      name: 'Demo Partner',
      businessName: 'Heseos Demo Electronics',
      phone: DEMO_PHONE,
      password: passwordHash,
      type: 'shop',
      active: true,
      createdAt: new Date().toISOString(),
    };
    await sql`INSERT INTO partners (id, data) VALUES (${partnerId}, ${JSON.stringify(partner)}::jsonb)`;
    console.log(`Created demo partner (phone ${DEMO_PHONE}, id ${partnerId}).`);
  }

  // 2. Three sample leads covering the whole pipeline, all attributed to that partner.
  const now = new Date();
  const daysAgo = (n) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

  const leads = [
    {
      id: 'demoreview_new',
      name: 'Rohan Mehta',
      phone: '9800000001',
      city: 'Pune',
      propertyType: '2bhk',
      budget: '₹40k – ₹60k',
      configuration: 'Standard',
      timeline: 'Within 30 Days',
      source: 'partner_app',
      partnerId,
      createdAt: daysAgo(2),
    },
    {
      id: 'demoreview_demo',
      name: 'Ananya Rao',
      phone: '9800000002',
      city: 'Pune',
      propertyType: '3bhk_plus',
      budget: '₹70k – ₹1 Lakh',
      configuration: 'Premium',
      timeline: 'Within 15 Days',
      source: 'partner_app',
      partnerId,
      createdAt: daysAgo(6),
      demoScheduledAt: daysAgo(1),
      demoAddress: '221 Baner Road, Pune',
      demoDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      demoTime: '11:00 AM',
    },
    {
      id: 'demoreview_converted',
      name: 'Karan Shah',
      phone: '9800000003',
      city: 'Pune',
      propertyType: '3bhk_plus',
      budget: '₹1 Lakh & Above',
      configuration: 'Luxury',
      timeline: 'Within 15 Days',
      source: 'partner_app',
      partnerId,
      createdAt: daysAgo(10),
      demoScheduledAt: daysAgo(5),
      demoAddress: '48 Koregaon Park, Pune',
      demoDate: daysAgo(5).slice(0, 10),
      demoTime: '4:00 PM',
      demoOutcome: 'converted',
      demoOutcomeAt: now.toISOString(),
      convertedAt: now.toISOString(),
      finalPrice: 85000,
    },
  ];

  for (const lead of leads) {
    // eslint-disable-next-line no-await-in-loop
    await sql`
      INSERT INTO leads (id, data) VALUES (${lead.id}, ${JSON.stringify(lead)}::jsonb)
      ON CONFLICT (id) DO UPDATE SET data = ${JSON.stringify(lead)}::jsonb
    `;
    console.log(`Upserted lead ${lead.id} (${lead.name}).`);
  }

  console.log('');
  console.log('Done. Play Console -> App content -> App access credentials:');
  console.log(`  Phone:    ${DEMO_PHONE}`);
  console.log(`  Password: ${DEMO_PASSWORD}`);
  console.log('  Log in on the Home tab to see New Leads, a Demo Scheduled lead, and a');
  console.log('  Converted lead reflected in Rewards & Earnings.');
}

main().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
