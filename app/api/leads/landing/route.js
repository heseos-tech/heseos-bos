// app/api/leads/landing/route.js
// PUBLIC (no login) — the HESEOS smart-home enquiry landing page (/smart-home,
// public/smart-home/index.html) posts here. Creates a lead exactly like every other channel
// (lib/heseosLandingLead.js: lead source follows the channel — QR / Referral / WhatsApp Direct, else 'landing_page' — first-touch referral credit for ?ref=<code>,
// city-based pre-sales auto-assignment) and WhatsApps the customer a "we've received your
// enquiry" confirmation from HESEOS's own number (lib/heseosNotify.js).
//
// Abuse guards, since this is open to the internet AND triggers an outbound WhatsApp message to
// whatever number is typed in: a hidden honeypot field, a per-IP rate limit, a per-phone cap, and
// `clientRef` de-duplication so a double-tap or browser retry never creates two leads.
import { dbList } from '@/lib/db';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { PRODUCT_INTEREST, PROPERTY_TYPE, BUDGET_BY_PROPERTY, TIMELINE } from '@/lib/formOptions';
import { indianMobile } from '@/lib/heseosDoorLock';
import { normalizePhone } from '@/lib/leadOrigin';
import { createHeseosLandingLead, resolveLandingRef } from '@/lib/heseosLandingLead';
import { notifyHeseosLandingLeadCaptured } from '@/lib/heseosNotify';

export const dynamic = 'force-dynamic';

const IP_LIMIT = { max: 20, windowMs: 60 * 60 * 1000 };
const HOUR_MS = 60 * 60 * 1000;
const clean = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }

  // Honeypot — a real visitor never sees or fills this field. Pretend success so a bot learns nothing.
  if (body?.website) return Response.json({ ok: true, leadId: 'L00000000' });

  const { allowed } = await checkRateLimit(`landing-lead:${getClientIp(request)}`, IP_LIMIT);
  if (!allowed) return Response.json({ error: 'Too many requests from this connection. Please try again later.' }, { status: 429 });

  const name = clean(body?.name, 80);
  const mobile = indianMobile(body?.phone);
  const city = clean(body?.city, 60);
  const notes = clean(body?.notes, 400);
  const clientRef = clean(body?.clientRef, 64) || null;

  if (name.length < 2) return Response.json({ error: 'Please enter your full name.' }, { status: 400 });
  if (!mobile) return Response.json({ error: 'Please enter a valid 10-digit mobile number.' }, { status: 400 });
  if (city.length < 2) return Response.json({ error: 'Please select or enter your city.' }, { status: 400 });

  // Only ever store vocabulary the rest of the app understands (lib/formOptions.js) — anything else
  // is dropped rather than rejected, so a stale cached page can never block a real enquiry.
  const propertyType = PROPERTY_TYPE.some((p) => p.v === body?.propertyType) ? body.propertyType : '';
  const budget = propertyType && (BUDGET_BY_PROPERTY[propertyType] || []).some((b) => b.v === body?.budget) ? body.budget : '';
  const timeline = TIMELINE.some((t) => t.v === body?.timeline) ? body.timeline : '';
  const interestSet = new Set(PRODUCT_INTEREST.map((p) => p.v));
  const productInterest = (Array.isArray(body?.productInterest) ? body.productInterest : []).filter((v) => interestSet.has(v)).slice(0, 10);

  const existing = await dbList('leads');

  // Same click sent twice (double tap, retry) -> hand back the lead that already exists.
  if (clientRef) {
    const dup = existing.find((l) => l.landingClientRef === clientRef);
    if (dup) return Response.json({ ok: true, leadId: dup.id, duplicate: true });
  }

  // Per-phone cap — the lead-creation path already merges repeat enquiries into one open lead, but
  // this also stops the page being used to spam someone's WhatsApp with confirmations.
  const target = normalizePhone(mobile);
  const recent = existing.filter((l) => l.viaLandingPage && normalizePhone(l.phone) === target && Date.now() - new Date(l.createdAt).getTime() < HOUR_MS);
  if (recent.length >= 3) {
    return Response.json({ error: 'We already have your enquiry. Our team will contact you shortly.' }, { status: 429 });
  }

  const link = body?.ref ? await resolveLandingRef(body.ref) : null;

  let result;
  try {
    result = await createHeseosLandingLead({
      name, phone: mobile, city, propertyType, budget, timeline, productInterest, notes, link, pageUrl: '/smart-home', clientRef, viaWhatsApp: body?.via === 'wa',
    });
  } catch (err) {
    console.error('POST /api/leads/landing error:', err);
    return Response.json({ error: 'Could not submit your enquiry right now. Please try again in a moment.' }, { status: 500 });
  }

  // Best-effort — notifyHeseosLandingLeadCaptured never throws, and a failed WhatsApp send must not
  // undo a lead that's already safely recorded. A repeat enquiry on an already-open lead doesn't get
  // a second confirmation message.
  let whatsappSent = false;
  if (!result.existing) {
    const wa = await notifyHeseosLandingLeadCaptured(result.lead).catch((err) => { console.error('notifyHeseosLandingLeadCaptured error:', err); return null; });
    whatsappSent = !!wa?.ok;
  }

  return Response.json({ ok: true, leadId: result.lead.id, existing: result.existing, whatsappSent });
}
