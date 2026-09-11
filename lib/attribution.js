// Attribution engine for QR codes and referral links — lib/attribution.js
//
// Four kinds of attribution link, one shared mechanism:
//   qr_partner        — a partner's own QR code. Scanning it opens WhatsApp pre-filled with a
//                        ref tag; the resulting lead is credited to that partner (partnerId set),
//                        so it shows up in their Partner App exactly like a lead they punched
//                        themselves — see app/api/leads/route.js's partner-scoped GET.
//   qr_location        — a QR code fixed to a physical placement (billboard, standee, shop
//                         window). Same WhatsApp flow, but credited to a *location label*
//                         instead of a partner, for scan-to-conversion tracking per placement.
//   referral_partner   — a partner's own referral link (shared on WhatsApp/story/etc). Same
//                         partner-attribution behaviour as qr_partner, different channel.
//   referral_customer  — a link generated for a paying customer who refers others. Tracked only
//                         (no partnerId, no payment processing) — see funnelFor()/customer fields
//                         for what the admin needs to decide a manual payout.
//
// Every kind funnels through the SAME entry point (app/go/[code]) and the SAME WhatsApp bot —
// Heseos's own tenant in bot_tenants (the one with linkToHeseosLeads === true, see
// app/api/bot/webhook/route.js) — because that's the multi-tenant Bot Console this platform is
// built around; nothing here talks to the legacy single-number system in lib/whatsapp.js.
//
// A code is embedded in the WhatsApp pre-filled message text as `(ref:<code>)` so
// app/api/bot/webhook/route.js's resolveAttributionLink can pull it back out of the first
// inbound message and resolve it here, for lib/heseosLeadSync.js's createHeseosLead to use. (The
// older app/wa/[ref] shop-QR mechanism used the same convention before it was retired.)
//
// qr_partner codes are pre-printed in bulk and handed to partners physically (a sticker for
// their shop counter, standee etc.) rather than self-generated in the app — see
// createBlankPartnerQrCodes/claimPartnerQrCode below and app/partner/(app)/qr for the partner
// side of that flow.

import crypto from 'crypto';
import { dbGetById, dbInsert, dbList, dbWhere, dbPatch } from '@/lib/db';
import { stageOf } from '@/lib/leadStage';
// Pure constants live in lib/attributionConstants.js (no lib/db.js import) so client
// components can import them directly without pulling fs/path into the browser bundle — see
// that file's header comment. Re-exported here so every SERVER-side importer of
// '@/lib/attribution' keeps working unchanged.
import { ATTR_KINDS, ATTR_KIND_LABEL, isQrKind, isPartnerKind } from '@/lib/attributionConstants';

export { ATTR_KINDS, ATTR_KIND_LABEL, isQrKind, isPartnerKind };

const CODE_PREFIX = { qr_partner: 'QP', qr_location: 'QL', referral_partner: 'RP', referral_customer: 'RC' };

// Matches the `(ref:<code>)` tag embedded in the WhatsApp pre-filled text. Deliberately a
// separate regex from lib/waInbound.js's legacy REF_RE (which resolves a bare partnerId, not a
// code lookup) — the two entry points stay independent even though the text convention looks
// the same.
const ATTR_REF_RE = /ref:([A-Za-z0-9]{4,24})/i;

export function parseRefFromText(text) {
  const m = String(text || '').match(ATTR_REF_RE);
  return m ? m[1].toUpperCase() : null;
}

function randomSuffix(len = 6) {
  return crypto.randomBytes(len).toString('base64url').replace(/[^A-Za-z0-9]/g, '').slice(0, len).toUpperCase();
}

async function generateUniqueCode(kind) {
  const prefix = CODE_PREFIX[kind];
  if (!prefix) throw new Error('Unknown attribution kind: ' + kind);
  for (let i = 0; i < 5; i++) {
    const code = `${prefix}${randomSuffix(6)}`;
    if (!(await dbGetById('attribution_links', code))) return code;
  }
  // Astronomically unlikely, but never loop forever.
  return `${prefix}${randomSuffix(10)}`;
}

