// One-off backfill script — recovers real Meta Instant Form leads that were submitted while
// the Meta Lead Ads connection was broken (before the Page was properly subscribed). These
// leads never triggered the webhook, so they were never captured — but they still exist on
// Meta's side and were pulled via Graph API Explorer (GET /{form-id}/leads).
//
// This inserts them using the same shape/logic app/api/leads/meta-webhook/route.js uses, so
// they render identically to normally-captured Meta leads. Two entries that looked like
// internal test submissions (your own name/phone, and a submission literally named "Heseos")
// were excluded — add them back into the LEADS array below if you actually want them kept.
//
// Usage (run from the heseos-bos project root, in your own Terminal — not through any bridge):
//
//   DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require" node scripts/backfill-meta-leads.mjs
//
// Safe to re-run: any lead whose id (META<leadgen_id>) already exists in the leads table is
// skipped, never overwritten — so partial runs / retries won't duplicate or clobber anything.
//
// Note: auto-assignment-by-city (normally done by lib/leadAssign.js when a lead is first
// captured) is NOT replicated here to keep this script self-contained — every backfilled lead
// lands unassigned, exactly like a lead with no city match would. Assign manually from the
// Leads table afterward if needed.

import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. Pass it inline, e.g.:');
  console.error('  DATABASE_URL="postgresql://..." node scripts/backfill-meta-leads.mjs');
  process.exit(1);
}

const FORM_ID = '2321172021747293'; // Smart Home Automation - Kolkata
const PAGE_NAME = 'Heseos';

