#!/usr/bin/env node
// Submits every WhatsApp message template HESEOS BOS sends (lib/heseosNotify.js) that Meta does not
// already have — so you never have to hand-create them in Business Manager one by one.
//
// What it does, per template in CATALOGUE below:
//   - not in your WhatsApp Business Account yet ........ creates it (category UTILITY, en_US) -> PENDING
//   - APPROVED / PENDING / IN_APPEAL ..................... leaves it alone
//   - REJECTED ........................................... reports Meta's reason; with --retry-rejected it
//                                                           edits the template with the wording below and
//                                                           resubmits it
//   - PAUSED / DISABLED / FLAGGED ........................ reports only (needs a look in Business Manager)
// Nothing is ever deleted, and an approved template is never touched.
//
// Run it from the heseos-bos project root, in your own Terminal (it needs real internet access to
// graph.facebook.com — it is not meant to be run through any bridge):
//
//   WABA_ID=123456789012345 WHATSAPP_ACCESS_TOKEN=EAAG... node scripts/push-whatsapp-templates.mjs
//
// Options:
//   --list              only show each template's current status in Meta, change nothing
//   --dry-run           show exactly what would be created/edited, send nothing
//   --only a,b,c        limit to these template names
//   --retry-rejected    also edit + resubmit templates Meta has REJECTED
//
// Needed:
//   WABA_ID               WhatsApp Business Account ID (Meta Business Settings -> Accounts -> WhatsApp
//                         accounts). NOT the Phone Number ID.
//   WHATSAPP_ACCESS_TOKEN a token with the whatsapp_business_management permission (a System User
//                         token from Business Settings works; so does the one your bot already uses
//                         if it was created with that permission).
//   META_APP_ID           optional — only needed if 'quotation_ready_pdf' is MISSING or REJECTED on the
//                         account you point this at (its PDF header needs a sample file uploaded to your
//                         Meta app). Not needed when that template is already approved.
//   WHATSAPP_API_VERSION  optional, default v20.0 (same default the bot itself uses).
//
// Approval is not instant: Utility templates usually clear in minutes, occasionally a day. Re-run with
// --list to watch. Meta rejects wording that reads as promotional (see the notes in lib/heseosNotify.js
// about 'meta_lead_welcome') — keep the texts below plain and factual.

const WABA_ID = process.env.WABA_ID;
const TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const APP_ID = process.env.META_APP_ID || '';
const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v20.0';
const GRAPH = (process.env.WHATSAPP_GRAPH_BASE || 'https://graph.facebook.com').replace(/\/$/, '');
const LANGUAGE = 'en_US';

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const LIST_ONLY = flag('--list');
const DRY_RUN = flag('--dry-run');
const RETRY_REJECTED = flag('--retry-rejected');
const onlyIdx = args.indexOf('--only');
const ONLY = onlyIdx >= 0 && args[onlyIdx + 1] ? new Set(args[onlyIdx + 1].split(',').map((s) => s.trim()).filter(Boolean)) : null;