// Create a new attribution link. `kind` picks which fields matter:
//  - qr_partner / referral_partner: partnerId (required unless creating a blank/unclaimed code
//    — see createBlankPartnerQrCodes), label optional (defaults to partner name)
//  - qr_location: label + city + locality + pincode (all required — e.g. "Koramangala
//    Billboard", "Bengaluru", "Koramangala 4th Block", "560034") so a placement can be reported
//    on by area, not just by its own name
//  - referral_customer: customerLeadId + customerName + customerPhone (the referring customer)
export async function createAttributionLink({ kind, label, city, locality, pincode, partnerId, customerLeadId, customerName, customerPhone, createdBy, batchLabel, employeeId }) {
  if (!ATTR_KINDS.includes(kind)) throw new Error('Unknown attribution kind: ' + kind);
  const id = await generateUniqueCode(kind);
  const link = {
    id,
    kind,
    label: label || '',
    city: kind === 'qr_location' ? (city || '') : '',
    locality: kind === 'qr_location' ? (locality || '') : '',
    pincode: kind === 'qr_location' ? (pincode || '') : '',
    partnerId: isPartnerKind(kind) ? (partnerId || null) : null,
    customerLeadId: kind === 'referral_customer' ? (customerLeadId || null) : null,
    customerName: kind === 'referral_customer' ? (customerName || '') : '',
    customerPhone: kind === 'referral_customer' ? (customerPhone || '') : '',
    active: true,
    claimedAt: partnerId ? new Date().toISOString() : null,
    batchLabel: batchLabel || '',
    // Which employee handed this code out — set only for pre-printed qr_partner batches (see
    // createBlankPartnerQrCodes) so admin can later tell which employee's stickers are driving
    // which partners/leads/conversions (Growth tab table + "Create Partner QR Codes"/"Print QR
    // Codes" modals). Not applicable to any other kind.
    employeeId: kind === 'qr_partner' ? (employeeId || null) : null,
    createdAt: new Date().toISOString(),
    createdBy: createdBy || null,
  };
  await dbInsert('attribution_links', id, link);
  return link;
}

// Self-service lookup for a partner's own referral_partner link — creates it on first visit so
// partners never have to ask an admin for their link (same self-service spirit as the rest of
// this platform). Returns the existing link if one already exists for this partner+kind rather
// than minting duplicates.
//
// NOTE: qr_partner is deliberately never self-provisioned this way any more — those codes are
// pre-printed in bulk (createBlankPartnerQrCodes) and claimed by the partner from a physical
// sticker (claimPartnerQrCode), so a partner never ends up with an auto-generated QR code nobody
// printed.
export async function getOrCreatePartnerLink(partnerId, kind, partnerLabel) {
  if (!isPartnerKind(kind)) throw new Error('Not a partner-kind attribution link: ' + kind);
  const existing = await dbWhere('attribution_links', 'partnerId', partnerId);
  const match = existing.find((l) => l.kind === kind && l.active !== false);
  if (match) return match;
  return createAttributionLink({ kind, label: partnerLabel, partnerId, createdBy: `partner:${partnerId}` });
}

// Admin bulk-generates a batch of blank (unclaimed) qr_partner codes for printing — a sheet of
// stickers handed out at onboarding, each configured by whichever partner receives it (see
// claimPartnerQrCode). Capped per call so one request can't run away; call again for a bigger
// print run.
export async function createBlankPartnerQrCodes(count, { createdBy, batchLabel, employeeId } = {}) {
  const n = Math.max(1, Math.min(200, Math.floor(Number(count) || 0)));
  const out = [];
  for (let i = 0; i < n; i++) {
    // Sequential (not Promise.all) — generateUniqueCode does its own existence check per
    // attempt, and this only ever runs from a single admin request at a time, so there's no
    // real concurrency to worry about; keeping it sequential just avoids hammering the DB.
    // eslint-disable-next-line no-await-in-loop
    out.push(await createAttributionLink({ kind: 'qr_partner', partnerId: null, createdBy, batchLabel, employeeId }));
  }
  return out;
}

// Every qr_partner code nobody has claimed yet — what admin sees when deciding whether to print
// another batch, or which codes from an existing batch are still sitting unused.
export async function listUnclaimedPartnerQrCodes() {
  const all = await dbList('attribution_links');
  return all.filter((l) => l.kind === 'qr_partner' && !l.partnerId && l.active !== false);
}

class ClaimError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