// Raw field_data exactly as returned by Meta's Graph API (GET /{form-id}/leads), for the 23
// real (non-test) leads found on this form as of 2026-09-01.
const LEADS = [
  { id: '1054501703857697', created_time: '2026-08-31T17:09:57+0000', field_data: [
    { name: 'full_name', values: ['♡~ Aman Gaziأمان غازي ~♡'] }, { name: 'phone_number', values: ['+919804152593'] },
    { name: 'email', values: ['aman.gazi1990@gmail.com'] }, { name: 'city', values: ['Kolkata'] }, { name: 'post_code', values: ['700070'] },
    { name: 'what_are_you_looking_for_?', values: ['partial_home_automation'] }, { name: 'type_of_home_automation?', values: ['behind_switch_module'] },
    { name: 'your_apartment_size', values: ['3bhk_&_above'] }, { name: 'what_is_your_budget_for_3bhk_&_above?', values: ['50k_-_70k'] },
    { name: 'how_soon_you_want_to_automate_your_space_?', values: ['within_15_days'] }, { name: 'how_will_you_define_yourself?', values: ['builder'] },
  ]},
  { id: '1400615972255766', created_time: '2026-08-31T04:48:45+0000', field_data: [
    { name: 'how_will_you_define_yourself?', values: ['end_client'] }, { name: 'type_of_home_automation?', values: ['touch_panel'] },
    { name: 'full_name', values: ['Ramesh Sharma'] }, { name: 'what_are_you_looking_for_?', values: ['partial_home_automation'] },
    { name: 'city', values: ['Bidhannagar'] }, { name: 'post_code', values: ['700102'] }, { name: 'how_soon_you_want_to_automate_your_space_?', values: ['within_45_days'] },
    { name: 'what_is_your_budget_for_3bhk_&_above?', values: ['1_lakh_&_above'] }, { name: 'phone_number', values: ['+919836659972'] },
    { name: 'your_apartment_size', values: ['3bhk_&_above'] }, { name: 'email', values: ['rsharma_lawyer@yahoo.co.in'] },
  ]},
  { id: '1643465563866884', created_time: '2026-08-30T20:35:17+0000', field_data: [
    { name: 'what_are_you_looking_for_?', values: ['partial_home_automation'] }, { name: 'type_of_home_automation?', values: ['touch_panel'] },
    { name: 'your_apartment_size', values: ['3bhk_&_above'] }, { name: 'what_is_your_budget_for_3bhk_&_above?', values: ['50k_-_70k'] },
    { name: 'how_soon_you_want_to_automate_your_space_?', values: ['45_days_&_beyond'] }, { name: 'how_will_you_define_yourself?', values: ['builder'] },
    { name: 'full_name', values: ['zafar hussain'] }, { name: 'phone_number', values: ['+917003502924'] }, { name: 'email', values: ['zafarhussain7786@gmail.com'] },
    { name: 'city', values: ['Kolkata'] }, { name: 'post_code', values: ['700136'] },
  ]},
  { id: '1395277579367106', created_time: '2026-08-30T19:53:29+0000', field_data: [
    { name: 'how_will_you_define_yourself?', values: ['interior_designer'] }, { name: 'type_of_home_automation?', values: ['touch_panel'] },
    { name: 'full_name', values: ['farid'] }, { name: 'what_are_you_looking_for_?', values: ['complete_home_automation'] },
    { name: 'city', values: ['Kolkata'] }, { name: 'post_code', values: ['700017'] }, { name: 'how_soon_you_want_to_automate_your_space_?', values: ['within_15_days'] },
    { name: 'what_is_your_budget_for_3bhk_&_above?', values: ['50k_-_70k'] }, { name: 'phone_number', values: ['+919831126414'] },
    { name: 'your_apartment_size', values: ['3bhk_&_above'] }, { name: 'email', values: ['fatidxlnc@hotmail.com'] },
  ]},
  { id: '1778494463290357', created_time: '2026-08-30T16:51:40+0000', field_data: [
    { name: 'how_will_you_define_yourself?', values: ['end_client'] }, { name: 'type_of_home_automation?', values: ['touch_panel'] },
    { name: 'full_name', values: ['shristi Raj Anand'] }, { name: 'what_are_you_looking_for_?', values: ['complete_home_automation'] },
    { name: 'city', values: ['Kolkata'] }, { name: 'post_code', values: ['700135'] }, { name: 'what_is_your_budget_for_2bhk?', values: ['40k_-_60k'] },
    { name: 'how_soon_you_want_to_automate_your_space_?', values: ['within_30_days'] }, { name: 'phone_number', values: ['+919608790971'] },
    { name: 'your_apartment_size', values: ['2bhk'] }, { name: 'email', values: ['shristiraj@hotmail.com'] },
  ]},
  { id: '1636507221376037', created_time: '2026-08-30T14:25:26+0000', field_data: [
    { name: 'how_will_you_define_yourself?', values: ['end_client'] }, { name: 'type_of_home_automation?', values: ['touch_panel'] },
    { name: 'full_name', values: ['Sourav Banerjee'] }, { name: 'what_are_you_looking_for_?', values: ['complete_home_automation'] },
    { name: 'city', values: ['howrah'] }, { name: 'post_code', values: ['711101'] }, { name: 'how_soon_you_want_to_automate_your_space_?', values: ['45_days_&_beyond'] },
    { name: 'what_is_your_budget_for_3bhk_&_above?', values: ['1_lakh_&_above'] }, { name: 'phone_number', values: ['+918902751288'] },
    { name: 'your_apartment_size', values: ['3bhk_&_above'] }, { name: 'email', values: ['souravbhel@gmail.com'] },
  ]},
  { id: '1421525559430368', created_time: '2026-08-30T03:07:25+0000', field_data: [
    { name: 'what_is_your_budget_for_1_bhk?', values: ['20k_-_40k'] }, { name: 'how_will_you_define_yourself?', values: ['end_client'] },
    { name: 'type_of_home_automation?', values: ['touch_panel'] }, { name: 'full_name', values: ['Gopal Saha'] },
    { name: 'what_are_you_looking_for_?', values: ['complete_home_automation'] }, { name: 'city', values: ['Vasai Palghar'] },
    { name: 'post_code', values: ['401208'] }, { name: 'how_soon_you_want_to_automate_your_space_?', values: ['within_15_days'] },
    { name: 'phone_number', values: ['+919768303006'] }, { name: 'your_apartment_size', values: ['1bhk'] }, { name: 'email', values: ['gartmural792@gmail.com'] },
  ]},
  { id: '1453867753293448', created_time: '2026-08-29T20:41:37+0000', field_data: [
    { name: 'how_will_you_define_yourself?', values: ['end_client'] }, { name: 'type_of_home_automation?', values: ['touch_panel'] },
    { name: 'full_name', values: ['Sreeprad Bhiwaniwala'] }, { name: 'what_are_you_looking_for_?', values: ['complete_home_automation'] },
    { name: 'city', values: ['Kolkata'] }, { name: 'post_code', values: ['700102'] }, { name: 'how_soon_you_want_to_automate_your_space_?', values: ['45_days_&_beyond'] },
    { name: 'what_is_your_budget_for_3bhk_&_above?', values: ['50k_-_70k'] }, { name: 'phone_number', values: ['+918100933358'] },
    { name: 'your_apartment_size', values: ['3bhk_&_above'] }, { name: 'email', values: ['casreeprad@gmail.com'] },
  ]},
  { id: '1597520025502538', created_time: '2026-08-29T18:46:32+0000', field_data: [
    { name: 'what_are_you_looking_for_?', values: ['partial_home_automation'] }, { name: 'type_of_home_automation?', values: ['touch_panel'] },
    { name: 'your_apartment_size', values: ['3bhk_&_above'] }, { name: 'what_is_your_budget_for_3bhk_&_above?', values: ['50k_-_70k'] },
    { name: 'how_soon_you_want_to_automate_your_space_?', values: ['within_30_days'] }, { name: 'how_will_you_define_yourself?', values: ['builder'] },
    { name: 'full_name', values: ['VVikash Poddar'] }, { name: 'phone_number', values: ['+919874462222'] }, { name: 'email', values: ['info@krishnarealtors.com'] },
    { name: 'city', values: ['Kolkata'] }, { name: 'post_code', values: ['700091'] },
  ]},
  { id: '925461370154995', created_time: '2026-08-29T18:34:39+0000', field_data: [
    { name: 'how_will_you_define_yourself?', values: ['end_client'] }, { name: 'type_of_home_automation?', values: ['touch_panel'] },
    { name: 'full_name', values: ['Subhra Chatterjee'] }, { name: 'what_are_you_looking_for_?', values: ['complete_home_automation'] },
    { name: 'city', values: ['Kolkata'] }, { name: 'post_code', values: ['700136'] }, { name: 'how_soon_you_want_to_automate_your_space_?', values: ['45_days_&_beyond'] },
    { name: 'what_is_your_budget_for_3bhk_&_above?', values: ['50k_-_70k'] }, { name: 'phone_number', values: ['+919176722776'] },
    { name: 'your_apartment_size', values: ['3bhk_&_above'] }, { name: 'email', values: ['subhro60@gmail.com'] },
  ]},
  { id: '1596606382212285', created_time: '2026-08-29T16:11:14+0000', field_data: [
    { name: 'full_name', values: ['Emonangan Saha'] }, { name: 'phone_number', values: ['+919804404062'] }, { name: 'email', values: ['angansahanaihati@gmail.com'] },
    { name: 'city', values: ['Sodepur'] }, { name: 'post_code', values: ['743165'] }, { name: 'what_are_you_looking_for_?', values: ['partial_home_automation'] },
    { name: 'type_of_home_automation?', values: ['behind_switch_module'] }, { name: 'your_apartment_size', values: ['2bhk'] },
    { name: 'what_is_your_budget_for_2bhk?', values: ['40k_-_60k'] }, { name: 'how_soon_you_want_to_automate_your_space_?', values: ['within_15_days'] },
    { name: 'how_will_you_define_yourself?', values: ['end_client'] },
  ]},
  { id: '1390292209896002', created_time: '2026-08-29T10:22:53+0000', field_data: [
    { name: 'what_are_you_looking_for_?', values: ['complete_home_automation'] }, { name: 'type_of_home_automation?', values: ['touch_panel'] },
    { name: 'your_apartment_size', values: ['3bhk_&_above'] }, { name: 'what_is_your_budget_for_3bhk_&_above?', values: ['50k_-_70k'] },
    { name: 'how_soon_you_want_to_automate_your_space_?', values: ['45_days_&_beyond'] }, { name: 'how_will_you_define_yourself?', values: ['end_client'] },
    { name: 'full_name', values: ['Syeed Shafi'] }, { name: 'phone_number', values: ['+919073067786'] }, { name: 'email', values: ['syeed_shafi@yahoo.com'] },
    { name: 'city', values: ['Kolkata'] }, { name: 'post_code', values: ['700039'] },
  ]},
  { id: '815880958253633', created_time: '2026-08-29T10:05:59+0000', field_data: [
    { name: 'how_will_you_define_yourself?', values: ['end_client'] }, { name: 'type_of_home_automation?', values: ['touch_panel'] },
    { name: 'full_name', values: ['Mousumi guha De'] }, { name: 'what_are_you_looking_for_?', values: ['complete_home_automation'] },
    { name: 'city', values: ['kolkata'] }, { name: 'post_code', values: ['700075'] }, { name: 'what_is_your_budget_for_2bhk?', values: ['40k_-_60k'] },
    { name: 'how_soon_you_want_to_automate_your_space_?', values: ['within_30_days'] }, { name: 'phone_number', values: ['+917044096563'] },
    { name: 'your_apartment_size', values: ['2bhk'] }, { name: 'email', values: ['fsppl13@gmail.com'] },
  ]},
  { id: '1976009893084790', created_time: '2026-08-29T08:17:11+0000', field_data: [
    { name: 'how_will_you_define_yourself?', values: ['end_client'] }, { name: 'type_of_home_automation?', values: ['touch_panel'] },
    { name: 'full_name', values: ['Sanjib kumar Raha'] }, { name: 'what_are_you_looking_for_?', values: ['partial_home_automation'] },
    { name: 'city', values: ['kolkata'] }, { name: 'post_code', values: ['700106'] }, { name: 'how_soon_you_want_to_automate_your_space_?', values: ['45_days_&_beyond'] },
    { name: 'what_is_your_budget_for_3bhk_&_above?', values: ['50k_-_70k'] }, { name: 'phone_number', values: ['+919830595048'] },
    { name: 'your_apartment_size', values: ['3bhk_&_above'] }, { name: 'email', values: ['sanjibraha007@gmail.com'] },
  ]},
  { id: '2150015952564446', created_time: '2026-08-29T07:44:37+0000', field_data: [
    { name: 'what_are_you_looking_for_?', values: ['complete_home_automation'] }, { name: 'type_of_home_automation?', values: ['touch_panel'] },
    { name: 'your_apartment_size', values: ['2bhk'] }, { name: 'what_is_your_budget_for_2bhk?', values: ['90k_&_above'] },
    { name: 'how_soon_you_want_to_automate_your_space_?', values: ['within_15_days'] }, { name: 'how_will_you_define_yourself?', values: ['end_client'] },
    { name: 'full_name', values: ['Tanmoy Chatterjee'] }, { name: 'phone_number', values: ['+919674415209'] }, { name: 'email', values: ['tanmoychatterjee26@gmail.com'] },
    { name: 'city', values: ['Kolkata'] }, { name: 'post_code', values: ['700050'] },
  ]},
  { id: '1828994654931139', created_time: '2026-08-29T07:02:18+0000', field_data: [
    { name: 'post_code', values: ['700080'] }, { name: 'your_apartment_size', values: ['3bhk_&_above'] }, { name: 'type_of_home_automation?', values: ['touch_panel'] },
    { name: 'city', values: ['Kolkata'] }, { name: 'how_will_you_define_yourself?', values: ['end_client'] },
    { name: 'what_is_your_budget_for_3bhk_&_above?', values: ['50k_-_70k'] }, { name: 'email', values: ['nkr98@yahoo.co.in'] },
    { name: 'full_name', values: ['Narendra Ravi'] }, { name: 'what_are_you_looking_for_?', values: ['complete_home_automation'] },
    { name: 'phone_number', values: ['+919831120434'] }, { name: 'how_soon_you_want_to_automate_your_space_?', values: ['45_days_&_beyond'] },
  ]},
  { id: '1087938847037579', created_time: '2026-08-29T06:11:21+0000', field_data: [
    { name: 'what_is_your_budget_for_1_bhk?', values: ['20k_-_40k'] }, { name: 'how_will_you_define_yourself?', values: ['end_client'] },
    { name: 'type_of_home_automation?', values: ['touch_panel'] }, { name: 'full_name', values: ['Shankar Mitra'] },
    { name: 'what_are_you_looking_for_?', values: ['complete_home_automation'] }, { name: 'city', values: ['Kolkata'] }, { name: 'post_code', values: ['700038'] },
    { name: 'how_soon_you_want_to_automate_your_space_?', values: ['45_days_&_beyond'] }, { name: 'phone_number', values: ['+919435505828'] },
    { name: 'your_apartment_size', values: ['1bhk'] }, { name: 'email', values: ['shankarmitra1231@gmail.com'] },
  ]},
  { id: '1569595834809985', created_time: '2026-08-29T04:48:59+0000', field_data: [
    { name: 'how_will_you_define_yourself?', values: ['end_client'] }, { name: 'type_of_home_automation?', values: ['touch_panel'] },
    { name: 'full_name', values: ['Sanjit Pintu Ghosh'] }, { name: 'what_are_you_looking_for_?', values: ['partial_home_automation'] },
    { name: 'city', values: ['kolkata'] }, { name: 'post_code', values: ['713128'] }, { name: 'how_soon_you_want_to_automate_your_space_?', values: ['within_30_days'] },
    { name: 'what_is_your_budget_for_3bhk_&_above?', values: ['70k_-_1_lakh'] }, { name: 'phone_number', values: ['+919851113466'] },
    { name: 'your_apartment_size', values: ['3bhk_&_above'] }, { name: 'email', values: ['pintuaudio@gmail.com'] },
  ]},
  { id: '2400684844089415', created_time: '2026-08-29T00:04:06+0000', field_data: [
    { name: 'what_are_you_looking_for_?', values: ['partial_home_automation'] }, { name: 'type_of_home_automation?', values: ['touch_panel'] },
    { name: 'your_apartment_size', values: ['2bhk'] }, { name: 'what_is_your_budget_for_2bhk?', values: ['40k_-_60k'] },
    { name: 'how_soon_you_want_to_automate_your_space_?', values: ['within_15_days'] }, { name: 'how_will_you_define_yourself?', values: ['interior_designer'] },
    { name: 'full_name', values: ['Anindya Bhowmick'] }, { name: 'phone_number', values: ['+919875591822'] }, { name: 'email', values: ['bhowmick.anindya31@gmail.com'] },
    { name: 'city', values: ['Kolkata'] }, { name: 'post_code', values: ['700064'] },
  ]},
  { id: '1036948465769430', created_time: '2026-08-28T16:26:02+0000', field_data: [
    { name: 'what_is_your_budget_for_1_bhk?', values: ['20k_-_40k'] }, { name: 'how_will_you_define_yourself?', values: ['end_client'] },
    { name: 'type_of_home_automation?', values: ['touch_panel'] }, { name: 'full_name', values: ['manoj kr jain'] },
    { name: 'what_are_you_looking_for_?', values: ['partial_home_automation'] }, { name: 'city', values: ['Kolkata'] }, { name: 'post_code', values: ['700026'] },
    { name: 'how_soon_you_want_to_automate_your_space_?', values: ['within_15_days'] }, { name: 'phone_number', values: ['+919073555129'] },
    { name: 'your_apartment_size', values: ['1bhk'] }, { name: 'email', values: ['ca.mkjainn@yahoo.com'] },
  ]},
  { id: '1647194736791340', created_time: '2026-08-28T15:27:54+0000', field_data: [
    { name: 'how_will_you_define_yourself?', values: ['end_client'] }, { name: 'type_of_home_automation?', values: ['touch_panel'] },
    { name: 'full_name', values: ['Jayanta Bhattacharya'] }, { name: 'what_are_you_looking_for_?', values: ['complete_home_automation'] },
    { name: 'city', values: ['Kolkata'] }, { name: 'post_code', values: ['700136'] }, { name: 'how_soon_you_want_to_automate_your_space_?', values: ['within_30_days'] },
    { name: 'what_is_your_budget_for_3bhk_&_above?', values: ['1_lakh_&_above'] }, { name: 'phone_number', values: ['+919830040073'] },
    { name: 'your_apartment_size', values: ['3bhk_&_above'] }, { name: 'email', values: ['jayanta27@gmail.com'] },
  ]},
  { id: '1564535698382955', created_time: '2026-08-15T02:51:56+0000', field_data: [
    { name: 'full_name', values: ['Manish Pareek'] }, { name: 'phone_number', values: ['+919831702132'] }, { name: 'email', values: ['ppareekmanish@gmail.com'] },
    { name: 'city', values: ['Kolkata'] }, { name: 'post_code', values: ['700040'] }, { name: 'what_are_you_looking_for_?', values: ['partial_home_automation'] },
    { name: 'type_of_home_automation?', values: ['touch_panel'] }, { name: 'your_apartment_size', values: ['3bhk_&_above'] },
    { name: 'what_is_your_budget_for_3bhk_&_above?', values: ['50k_-_70k'] }, { name: 'how_soon_you_want_to_automate_your_space_?', values: ['within_15_days'] },
    { name: 'how_will_you_define_yourself?', values: ['end_client'] },
  ]},
  { id: '2120097695385430', created_time: '2026-08-15T02:46:02+0000', field_data: [
    { name: 'post_code', values: ['700105'] }, { name: 'your_apartment_size', values: ['2bhk'] }, { name: 'type_of_home_automation?', values: ['behind_switch_module'] },
    { name: 'what_is_your_budget_for_2bhk?', values: ['40k_-_60k'] }, { name: 'city', values: ['Kolkata'] }, { name: 'how_will_you_define_yourself?', values: ['end_client'] },
    { name: 'email', values: ['agrawal.babita10@gmail.com'] }, { name: 'full_name', values: ['Babita Agrawal'] },
    { name: 'what_are_you_looking_for_?', values: ['partial_home_automation'] }, { name: 'phone_number', values: ['+919830244810'] },
    { name: 'how_soon_you_want_to_automate_your_space_?', values: ['within_15_days'] },
  ]},
];

