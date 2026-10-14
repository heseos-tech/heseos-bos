// lib/heseosLandingLead.js
// Lead capture for the public HESEOS smart-home enquiry landing page (/smart-home,
// public/smart-home/index.html -> POST app/api/leads/landing). Writes the same `leads` row every
// other channel does (so city auto-assignment, the pre-sales queue, quotations, ratings, etc. all
// just work). The lead's `source` is the CHANNEL the customer came through, using the same
// vocabulary the WhatsApp bot writes (lib/heseosLeadSync.js): a ?ref= code from a QR scan keeps its
// qr_partner/qr_location kind, a referral link its referral_* kind (Admin/Team lists label these
// "WhatsApp QR" / "WhatsApp Referral"), a WhatsApp visit with no code is 'whatsapp_bot'
// ("WhatsApp Direct"), and only a visit that never touched WhatsApp stays 'landing_page'.
//
// Referral credit: the page can be opened as /smart-home?ref=<code> where <code> is any existing
// lib/attribution.js code (a partner's referral link / QR, a location QR, a customer referral).
// Credit follows the same first-touch rule as the WhatsApp bot and the Partner App — if this phone
// number already has an earlier lead from ANY channel, the new lead is still created (pipeline
// visibility) but carries no partner/attribution credit, so payout is never double-counted
// (lib/leadOrigin.js's findFirstLeadByPhone).
//
// A phone number that already has an OPEN lead (not Converted/Rejected) never gets a second lead
// from this page — the existing lead just gets a history note that the customer asked again, so
// nobody is called twice for the same enquiry and the pre-sales queue stays clean.

import { dbList, dbGetById, dbInsert, dbPatch } from '@/lib/db';
import { istDateStr } from '@/lib/date';
import { pushHistory, isLeadClosed } from '@/lib/leadStage';
import { autoAssignByCity } from '@/lib/leadAssign';
import { findFirstLeadByPhone, describeLeadOrigin, normalizePhone } from '@/lib/leadOrigin';

// Resolves a ?ref= code to a live attribution link, or null (unknown / switched off / malformed).
export async function resolveLandingRef(rawCode) {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{4,24}$/.test(code)) return null;
  try {
    const link = await dbGetById('attribution_links', code);
    if (!link || link.active === false) return null;
    return link;
  } catch {
    return null;
  }
}

// `lead` fields are already validated/cleaned by the route. Returns { lead, existing } — `existing`
// is true when the phone already had an open lead and nothing new was created.
export async function createHeseosLandingLead({ name, phone, city, propertyType, budget, timeline, productInterest, notes, link, pageUrl, clientRef, viaWhatsApp }) {
  const existingLeads = await dbList('leads');
  const target = normalizePhone(phone);

  const open = existingLeads
    .filter((l) => normalizePhone(l.phone) === target && !isLeadClosed(l))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  if (open) {
    try {
      await dbPatch('leads', open.id, {
        history: pushHistory(open, {
          event: 'Customer enquired again via landing page',
          by: 'landing_page',
          note: [city && `City: ${city}`, propertyType && `Property: ${propertyType}`, notes].filter(Boolean).join(' · ') || 'Smart home enquiry form',
        }),
      });
    } catch (err) {
      console.error('createHeseosLandingLead: could not annotate existing lead:', err);
    }
    return { lead: open, existing: true };
  }

  // First-touch attribution — only credit the referrer if this number has never been a lead before.
  const firstLead = findFirstLeadByPhone(phone, existingLeads);
  const credited = !!(link && !firstLead);
  let duplicateNote = null;
  if (link && firstLead) {
    const [partners, employees, links] = await Promise.all([dbList('partners'), dbList('employees'), dbList('attribution_links')]);
    duplicateNote = `Not credited — ${describeLeadOrigin(firstLead, { partners, employees, leads: existingLeads, links })}, so payout credit stays with the original referrer.`;
  }

  const now = new Date().toISOString();
  const id = `L${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;
  const { assignedTo, salesEngineerId } = await autoAssignByCity(city);

  const lead = {
    id,
    createdAt: now,
    date: istDateStr(),
    status: 'new',

    name,
    phone,
    email: '',
    city,
    postcode: '',

    productInterest: productInterest || [],
    propertyType: propertyType || '',
    budget: budget || '',
    timeline: timeline || '',
    persona: '',
    notes: notes || '',
    // De-dupes a double-tap / retry of the same form submission (see app/api/leads/landing).
    landingClientRef: clientRef || null,

    // Same rule as lib/heseosLeadSync.js: the link's kind wins even when payout credit is
    // suppressed (first-touch) — the channel is still true, only the credit moves.
    source: link ? link.kind : (viaWhatsApp ? 'whatsapp_bot' : 'landing_page'),
    viaLandingPage: true,
    partnerId: credited ? (link.partnerId || null) : null,
    attributionLinkId: credited ? link.id : null,
    attributionKind: credited ? link.kind : null,
    referredByLeadId: credited ? (link.customerLeadId || null) : null,

    contactStage: null,
    demoOutcome: null,
    assignedTo,
    salesEngineerId,

    history: [],
  };
  lead.history = pushHistory(lead, {
    event: 'Lead Submitted',
    by: credited && link.partnerId ? `partner:${link.partnerId}` : 'landing_page',
    note: credited ? `Landing page via ${link.kind} (${link.label || link.id})` : `Landing page${pageUrl ? ` (${pageUrl})` : ''}`,
  });
  if (duplicateNote) {
    lead.history = pushHistory(lead, { event: 'Not credited — first-touch attribution', by: 'system', note: duplicateNote });
  }
  if (assignedTo) {
    lead.history = pushHistory(lead, { event: 'Auto-assigned by city', by: 'system', note: `${city} · pre-sales matched` });
  }

  await dbInsert('leads', id, lead);
  return { lead, existing: false };
}