// Partner claims a pre-printed qr_partner code by typing in the code printed on their sticker —
// the "on the spot" configuration step from onboarding. Idempotent for the same partner
// re-submitting their own code; rejects a code already claimed by someone else, an unknown
// code, or one that's been deactivated.
//
// Any lead that already came in through this code before it was claimed (the code was scanned
// in the brief window between hand-off and claiming, or a partner tested their own sticker
// before configuring it) still had partnerId null at creation time — those are backfilled here
// so the partner doesn't lose credit for a scan that happened moments before they finished
// setting up.
export async function claimPartnerQrCode(rawCode, partner) {
  const code = String(rawCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!code) throw new ClaimError('Enter the code printed on your QR sticker.', 'INVALID');

  const link = await dbGetById('attribution_links', code);
  if (!link || link.kind !== 'qr_partner') {
    throw new ClaimError("We couldn't find a partner QR code with that code — double-check it and try again.", 'NOT_FOUND');
  }
  if (link.active === false) {
    throw new ClaimError('This QR code has been deactivated. Contact Heseos for a replacement.', 'INACTIVE');
  }
  if (link.partnerId && link.partnerId !== partner.id) {
    throw new ClaimError('This QR code is already linked to another partner account.', 'ALREADY_CLAIMED');
  }

  const label = partner.shopName || partner.businessName || partner.name || partner.id;
  const updated = await dbPatch('attribution_links', code, {
    partnerId: partner.id,
    label,
    claimedAt: link.claimedAt || new Date().toISOString(),
  });

  const priorLeads = await dbWhere('leads', 'attributionLinkId', code);
  const orphaned = priorLeads.filter((l) => !l.partnerId);
  if (orphaned.length) {
    await Promise.all(orphaned.map((l) => dbPatch('leads', l.id, { partnerId: partner.id })));
  }

  // First-touch "who onboarded this partner" — if the code was tagged with an employee at
  // batch-generation time (see createBlankPartnerQrCodes/GrowthPage's "Create Partner QR
  // Codes"), claiming it is the moment we learn which employee actually handed this partner
  // their sticker. Recorded on the PARTNER record itself (not just this one QR code) so it
  // covers every lead this partner ever brings in afterward — QR scans, referral-link shares,
  // and leads they punch directly into the Partner App — not only leads through this code.
  // First-touch: never overwrite an onboarding employee the partner already has (e.g. from an
  // earlier claimed code, or one Admin set by hand), same "first attribution wins" rule leads
  // already follow (see app/api/leads/route.js).
  if (link.employeeId && !partner.onboardedByEmployeeId) {
    await dbPatch('partners', partner.id, {
      onboardedByEmployeeId: link.employeeId,
      onboardedByEmployeeAt: new Date().toISOString(),
      onboardedVia: 'qr_partner',
    });
  }

  return updated;
}

// The one tenant in bot_tenants that Heseos itself runs (see lib/heseosLeadSync.js's
// createHeseosLead — same flag). QR/referral links only work once this tenant has a real
// WhatsApp number set (Bot Configuration → WhatsApp Connection).
export async function getHeseosBotTenant() {
  const all = await dbList('bot_tenants');
  return all.find((t) => t.botKind === 'heseos' || t.linkToHeseosLeads === true) || null;
}

// A short, friendly line that tells a customer who pointed them our way — used in the greeting
// of Heseos's own lead-capture flow (lib/botFlowEngine.js's {{referrerNote}} template variable)
// so a QR scan or referral click feels personal without ever using the word "referral" (the
// customer-facing tone the flow was designed around). Returns '' for a plain/organic chat
// (no link) or if the underlying partner record can't be found. Never throws — callers can
// await this directly without a try/catch of their own.
// The city HESEOS already knows for wherever this attribution link points, straight from
// that link's own source of truth — never asked of the customer. Used by the webhook's new-chat
// branch to pre-fill {{attributionCity}} for lib/heseosDefaultFlow.js's city-confirmation step,
// so a customer who arrived via any of these doesn't have to type a city we can already infer:
//  - qr_partner / referral_partner: the partner's own profile city (components/partner/
//    MyProfileScreen.jsx) — a scan AND a shared link both carry this, since either way the
//    customer came through that specific partner.
//  - qr_location: the city already captured on the location link itself when it was created
//    (createAttributionLink's city/locality/pincode — e.g. "Koramangala Billboard" -> "Bengaluru"),
//    no extra lookup needed.
//  - referral_customer: no business/location city to infer from a peer referral — returns ''.
// Returns '' for no link, an unclaimed/partner-less link, or a partner with no city on file.
// Never throws.
export async function attributionCityFor(link) {
  if (!link) return '';
  try {
    if (link.kind === 'qr_partner' || link.kind === 'referral_partner') {
      if (!link.partnerId) return '';
      const partner = await dbGetById('partners', link.partnerId);
      return partner?.city || '';
    }
    if (link.kind === 'qr_location') return link.city || '';
    return '';
  } catch {
    return '';
  }
}