// ── Field mapping (lightweight equivalent of lib/metaLeadMap.js's mapMetaLead) ────────────
const STANDARD_KEYS = { full_name: 'name', email: 'email', phone_number: 'phone', city: 'city', post_code: 'postcode' };

function mapLead(fieldData) {
  const raw = {};
  for (const f of fieldData) raw[f.name] = Array.isArray(f.values) ? f.values.join(', ') : String(f.values || '');

  const out = { name: '', phone: '', email: '', city: '', postcode: '', productInterest: [], propertyType: '', budget: '', timeline: '', persona: '' };
  for (const [key, val] of Object.entries(raw)) {
    if (STANDARD_KEYS[key]) { out[STANDARD_KEYS[key]] = val; continue; }
    if (/looking_for|type_of_home_automation/.test(key)) { if (val && !out.productInterest.includes(val)) out.productInterest.push(val); continue; }
    if (/apartment_size/.test(key)) { out.propertyType = out.propertyType || val; continue; }
    if (/^what_is_your_budget_for_/.test(key)) { out.budget = out.budget || val; continue; }
    if (/how_soon/.test(key)) { out.timeline = out.timeline || val; continue; }
    if (/define_yourself/.test(key)) { out.persona = out.persona || val; continue; }
  }
  return { mapped: out, rawMetaFields: raw };
}

