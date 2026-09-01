// Pulls every historical lead directly from Meta's Graph API for each form you've enabled in
// Admin -> Settings -> Meta Lead Ads, and inserts any that are missing from the `leads` table —
// no manually-copied data involved. This recovers leads submitted while the webhook connection
// wasn't working yet, and can also just be re-run any time as a safety-net sync.
//
// It reads the Page Access Token and the list of enabled forms straight out of BOS's own
// `settings` table (the same connection your Admin -> Settings page already has) — so the
// only thing you need to provide is DATABASE_URL.
//
// Usage (run from the heseos-bos project root, in your own Terminal — not through any bridge,
// since it needs real internet access to call graph.facebook.com):
//
//   DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require" node scripts/sync-meta-leads.mjs
//
// Safe to re-run any time: every lead is looked up by its id (META<leadgen_id>) before
// inserting, so anything already captured — live or by a previous run of this script — is
// skipped, never duplicated or overwritten.

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. Pass it inline, e.g.:');
  console.error('  DATABASE_URL="postgresql://..." node scripts/sync-meta-leads.mjs');
  process.exit(1);
}

const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v20.0';

// ── Field mapping — lightweight equivalent of lib/metaLeadMap.js's mapMetaLead ────────────
const STANDARD_KEYS = { full_name: 'name', email: 'email', phone_number: 'phone', city: 'city', post_code: 'postcode' };

function mapLead(fieldData = []) {
  const raw = {};
  for (const f of fieldData) raw[f.name] = Array.isArray(f.values) ? f.values.join(', ') : String(f.values || '');

  const out = { name: '', phone: '', email: '', city: '', postcode: '', productInterest: [], propertyType: '', budget: '', timeline: '', persona: '' };
  for (const [key, val] of Object.entries(raw)) {
    if (!val) continue;
    if (STANDARD_KEYS[key]) { out[STANDARD_KEYS[key]] = out[STANDARD_KEYS[key]] || val; continue; }
    if (/looking_for|type_of_home_automation|product|interest|switch|lock|curtain|door\s*phone|scene/i.test(key)) {
      if (!out.productInterest.includes(val)) out.productInterest.push(val);
      continue;
    }
    if (/apartment|property\s*type|space\s*type|bhk/i.test(key)) { out.propertyType = out.propertyType || val; continue; }
    if (/budget/i.test(key)) { out.budget = out.budget || val; continue; }
    if (/soon|timeline|when|days?/i.test(key)) { out.timeline = out.timeline || val; continue; }
    if (/define|yourself|persona|builder|architect|designer|client/i.test(key)) { out.persona = out.persona || val; continue; }
  }
  return { mapped: out, rawMetaFields: raw };
}

function istDateStr(d) {
  return new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

async function fetchAllLeads(formId, token) {
  const leads = [];
  let url = `https://graph.facebook.com/${API_VERSION}/${formId}/leads?fields=id,created_time,ad_id,field_data&limit=100&access_token=${encodeURIComponent(token)}`;
  let page = 1;
  while (url) {
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(`  Graph API error on page ${page}: ${data?.error?.message || res.status}`);
      break;
    }
    const batch = data.data || [];
    leads.push(...batch);
    console.log(`  Page ${page}: ${batch.length} leads`);
    url = data.paging?.next || null;
    page++;
  }
  return leads;
}

async function main() {
  const sql = neon(DATABASE_URL);
  await sql`CREATE TABLE IF NOT EXISTS leads (id TEXT PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT now(), data JSONB NOT NULL)`;

  const settingsRows = await sql.query("SELECT data FROM settings WHERE id = 'meta_ads' LIMIT 1");
  const settings = settingsRows[0]?.data;
  if (!settings || !settings.pageAccessToken) {
    console.error('No Meta Page connected — connect one in Admin -> Settings -> Meta Lead Ads first.');
    process.exit(1);
  }
  const token = settings.pageAccessToken;
  const enabledForms = (settings.forms || []).filter((f) => f && f.enabled);
  if (enabledForms.length === 0) {
    console.error('No forms are toggled on in Settings — nothing to sync.');
    process.exit(1);
  }

  console.log(`Page: ${settings.pageName} (${settings.pageId})`);
  console.log(`Syncing ${enabledForms.length} enabled form(s): ${enabledForms.map((f) => f.name).join(', ')}\n`);

  let totalInserted = 0, totalSkipped = 0;
  for (const form of enabledForms) {
    console.log(`=== ${form.name} (${form.id}) ===`);
    const leads = await fetchAllLeads(form.id, token);
    console.log(`  ${leads.length} total lead(s) on Meta's side.`);

    for (const lead of leads) {
      const id = `META${lead.id}`;
      const existing = await sql.query('SELECT id FROM leads WHERE id = $1 LIMIT 1', [id]);
      if (existing.length > 0) { totalSkipped++; continue; }

      const { mapped, rawMetaFields } = mapLead(lead.field_data || []);
      if (!mapped.name || !mapped.phone) {
        console.log(`  Skipping ${id} — missing name/phone after mapping.`);
        totalSkipped++;
        continue;
      }

      const createdAt = lead.created_time || new Date().toISOString();
      const now = new Date().toISOString();
      const record = {
        id,
        createdAt,
        date: istDateStr(createdAt),
        status: 'new',
        name: mapped.name, phone: mapped.phone, email: mapped.email, city: mapped.city, postcode: mapped.postcode,
        productInterest: mapped.productInterest, propertyType: mapped.propertyType, budget: mapped.budget,
        timeline: mapped.timeline, persona: mapped.persona,
        source: 'meta_lead_form',
        partnerId: null,
        metaLeadgenId: lead.id,
        metaFormId: form.id,
        metaAdId: lead.ad_id || null,
        rawMetaFields,
        contactStage: null,
        demoOutcome: null,
        assignedTo: null,
        salesEngineerId: null,
        history: [
          { at: now, event: 'Lead Submitted', by: 'meta_lead_form', note: 'Meta Instant Form' },
          { at: now, event: 'Synced', by: 'admin', note: `Pulled directly from Meta's Graph API — submitted ${createdAt}, was missing because the webhook wasn't capturing at that time.` },
        ],
      };

      await sql.query('INSERT INTO leads (id, data) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING', [id, JSON.stringify(record)]);
      console.log(`  Inserted ${id} — ${mapped.name} (${mapped.city || 'no city'})`);
      totalInserted++;
    }
    console.log('');
  }

  console.log(`Done. Inserted ${totalInserted} new lead(s), skipped ${totalSkipped} (already existed or incomplete).`);
}

main().catch((e) => { console.error('Sync failed:', e); process.exit(1); });
