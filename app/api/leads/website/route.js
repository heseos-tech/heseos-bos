// Public, API-key-protected lead intake for the admin's own website form — a self-service
// alternative to app/api/leads (the internal, same-origin route the embedded LeadForm
// component posts to) meant to be called cross-origin from arbitrary code the admin's web
// developer owns. Every accepted submission lands in the same `leads` table as every other
// channel, tagged source: 'website_api' so it's distinguishable from the embedded-form leads.
//
// Protections, in order (cheapest first): CORS preflight handled explicitly, rate limit by IP,
// honeypot field, API key check, capture-enabled check, then required-field validation.

import { dbInsert } from '@/lib/db';
import { istDateStr } from '@/lib/date';
import { pushHistory } from '@/lib/leadStage';
import { autoAssignByCity } from '@/lib/leadAssign';
import { getWebsiteLeadSettings } from '@/lib/websiteLeads';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Api-Key',
};

function json(body, status = 200) {
  return Response.json(body, { status, headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

const SUBMIT_RATE_LIMIT = { max: 30, windowMs: 60 * 60 * 1000 }; // 30/hour per IP — generous for a real site, still capped against abuse

export async function POST(request) {
  const ip = getClientIp(request);
  const { allowed } = await checkRateLimit(`website-lead:${ip}`, SUBMIT_RATE_LIMIT);
  if (!allowed) return json({ error: 'Too many submissions from this address — try again later.' }, 429);

  const body = await request.json().catch(() => ({}));

  // Honeypot: a real visitor never fills this (it's hidden off-screen in any form built
  // against this API's docs) — a bot filling every field will. Fake success, no DB write.
  if (body.hp_note) return json({ success: true });

  const settings = await getWebsiteLeadSettings();
  const providedKey = request.headers.get('x-api-key') || body.apiKey || '';
  if (!settings?.apiKey || providedKey !== settings.apiKey) {
    return json({ error: 'Invalid or missing API key.' }, 401);
  }
  if (settings.enabled === false) {
    return json({ error: 'Website lead capture is currently disabled.' }, 403);
  }

  const name = String(body.name || '').trim();
  const phone = String(body.phone || '').trim();
  if (!name || !phone) {
    return json({ error: 'Missing required fields (name, phone)' }, 400);
  }
  const city = String(body.city || '').trim();

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
    email: body.email || '',
    city,
    postcode: body.postcode || '',

    productInterest: Array.isArray(body.productInterest) ? body.productInterest : [],
    propertyType: body.propertyType || '',
    budget: body.budget || '',
    timeline: body.timeline || '',
    persona: body.persona || '',
    notes: body.message || body.notes || '',

    source: 'website_api',
    partnerId: null,

    contactStage: null,
    demoOutcome: null,
    assignedTo,
    salesEngineerId,

    history: [],
  };
  lead.history = pushHistory(lead, { event: 'Lead Submitted', by: 'website_api', note: 'Website contact form' });
  if (assignedTo) {
    lead.history = pushHistory(lead, { event: 'Auto-assigned by city', by: 'system', note: `${city} · pre-sales matched` });
  }

  await dbInsert('leads', id, lead);

  return json({ success: true, id: lead.id });
}
