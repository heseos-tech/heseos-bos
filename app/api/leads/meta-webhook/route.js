// Meta Lead Ads webhook — auto-pulls Instant Form submissions (the same forms as the PDF you
// shared) straight into the `leads` table instead of downloading the CSV by hand.
//
// Setup: in your Meta App dashboard, add a webhook subscribed to the Page's `leadgen` field,
// pointing at this URL, with META_LEAD_VERIFY_TOKEN as the verify token. You also need a Page
// access token with the `leads_retrieval` permission, set as META_LEAD_ACCESS_TOKEN — Meta's
// webhook only tells you a leadgen_id was created; the actual answers are fetched separately
// via the Graph API (see fetchLeadFields below).

import { dbInsert, dbGetById } from '@/lib/db';
import { istDateStr } from '@/lib/date';
import { pushHistory } from '@/lib/leadStage';
import { mapMetaLead } from '@/lib/metaLeadMap';

export const dynamic = 'force-dynamic';

const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v20.0';

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

async function fetchLeadFields(leadgenId) {
  const accessToken = process.env.META_LEAD_ACCESS_TOKEN;
  if (!accessToken) return { error: 'META_LEAD_ACCESS_TOKEN not configured' };
  const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${leadgenId}?access_token=${encodeURIComponent(accessToken)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: data?.error?.message || 'Graph API request failed' };
  return { data };
}

export async function POST(req) {
  const payload = await req.json().catch(() => ({}));

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== 'leadgen') continue;
      const v = change.value || {};
      const leadgenId = v.leadgen_id;
      if (!leadgenId) continue;

      try {
        const { data, error } = await fetchLeadFields(leadgenId);
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
