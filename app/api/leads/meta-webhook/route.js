// Meta Lead Ads webhook — auto-pulls Instant Form submissions (the same forms as the PDF you
// shared) straight into the `leads` table instead of downloading the CSV by hand.
//
// Setup: in your Meta App dashboard, add a webhook subscribed to the Page's `leadgen` field,
// pointing at this URL, with META_LEAD_VERIFY_TOKEN as the verify token. You also need a Page
// access token with the `leads_retrieval` permission, set as META_LEAD_ACCESS_TOKEN — Meta's
// webhook only tells you a leadgen_id was created; the actual answers are fetched separately
// via the Graph API (see fetchLeadFields below).

import crypto from 'crypto';
import { dbInsert, dbGetById } from '@/lib/db';
import { istDateStr } from '@/lib/date';
import { pushHistory } from '@/lib/leadStage';
import { mapMetaLead } from '@/lib/metaLeadMap';
import { getMetaSettings, activeAccessToken, enabledFormIds } from '@/lib/metaAds';

export const dynamic = 'force-dynamic';

const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v20.0';

// Verifies Meta's X-Hub-Signature-256 header against the raw request body, so a forged POST
// can't inject fake leads into the pipeline. Skipped (returns true) when META_APP_SECRET
// isn't set yet, so local/dev setups aren't blocked before it's configured — set it in
// production once you have your Meta App's secret.
function verifyMetaSignature(rawBody, signatureHeader) {
  const secret = process.env.META_APP_SECRET;
  if (!secret) return true;
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const provided = signatureHeader.slice('sha256='.length);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'));
  } catch {
    return false;
  }
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');
  if (mode === 'subscribe' && token && token === process.env.META_LEAD_VERIFY_TOKEN) {
    return new Response(challenge || '', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
  return new Response('Forbidden', { status: 403 });
}

async function fetchLeadFields(leadgenId, accessToken) {
  if (!accessToken) return { error: 'No Meta access token configured — connect a Page in Admin → Settings, or set META_LEAD_ACCESS_TOKEN.' };
  const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${leadgenId}?access_token=${encodeURIComponent(accessToken)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: data?.error?.message || 'Graph API request failed' };
  return { data };
}

export async function POST(req) {
  const rawBody = await req.text();
  if (!verifyMetaSignature(rawBody, req.headers.get('x-hub-signature-256'))) {
    console.error('Meta lead webhook: invalid signature — rejected');
    return new Response('Invalid signature', { status: 401 });
  }
  let payload = {};
  try { payload = JSON.parse(rawBody || '{}'); } catch { /* empty/invalid body */ }

  // Self-service form selection: once the admin has connected a Page in Settings, only forms
  // toggled on there are captured. Until then (no settings row / no forms saved yet), every
  // form on the subscribed Page is captured — the original behaviour.
  const settings = await getMetaSettings();
  const accessToken = activeAccessToken(settings);
  const allowedFormIds = enabledFormIds(settings);

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== 'leadgen') continue;
      const v = change.value || {};
      const leadgenId = v.leadgen_id;
      if (!leadgenId) continue;
      if (allowedFormIds && (!v.form_id || !allowedFormIds.has(v.form_id))) {
        console.log('Meta lead webhook: skipped — form not enabled for capture:', v.form_id);
        continue;
      }

      try {
        const { data, error } = await fetchLeadFields(leadgenId, accessToken);
        if (error || !data) { console.error('Meta lead fetch failed:', leadgenId, error); continue; }

        const { mapped, rawMetaFields } = mapMetaLead(data.field_data || []);
        if (!mapped.name || !mapped.phone) { console.error('Meta lead missing name/phone, skipped:', leadgenId); continue; }

        // Deterministic id → re-deliveries of the same leadgen_id update the same row instead
        // of creating a duplicate (dbInsert does an upsert on conflict).
        const id = `META${leadgenId}`;
        const existing = await dbGetById('leads', id);
        if (existing) continue; // already captured

        const now = new Date().toISOString();
        const lead = {
          id,
          createdAt: now,
          date: istDateStr(),
          status: 'new',
          name: mapped.name,
          phone: mapped.phone,
          email: mapped.email,
          city: mapped.city,
          postcode: mapped.postcode,
          productInterest: mapped.productInterest,
          propertyType: mapped.propertyType,
          budget: mapped.budget,
          timeline: mapped.timeline,
          persona: mapped.persona,
          source: 'meta_lead_form',
          partnerId: null,
          metaLeadgenId: leadgenId,
          metaFormId: v.form_id || null,
          metaAdId: v.ad_id || null,
          rawMetaFields,
          contactStage: null,
          demoOutcome: null,
          assignedTo: null,
          salesEngineerId: null,
          history: [],
        };
        lead.history = pushHistory(lead, { event: 'Lead Submitted', by: 'meta_lead_form', note: 'Meta Instant Form' });
        await dbInsert('leads', id, lead);
      } catch (err) {
        console.error('Meta lead webhook error:', err);
      }
    }
  }

  return Response.json({ received: true });
}