function istDateStr(d) {
  return new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

async function main() {
  const sql = neon(DATABASE_URL);
  await sql`CREATE TABLE IF NOT EXISTS leads (id TEXT PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT now(), data JSONB NOT NULL)`;

  let inserted = 0, skipped = 0;
  for (const lead of LEADS) {
    const id = `META${lead.id}`;
    const existing = await sql.query('SELECT id FROM leads WHERE id = $1 LIMIT 1', [id]);
    if (existing.length > 0) { console.log(`Skipping ${id} (${lead.field_data.find(f => f.name === 'full_name')?.values?.[0] || '?'}) — already exists.`); skipped++; continue; }

    const { mapped, rawMetaFields } = mapLead(lead.field_data);
    if (!mapped.name || !mapped.phone) { console.log(`Skipping ${id} — missing name/phone after mapping.`); skipped++; continue; }

    const now = new Date().toISOString();
    const record = {
      id,
      createdAt: lead.created_time,
      date: istDateStr(lead.created_time),
      status: 'new',
      name: mapped.name, phone: mapped.phone, email: mapped.email, city: mapped.city, postcode: mapped.postcode,
      productInterest: mapped.productInterest, propertyType: mapped.propertyType, budget: mapped.budget,
      timeline: mapped.timeline, persona: mapped.persona,
      source: 'meta_lead_form',
      partnerId: null,
      metaLeadgenId: lead.id,
      metaFormId: FORM_ID,
      metaAdId: null,
      rawMetaFields,
      contactStage: null,
      demoOutcome: null,
      assignedTo: null,
      salesEngineerId: null,
      history: [
        { at: now, event: 'Lead Submitted', by: 'meta_lead_form', note: 'Meta Instant Form' },
        { at: now, event: 'Backfilled', by: 'admin', note: `Recovered from ${PAGE_NAME}'s Meta Lead Ads history — submitted ${lead.created_time}, missed because the webhook connection was not yet working at that time.` },
      ],
    };

    await sql.query(`INSERT INTO leads (id, data) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING`, [id, JSON.stringify(record)]);
    console.log(`Inserted ${id} — ${mapped.name} (${mapped.city || 'no city'})`);
    inserted++;
  }

  console.log(`\nDone. Inserted ${inserted}, skipped ${skipped} (already existed or incomplete).`);
}

main().catch((e) => { console.error('Backfill failed:', e); process.exit(1); });