// ─── The templates ──────────────────────────────────────────────────────────────────────────────
// {{n}} placeholders must match, in order, the `params` array the code passes (see the call sites in
// lib/heseosNotify.js). `examples` are the sample values Meta's reviewers see — one per placeholder.
// Wording is deliberately plain (UTILITY) — no "Congratulations!", no offers.
const CATALOGUE = [
  // ── Leads / demos ──
  {
    name: 'lead_added_notify',
    body: 'Hi {{1}}! 👋 This is HESEOS. {{2}} has added your details with us for a smart home consultation. Someone from our team will get in touch with you shortly to understand your requirements better. Thank you for choosing HESEOS! 😊',
    examples: ['Rahul', 'Suresh from BSK Enterprises'],
  },
  {
    name: 'meta_lead_welcome',
    body: 'Hi {{1}}! 👋 We have received your enquiry with HESEOS.\n\nOne of our customer experience representatives will contact you shortly.\n\n— Team HESEOS',
    examples: ['Rahul'],
  },
  {
    name: 'demo_scheduled_rating',
    body: 'Hi {{1}}! 👋 Your HESEOS smart home demo is scheduled.\n\n📅 Date: {{2}}\n⏰ Time: {{3}}\n\nWe will confirm which engineer is visiting shortly.\n\nBefore that — how would you rate your experience with {{4}} so far? Reply with a number from 1 to 5 ⭐\n\n— Team HESEOS',
    examples: ['Rahul', '15 Oct 2026', '11:00 AM', 'Priya'],
  },
  {
    name: 'presales_rejected_rating',
    body: "Hi {{1}}, thank you for speaking with our team about HESEOS smart home solutions. We have noted that this isn't the right time for you — no problem at all.\n\nBefore you go, how would you rate your experience with {{2}}? Reply with a number from 1 to 5.\n\nWhenever you are ready to explore a smarter home, we will be here.\n\n— Team HESEOS",
    examples: ['Rahul', 'Priya'],
  },
  {
    name: 'presales_followup_confirmed',
    body: 'Hi {{1}}, thanks for your patience! We will get back to you on {{2}} around {{3}}. If anything changes before then, just message us here anytime.\n\n— Team HESEOS',
    examples: ['Rahul', '18 Oct 2026', '04:00 PM'],
  },
  {
    name: 'demo_reschedule_notify',
    body: 'Hi {{1}}, no problem — your HESEOS demo has been rescheduled. New slot: {{2}}. Our team will confirm it with you shortly.\n\n— Team HESEOS',
    examples: ['Rahul', '20 Oct 2026 at 11:00 AM'],
  },
  {
    name: 'demo_rejected_before_notify',
    body: "Hi {{1}}, understood — we have cancelled the demo for now. If you'd like to explore smart home solutions in the future, just message us anytime.\n\n— Team HESEOS",
    examples: ['Rahul'],
  },
  {
    name: 'demo_converted_rating',
    body: 'Hi {{1}}, thank you for choosing HESEOS for your smart home setup. Our team will be in touch about the next steps shortly.\n\nBefore that — how would you rate your experience with {{2}}? Reply with a number from 1 to 5.\n\n— Team HESEOS',
    examples: ['Rahul', 'Amit'],
  },
  {
    name: 'demo_rejected_after_rating',
    body: "Hi {{1}}, thank you for considering HESEOS for your smart home needs. We understand this isn't the right time — no worries at all.\n\nBefore you go, how would you rate your experience with {{2}}? Reply with a number from 1 to 5.\n\nWhenever you are ready, we will be here.\n\n— Team HESEOS",
    examples: ['Rahul', 'Amit'],
  },
  {
    name: 'demo_reminder_24h',
    body: 'Hi {{1}}, just a reminder — your HESEOS smart home demo is scheduled for tomorrow, {{2}} at {{3}}. Looking forward to it!\n\n— Team HESEOS',
    examples: ['Rahul', '15 Oct 2026', '11:00 AM'],
  },
  {
    name: 'demo_reminder_2h',
    body: 'Hi {{1}}, your HESEOS smart home demo is coming up today at {{3}} ({{2}}). See you soon!\n\n— Team HESEOS',
    examples: ['Rahul', '15 Oct 2026', '11:00 AM'],
  },
  {
    // Already APPROVED in HESEOS's account, so this script never touches it — the wording below is
    // simply a copy of what Meta has approved. META_APP_ID is only needed if it ever has to be
    // (re)created on a different WhatsApp account, because the PDF header needs a sample file upload.
    name: 'quotation_ready_pdf',
    body: 'Hi {{1}}, your smart home quotation from HESEOS is ready — {{2}}. Please find it attached above. Let us know if you have any questions.',
    examples: ['Priya', '₹85,000'],
    header: 'document',
  },

  // ── Partners / team ──
  {
    name: 'partner_onboarding_message',
    body: 'Hi {{1}}, your HESEOS Partner account has been activated by {{2}}. You can now submit leads through the Partner App or share your QR code with customers.',
    examples: ['Suresh', 'Amit'],
  },
  {
    name: 'employee_partner_onboarded',
    body: "Hi {{1}}! 👋 Thank you for onboarding {{2}} as a HESEOS Partner! 🎉 They've linked their QR code and are all set to start referring leads — great work!",
    examples: ['Amit', 'BSK Enterprises'],
  },
  {
    name: 'qr_lead_scanned_partner_notify',
    body: "Hi {{1}}! 👋 {{2}} just scanned your QR code and enquired about a smart home setup. We've noted their details and our team will reach out to them shortly.",
    examples: ['Suresh', 'Rahul'],
  },

  // ── Door-lock orders (Admin -> Orders) ──
  {
    name: 'order_placed',
    body: 'Hi {{1}}, your HESEOS order {{2}} is placed! Total ₹{{3}}, payable by Cash/UPI on delivery. Our team will call you shortly to confirm delivery.\n\n— Team HESEOS',
    examples: ['Rahul', 'ORD12345678', '4,999'],
  },
  {
    name: 'order_confirmed',
    body: "Hi {{1}}, thank you for confirming your HESEOS order {{2}}! We'll pack it and keep you posted on every step.\n\n— Team HESEOS",
    examples: ['Rahul', 'ORD12345678'],
  },
  {
    name: 'order_packed',
    body: 'Hi {{1}}, your HESEOS order {{2}} has been packed and will be dispatched shortly.\n\n— Team HESEOS',
    examples: ['Rahul', 'ORD12345678'],
  },
  {
    name: 'order_dispatched',
    body: 'Hi {{1}}, your HESEOS order {{2}} has been dispatched and is on its way to you.\n\n— Team HESEOS',
    examples: ['Rahul', 'ORD12345678'],
  },
  {
    name: 'order_delivered',
    body: 'Hi {{1}}, your HESEOS order {{2}} has been delivered. Our team will contact you to schedule the installation.\n\n— Team HESEOS',
    examples: ['Rahul', 'ORD12345678'],
  },
  {
    // Sent when the order is delivered and no installation date is agreed yet: the button opens the
    // customer's "Book installation" page (app/book-installation/[token]). Needs PUBLIC_BASE_URL set to
    // your real public address when you run this script — Meta stores the button's link prefix.
    name: 'order_delivered_book',
    body: 'Hi {{1}}, your HESEOS order {{2}} has been delivered.\n\nTap the button below to book your installation — pick a date and time that suits you.\n\n— Team HESEOS',
    examples: ['Rahul', 'ORD12345678'],
    button: { text: 'Book installation', path: '/book-installation/', example: 'ORD12345678.kQ9fAbC1dEfGhIjKlMnOpQr' },
  },
  {
    name: 'installation_scheduled',
    body: 'Hi {{1}}, installation for your HESEOS order {{2}} is scheduled for {{3}} ({{4}}).\n\nOur technician will visit your address then — please keep someone available at home.\n— Team HESEOS',
    examples: ['Rahul', 'ORD12345678', 'Mon, 26 Oct 2026', 'Morning (9 am – 12 pm)'],
  },
  {
    name: 'order_installed',
    body: 'Hi {{1}}, installation for your HESEOS order {{2}} is complete. Thank you for choosing HESEOS!\n\n— Team HESEOS',
    examples: ['Rahul', 'ORD12345678'],
  },
  {
    name: 'order_cancelled',
    body: "Hi {{1}}, your HESEOS order {{2}} has been cancelled. If you'd like to order again or have any questions, just message us here.\n\n— Team HESEOS",
    examples: ['Rahul', 'ORD12345678'],
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────────────────────────
function die(msg) { console.error(msg); process.exit(1); }

// Catch a typo in the catalogue before anything is sent: placeholders must be {{1}}..{{n}} with one
// example each, and a body may not start or end with a placeholder (Meta rejects that).
function validateCatalogue() {
  const names = new Set();
  for (const t of CATALOGUE) {
    if (names.has(t.name)) die(`Catalogue error: duplicate template name ${t.name}`);
    names.add(t.name);
    const found = [...t.body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    const max = found.length ? Math.max(...found) : 0;
    for (let i = 1; i <= max; i++) if (!found.includes(i)) die(`Catalogue error: ${t.name} skips {{${i}}}`);
    if (t.examples.length !== max) die(`Catalogue error: ${t.name} has ${max} placeholder(s) but ${t.examples.length} example(s)`);
    if (/^\s*\{\{/.test(t.body) || /\}\}\s*$/.test(t.body)) die(`Catalogue error: ${t.name} starts or ends with a placeholder`);
    if (t.body.length > 1024) die(`Catalogue error: ${t.name} body is over 1024 characters`);
  }
}

async function graph(method, path, { json, headers, rawBody } = {}) {
  const url = /^https?:\/\//.test(path) ? path : `${GRAPH}/${API_VERSION}/${path.replace(/^\//, '')}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, ...(json ? { 'Content-Type': 'application/json' } : {}), ...(headers || {}) },
    body: rawBody !== undefined ? rawBody : json ? JSON.stringify(json) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = data?.error || {};
    const msg = e.error_user_msg || e.error_user_title || e.message || `HTTP ${res.status}`;
    const err = new Error(`${msg}${e.code ? ` (code ${e.code}${e.error_subcode ? `/${e.error_subcode}` : ''})` : ''}`);
    err.meta = e;
    throw err;
  }
  return data;
}

async function fetchExisting() {
  const byName = new Map();
  let next = `${WABA_ID}/message_templates?fields=id,name,status,language,category,rejected_reason&limit=200`;
  while (next) {
    const page = await graph('GET', next);
    for (const t of page.data || []) {
      if (t.language !== LANGUAGE) continue;
      byName.set(t.name, t);
    }
    next = page.paging?.next || null;
  }
  return byName;
}

// A tiny valid PDF — the sample Meta's reviewers see in the DOCUMENT header of the quotation template.
function samplePdfBytes() {
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    null,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  const stream = 'BT /F1 22 Tf 72 760 Td (HESEOS Quotation - sample) Tj ET';
  objs[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  let out = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

// Meta's Resumable Upload API -> a header_handle for the DOCUMENT header example.
async function uploadSamplePdf() {
  const bytes = samplePdfBytes();
  const session = await graph('POST', `${APP_ID}/uploads?file_length=${bytes.length}&file_type=application%2Fpdf&file_name=sample.pdf`);
  const up = await fetch(`${GRAPH}/${API_VERSION}/${session.id}`, {
    method: 'POST',
    headers: { Authorization: `OAuth ${TOKEN}`, file_offset: '0' },
    body: bytes,
  });
  const data = await up.json().catch(() => ({}));
  if (!up.ok || !data.h) throw new Error(`Sample upload failed: ${data?.error?.message || `HTTP ${up.status}`}`);
  return data.h;
}

async function buildComponents(t) {
  const components = [];
  if (t.header === 'document') {
    if (!APP_ID) return { skip: 'needs META_APP_ID (for the PDF header sample) — set it and re-run' };
    if (DRY_RUN) components.push({ type: 'HEADER', format: 'DOCUMENT', example: { header_handle: ['<uploaded sample pdf>'] } });
    else components.push({ type: 'HEADER', format: 'DOCUMENT', example: { header_handle: [await uploadSamplePdf()] } });
  }
  components.push({
    type: 'BODY',
    text: t.body,
    ...(t.examples.length ? { example: { body_text: [t.examples] } } : {}),
  });
  if (t.button) {
    const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
    if (!/^https:\/\//.test(base)) die(`${t.name} needs PUBLIC_BASE_URL set to your public https:// address (e.g. PUBLIC_BASE_URL=https://bos.heseos.com) — Meta stores the button's link.`);
    components.push({
      type: 'BUTTONS',
      buttons: [{ type: 'URL', text: t.button.text, url: `${base}${t.button.path}{{1}}`, example: [`${base}${t.button.path}${t.button.example}`] }],
    });
  }
  return { components };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (s, n) => String(s).padEnd(n);

// ─── Main ───────────────────────────────────────────────────────────────────────────────────────
async function main() {
  validateCatalogue();
  if (!WABA_ID || !TOKEN) {
    console.error('Missing credentials. Run it like this:\n');
    console.error('  WABA_ID=<WhatsApp Business Account ID> WHATSAPP_ACCESS_TOKEN=<token> node scripts/push-whatsapp-templates.mjs\n');
    console.error('WABA_ID is the WhatsApp Business Account ID (Meta Business Settings -> Accounts -> WhatsApp accounts),');
    console.error('not the Phone Number ID. The token needs the whatsapp_business_management permission.');
    process.exit(1);
  }
  if (!/^\d+$/.test(WABA_ID)) die('WABA_ID should be the numeric WhatsApp Business Account ID.');

  const list = CATALOGUE.filter((t) => !ONLY || ONLY.has(t.name));
  if (ONLY) {
    const unknown = [...ONLY].filter((n) => !CATALOGUE.some((t) => t.name === n));
    if (unknown.length) die(`Unknown template name(s): ${unknown.join(', ')}`);
  }

  console.log(`Checking ${list.length} template(s) against WhatsApp Business Account ${WABA_ID} …\n`);
  let existing;
  try { existing = await fetchExisting(); } catch (e) { die(`Could not read your templates from Meta: ${e.message}`); }

  const mode = LIST_ONLY ? 'list' : DRY_RUN ? 'dry-run' : 'live';
  const tally = { created: 0, edited: 0, kept: 0, attention: 0, failed: 0 };
  console.log(`${pad('TEMPLATE', 34)}${pad('IN META', 12)}RESULT`);
  console.log('-'.repeat(78));

  for (const t of list) {
    const cur = existing.get(t.name);
    const status = cur ? cur.status : '—';
    let result = '';

    try {
      if (!cur) {
        if (mode === 'list') { result = 'missing — run without --list to create'; tally.attention++; }
        else {
          const built = await buildComponents(t);
          if (built.skip) { result = `skipped: ${built.skip}`; tally.attention++; }
          else if (mode === 'dry-run') { result = 'would create (UTILITY, en_US)'; tally.created++; }
          else {
            const r = await graph('POST', `${WABA_ID}/message_templates`, { json: { name: t.name, language: LANGUAGE, category: 'UTILITY', components: built.components } });
            result = `created → ${r.status || 'PENDING'}${r.category && r.category !== 'UTILITY' ? ` (Meta set category ${r.category})` : ''}`;
            tally.created++;
            await sleep(500);
          }
        }
      } else if (['APPROVED', 'PENDING', 'IN_APPEAL'].includes(cur.status)) {
        result = cur.status === 'APPROVED' ? 'ok' : 'already submitted, waiting for Meta';
        tally.kept++;
      } else if (cur.status === 'REJECTED') {
        const why = cur.rejected_reason && cur.rejected_reason !== 'NONE' ? ` (${cur.rejected_reason})` : '';
        if (!RETRY_REJECTED || mode === 'list') { result = `rejected${why} — re-run with --retry-rejected to resubmit`; tally.attention++; }
        else {
          const built = await buildComponents(t);
          if (built.skip) { result = `skipped: ${built.skip}`; tally.attention++; }
          else if (mode === 'dry-run') { result = 'would edit + resubmit'; tally.edited++; }
          else {
            await graph('POST', cur.id, { json: { category: 'UTILITY', components: built.components } });
            result = 'edited + resubmitted → PENDING';
            tally.edited++;
            await sleep(500);
          }
        }
      } else {
        result = `${cur.status} — check it in Meta Business Manager`;
        tally.attention++;
      }
    } catch (e) {
      result = `FAILED: ${e.message}`;
      tally.failed++;
    }
    console.log(`${pad(t.name, 34)}${pad(status, 12)}${result}`);
  }

  console.log('-'.repeat(78));
  console.log(`${tally.created} ${mode === 'dry-run' ? 'to create' : 'created'}, ${tally.edited} ${mode === 'dry-run' ? 'to edit' : 'edited'}, ${tally.kept} fine, ${tally.attention} need attention, ${tally.failed} failed.`);
  if (mode === 'live' && (tally.created || tally.edited)) console.log('\nNew submissions are PENDING review. Run again with --list in a few minutes to check their status.');
  if (tally.failed) process.exit(2);
}

main().catch((e) => die(`Unexpected error: ${e.message}`));
