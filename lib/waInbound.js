// Shared WhatsApp lead-creation helper — originally the inbound handler for Heseos's legacy
// single-number Team Inbox (that whole system — /wa/[ref], the /api/whatsapp/webhook inbound
// handler, and the Team Inbox screen itself — has been retired in favour of the multi-tenant
// Bot Console). createLeadFromWhatsApp survives here because lib/heseosLeadSync.js's
// createHeseosLead() still reuses this exact lead-creation shape for Heseos's own in-house bot
// tenant.

import { dbInsert } from '@/lib/db';
import { istDateStr } from '@/lib/date';
import { pushHistory } from '@/lib/leadStage';

export async function createLeadFromWhatsApp({ phone, name, partnerId, source = 'whatsapp_bot', note = 'WhatsApp Bot', attributionLinkId = null, attributionKind = null, referredByLeadId = null, duplicateNote = null }) {
  const id = `L${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;
  const now = new Date().toISOString();
  const lead = {
    id,
    createdAt: now,
    date: istDateStr(),
    status: 'new',
    name: name || 'WhatsApp Lead',
    phone,
    email: '',
    city: '',
    postcode: '',
    productInterest: [],
    propertyType: '',
    budget: '',
    timeline: '',
    persona: '',
    source,
    partnerId: partnerId || null,
    // Set only for leads that came in through a QR code / referral link (lib/attribution.js) —
    // lets the Growth admin page and a referring customer's funnel find their leads without
    // scanning the whole leads table for a text match.
    attributionLinkId,
    attributionKind,
    referredByLeadId,
    contactStage: null,
    demoOutcome: null,
    assignedTo: null,
    salesEngineerId: null,
    history: [],
  };
  lead.history = pushHistory(lead, { event: 'Lead Submitted', by: partnerId ? `partner:${partnerId}` : 'whatsapp', note });
  // "Our system only considers who gave the lead first" — see lib/heseosLeadSync.js's
  // createHeseosLead for where this comes from: partnerId/attributionLinkId/attributionKind/
  // referredByLeadId above are already nulled by the caller when this phone number has an
  // earlier lead from any channel, so this is purely an audit-trail note, same pattern as
  // app/api/leads's own duplicateNote.
  if (duplicateNote) {
    lead.history = pushHistory(lead, { event: 'Not credited — first-touch attribution', by: 'system', note: duplicateNote });
  }
  await dbInsert('leads', id, lead);
  return lead;
}
