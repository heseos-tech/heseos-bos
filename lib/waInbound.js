// Shared WhatsApp lead-creation helper — originally the inbound handler for Heseos's legacy
// single-number Team Inbox (that whole system — /wa/[ref], the /api/whatsapp/webhook inbound
// handler, and the Team Inbox screen itself — has been retired in favour of the multi-tenant
// Bot Console). createLeadFromWhatsApp survives here because app/api/bot/webhook/route.js's
// bridgeToHeseosLeads() still reuses this exact lead-creation shape for Heseos's own in-house
// bot tenant.

import { dbInsert } from '@/lib/db';
import { istDateStr } from '@/lib/date';
import { pushHistory } from '@/lib/leadStage';

export async function createLeadFromWhatsApp({ phone, name, partnerId, source = 'whatsapp_bot', note = 'WhatsApp Bot', attributionLinkId = null, attributionKind = null, referredByLeadId = null }) {
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
  await dbInsert('leads', id, lead);
  return lead;
}
