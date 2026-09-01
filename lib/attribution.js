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
// app/api/bot/webhook/route.js's bridgeToHeseosLeads can pull it back out of the first inbound
// message and resolve it here. (The older app/wa/[ref] shop-QR mechanism used the same
// convention before it was retired.)

import crypto from 'crypto';
import { dbGetById, dbInsert, dbList, dbWhere } from '@/lib/db';
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
//  - qr_partner / referral_partner: partnerId (required), label optional (defaults to partner name)
//  - qr_location: label (required — e.g. "Koramangala Billboard")
//  - referral_customer: customerLeadId + customerName + customerPhone (the referring customer)
export async function createAttributionLink({ kind, label, partnerId, customerLeadId, customerName, customerPhone, createdBy }) {
  if (!ATTR_KINDS.includes(kind)) throw new Error('Unknown attribution kind: ' + kind);
  const id = await generateUniqueCode(kind);
  const link = {
    id,
    kind,
    label: label || '',
    partnerId: isPartnerKind(kind) ? (partnerId || null) : null,
    customerLeadId: kind === 'referral_customer' ? (customerLeadId || null) : null,
    customerName: kind === 'referral_customer' ? (customerName || '') : '',
    customerPhone: kind === 'referral_customer' ? (customerPhone || '') : '',
    active: true,
    createdAt: new Date().toISOString(),
    createdBy: createdBy || null,
  };
  await dbInsert('attribution_links', id, link);
  return link;
}

// Self-service lookup for a partner's own qr_partner/referral_partner link — creates it on
// first visit so partners never have to ask an admin for their code (same self-service spirit
// as the rest of this platform). Returns the existing link if one already exists for this
// partner+kind rather than minting duplicates.
export async function getOrCreatePartnerLink(partnerId, kind, partnerLabel) {
  if (!isPartnerKind(kind)) throw new Error('Not a partner-kind attribution link: ' + kind);
  const existing = await dbWhere('attribution_links', 'partnerId', partnerId);
  const match = existing.find((l) => l.kind === kind && l.active !== false);
  if (match) return match;
  return createAttributionLink({ kind, label: partnerLabel, partnerId, createdBy: `partner:${partnerId}` });
}

// The one tenant in bot_tenants that Heseos itself runs (see app/api/bot/webhook/route.js's
// bridgeToHeseosLeads — same flag). QR/referral links only work once this tenant has a real
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
export async function referrerNoteFor(link) {
  if (!link) return '';
  try {
    if (link.kind === 'qr_partner' || link.kind === 'referral_partner') {
      const partner = link.partnerId ? await dbGetById('partners', link.partnerId) : null;
      const who = partner?.name || partner?.businessName || link.label || 'a friend';
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
