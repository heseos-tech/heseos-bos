// Google Ads Lead Form webhook — receives a submission the moment a customer fills in a Lead
// Form ad, straight from Google (no polling, no CSV export). See lib/googleAdsLeads.js for how
// the webhook key is generated/rotated, and Google's own contract at
// https://developers.google.com/google-ads/webhook/docs/implementation.
//
// Setup (per Lead Form asset, done once in Google Ads' own UI — Google has no API for us to
// push this config to, unlike Meta's Page subscription): Assets → Lead form → Delivery →
// Webhook integration → paste the URL and key shown in Admin → Settings → Google Ads Lead Form.
//
// Response contract Google expects: 200 + {} on success (whether or not we actually stored a
// lead — a duplicate or a genuinely empty submission is still "received"), 4xx + {message} for
// something Google should NOT retry (bad key, disabled), 5xx + {message} only for a genuine
// server error Google SHOULD retry. Google doesn't guarantee exactly-once delivery, so lead_id
// is used to dedupe the same way Meta's leadgen_id is (see app/api/leads/meta-webhook).

import { dbInsert, dbGetById } from '@/lib/db';
import { istDateStr } from '@/lib/date';
import { pushHistory } from '@/lib/leadStage';
import { autoAssignByCity } from '@/lib/leadAssign';
import { mapGoogleAdsLead } from '@/lib/googleAdsLeadMap';
import { getGoogleAdsLeadSettings, saveGoogleAdsLeadSettings } from '@/lib/googleAdsLeads';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

function json(body, status = 200) {
  return Response.json(body, { status });
}

// Generous — this is Google's own servers calling in, not a public form, but still capped
// against a leaked key being hammered.
const WEBHOOK_RATE_LIMIT = { max: 120, windowMs: 60 * 60 * 1000 };

export async function POST(request) {
  const ip = getClientIp(request);
  const { allowed } = await checkRateLimit(`google-ads-lead:${ip}`, WEBHOOK_RATE_LIMIT);
  if (!allowed) return json({ message: 'Too many requests.' }, 429);

  const body = await request.json().catch(() => null);
  if (!body) return json({ message: 'Invalid JSON body.' }, 400);

  const settings = await getGoogleAdsLeadSettings();
  if (!settings?.webhookKey) return json({ message: 'Google Ads Lead Form capture is not set up yet.' }, 401);
  if (String(body.google_key || '') !== settings.webhookKey) {
    return json({ message: 'Invalid key.' }, 401);
  }
  if (settings.enabled === false) {
    return json({ message: 'Google Ads Lead Form capture is currently disabled.' }, 403);
  }

  const leadId = String(body.lead_id || '').trim();
  if (!leadId) return json({ message: 'Missing lead_id.' }, 400);

  // Deterministic id, same trick as the Meta webhook — a re-delivery of the same lead_id lands
  // on the same row instead of creating a duplicate.
  const id = `GADS${leadId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60)}`;
  const existing = await dbGetById('leads', id);
  if (existing) return json({}); // already captured — still tell Google it was received

  try {
    const { mapped, rawGoogleFields } = mapGoogleAdsLead(body.user_column_data || []);
    if (!mapped.name || !mapped.phone) {
      console.error('Google Ads lead missing name/phone, skipped:', leadId);
      return json({}); // not our error — nothing to retry, and Google shouldn't keep resending it
    }

    const now = new Date().toISOString();
    const isTest = body.is_test === true;
    const { assignedTo, salesEngineerId } = await autoAssignByCity(mapped.city);
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
      notes: isTest ? '[TEST LEAD from Google Ads — not a real customer]' : '',
      source: 'google_ads_lead_form',
      partnerId: null,
      googleLeadId: leadId,
      googleFormId: body.form_id || null,
      googleCampaignId: body.campaign_id || null,
      isTestLead: isTest,
      rawGoogleFields,
      contactStage: null,
      demoOutcome: null,
      assignedTo,
      salesEngineerId,
      history: [],
    };
    lead.history = pushHistory(lead, { event: 'Lead Submitted', by: 'google_ads_lead_form', note: isTest ? 'Google Ads Lead Form (test)' : 'Google Ads Lead Form' });
    if (assignedTo) {
      lead.history = pushHistory(lead, { event: 'Auto-assigned by city', by: 'system', note: (mapped.city || '') + ' · pre-sales matched' });
    }
    await dbInsert('leads', id, lead);

    // Best-effort visibility for the admin (Settings shows "N leads received, last at …") —
    // never let this fail the webhook response.
    saveGoogleAdsLeadSettings({ leadsReceived: (settings.leadsReceived || 0) + 1, lastLeadAt: now }).catch(() => {});

    return json({});
  } catch (err) {
    console.error('Google Ads lead webhook error:', err);
    return json({ message: 'Internal error.' }, 500);
  }
}