export async function referrerNoteFor(link) {
  if (!link) return '';
  try {
    if (link.kind === 'qr_partner' || link.kind === 'referral_partner') {
      const partner = link.partnerId ? await dbGetById('partners', link.partnerId) : null;
      // Business name first — a customer scanning a partner's QR/referral code should see the
      // partner's storefront/business name, not a stranger's personal name (see also
      // app/api/leads/route.js's addedByLabel, which follows the same priority).
      const who = partner?.shopName || partner?.businessName || partner?.name || link.label || 'a friend';
      // qr_partner was an actual QR-code SCAN (a sticker at the partner's shop/office) — say so
      // literally, same spirit as qr_location's "Thanks for stopping by ... glad you scanned
      // in!" below. referral_partner is a LINK someone shared/clicked, never scanned, so it
      // keeps the original wording — "scanning" would be inaccurate for that path.
      if (link.kind === 'qr_partner') return `Thanks for scanning the HESEOS QR at ${who}! 😊`;
      return `${who} said you might love what we're building — welcome! 😊`;
    }
    if (link.kind === 'qr_location') {
      const where = link.label || 'here';
      return `Thanks for stopping by ${where} — glad you scanned in! 😊`;
    }
    if (link.kind === 'referral_customer') {
      const who = link.customerName || 'a friend';
      return `${who} thought you'd love this — welcome! 😊`;
    }
  } catch (err) {
    console.error('referrerNoteFor error:', err);
  }
  return '';
}

// Build the wa.me deep link a scan/click redirects to, with the code embedded as a ref tag so
// the webhook can attribute the resulting chat.
export function buildWaLink(tenant, code) {
  const number = String(tenant?.whatsappNumber || '').replace(/[^0-9]/g, '');
  if (!number) return null;
  const text = `Hi Heseos! I'm interested in smart home automation. (ref:${code})`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

// PUBLIC_BASE_URL is meant to be set by hand (see .env.example) to the platform's real public
// domain, but Vercel deployments always carry these two automatically — use them as a safety
// net so a QR code or referral link is never SILENTLY un-tracked (every scan skipped, only
// leads still counting) just because that one env var was never set or was misconfigured.
// VERCEL_PROJECT_PRODUCTION_URL is the stable production domain assigned to the project;
// VERCEL_URL is this specific deployment's URL (changes per deploy) — prefer the former.
function autoBaseUrl() {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || '';
  return host ? `https://${host}` : '';
}

// The platform's public base URL, resolved the same way everywhere it's needed (the tracked
// /go/<code> link below, and anywhere else — e.g. the Partner App's "is link sharing set up?"
// check — that needs to know whether a shareable URL can be built at all).
export function resolvePublicBaseUrl() {
  return String(process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '') || autoBaseUrl();
}

// The URL every QR code / shareable link should actually be built from: always the tracked
// https://<domain>/go/<code> redirector first, so a scan/click is logged (recordVisit) BEFORE
// the near-instant 302 into WhatsApp — that one extra hop is imperceptible to the person
// scanning, but skipping it means the scan is never counted, not just ones that don't finish
// as a lead. Falls back to a direct wa.me link only when neither PUBLIC_BASE_URL nor a Vercel
// deployment URL is available, since an untracked link still beats a broken one.
export function trackedLinkUrl(tenant, code) {
  const base = resolvePublicBaseUrl();
  if (base) return `${base}/go/${code}`;
  return buildWaLink(tenant, code);
}

// Log one scan/click — fire-and-forget from app/go/[code], never blocks the redirect.
export async function recordVisit(linkId, kind) {
  const id = `AV${Date.now().toString(36).toUpperCase()}${randomSuffix(4)}`;
  await dbInsert('attribution_visits', id, { id, linkId, kind, at: new Date().toISOString() });
}

// Funnel for one link: visits (scans/clicks) → leads created → leads that reached the
// canonical "Converted" stage (lib/leadStage.js's stageOf — same definition used everywhere
// else in the app, so this always agrees with what Admin/Partner see on the lead itself).
export async function funnelFor(linkId) {
  const [visits, leads] = await Promise.all([
    dbWhere('attribution_visits', 'linkId', linkId),
    dbWhere('leads', 'attributionLinkId', linkId),
  ]);
  const converted = leads.filter((l) => stageOf(l) === 'Converted').length;
  return { visits: visits.length, leads: leads.length, converted };
}

// Same as funnelFor, batched for an admin table listing many links without an N+1 lookup per
// row — one pass over attribution_visits and leads instead of one dbWhere per link.
export async function funnelForAll(linkIds) {
  const ids = new Set(linkIds);
  const [visits, leads] = await Promise.all([dbList('attribution_visits'), dbList('leads')]);
  const out = new Map();
  for (const id of ids) out.set(id, { visits: 0, leads: 0, converted: 0 });
  for (const v of visits) { if (out.has(v.linkId)) out.get(v.linkId).visits++; }
  for (const l of leads) {
    if (!l.attributionLinkId || !out.has(l.attributionLinkId)) continue;
    const f = out.get(l.attributionLinkId);
    f.leads++;
    if (stageOf(l) === 'Converted') f.converted++;
  }
  return out;
}
