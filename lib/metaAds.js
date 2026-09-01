// Meta Lead Ads settings — lets the admin connect one Meta Page (by pasting a Page Access
// Token) and choose exactly which of that Page's Lead Ad (Instant Form) forms should flow
// into the `leads` table, instead of the old all-or-nothing setup where every leadgen event
// on the Page was captured and the only "config" was env vars + Meta's own dashboard.
//
// Storage: a single row in the `settings` table, id 'meta_ads'. Shape:
//   { pageAccessToken, pageId, pageName, forms: [{id, name, status, enabled}], connectedAt, connectedBy, updatedAt }

import { dbGetById, dbInsert } from '@/lib/db';
import { istDateStr } from '@/lib/date';
import { pushHistory } from '@/lib/leadStage';
import { mapMetaLead } from '@/lib/metaLeadMap';
import { autoAssignByCity } from '@/lib/leadAssign';

const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v20.0';
const SETTINGS_ID = 'meta_ads';

export async function getMetaSettings() {
  return (await dbGetById('settings', SETTINGS_ID)) || null;
}

export async function saveMetaSettings(patch) {
  const existing = (await getMetaSettings()) || {};
  const next = { ...existing, ...patch, id: SETTINGS_ID, updatedAt: new Date().toISOString() };
  await dbInsert('settings', SETTINGS_ID, next);
  return next;
}

// The token actually used to pull lead field data from Meta — prefers the Page token the
// admin connected in Settings, falls back to the env var so existing deployments keep working.
export function activeAccessToken(settings) {
  return (settings && settings.pageAccessToken) || process.env.META_LEAD_ACCESS_TOKEN || null;
}

// Which form IDs are allowed to create leads. `null` means "capture from every form" — the
// original behaviour — which stays true until the admin has actually connected a Page and the
// forms list is non-empty. Once configured, only forms explicitly toggled on come through.
export function enabledFormIds(settings) {
  if (!settings || !Array.isArray(settings.forms) || settings.forms.length === 0) return null;
  return new Set(settings.forms.filter((f) => f && f.enabled).map((f) => f.id));
}

export async function fetchPageInfo(token) {
  try {
    const res = await fetch(`https://graph.facebook.com/${API_VERSION}/me?fields=id,name&access_token=${encodeURIComponent(token)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data?.error?.message || 'Meta rejected this token — check it is a Page Access Token, not a User token, and hasn\'t expired.' };
    return { data };
  } catch (e) {
    return { error: String((e && e.message) || e) };
  }
}

export async function fetchLeadForms(pageId, token) {
  try {
    const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${pageId}/leadgen_forms?fields=id,name,status&limit=100&access_token=${encodeURIComponent(token)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data?.error?.message || 'Could not load Lead Ad forms for this Page — the token needs the leads_retrieval permission.' };
    return { data: Array.isArray(data?.data) ? data.data : [] };
  } catch (e) {
    return { error: String((e && e.message) || e) };
  }
}

// Pulls a form's full lead history directly, paginated — the manual "Sync Leads Now" safety
// net in Settings. Unlike the webhook (which only ever sees leads submitted *after* it's
// correctly connected), this reads whatever Meta already has on file for the form, so it also
// recovers anything missed during a connection problem or a webhook outage.
export async function fetchFormLeads(formId, token) {
  const leads = [];
  let url = `https://graph.facebook.com/${API_VERSION}/${formId}/leads?fields=id,created_time,ad_id,field_data&limit=100&access_token=${encodeURIComponent(token)}`;
  while (url) {
    try {
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { leads, error: data?.error?.message || 'Graph API request failed' };
      leads.push(...(Array.isArray(data.data) ? data.data : []));
      url = data.paging?.next || null;
    } catch (e) {
      return { leads, error: String((e && e.message) || e) };
    }
  }
  return { leads, error: null };
}

// Pulls every enabled form's full lead history from Meta and inserts anything missing.
// Shared by every manual sync trigger in the app: the "Sync Leads Now" button in Admin →
// Settings → Meta Lead Ads, and the small sync icon on the Leads list (admin) and the
// Pre-sales panel (via POST /api/leads/sync — see that route for the any-employee auth check).
// Safe to call any time — every lead is looked up by its deterministic id before inserting, so
// nothing is ever duplicated.
export async function syncAllLeads() {
  const settings = await getMetaSettings();
  if (!settings || !settings.pageAccessToken) return { error: 'No Meta Page connected — connect one in Admin → Settings first.' };

  const token = activeAccessToken(settings);
  const enabledForms = (settings.forms || []).filter((f) => f && f.enabled);
  if (!token) return { error: 'No access token available to sync with.' };
  if (enabledForms.length === 0) return { error: 'No forms are toggled on — turn at least one on before syncing.' };

  let inserted = 0;
  let skipped = 0;
  const formResults = [];
  for (const form of enabledForms) {
    const { leads, error: fetchError } = await fetchFormLeads(form.id, token);
    if (fetchError) { formResults.push({ id: form.id, name: form.name, error: fetchError }); continue; }

    let formInserted = 0;
    for (const lead of leads) {
      const id = `META${lead.id}`;
      const already = await dbGetById('leads', id);
      if (already) { skipped++; continue; }

      const { mapped, rawMetaFields } = mapMetaLead(lead.field_data || []);
      if (!mapped.name || !mapped.phone) { skipped++; continue; }

      const createdAt = lead.created_time || new Date().toISOString();
      const { assignedTo, salesEngineerId } = await autoAssignByCity(mapped.city);
      const record = {
        id,
        createdAt,
        date: istDateStr(createdAt),
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
        metaLeadgenId: lead.id,
        metaFormId: form.id,
        metaAdId: lead.ad_id || null,
        rawMetaFields,
        contactStage: null,
        demoOutcome: null,
        assignedTo,
        salesEngineerId,
        history: [],
      };
      record.history = pushHistory(record, { event: 'Lead Submitted', by: 'meta_lead_form', note: 'Meta Instant Form' });
      record.history = pushHistory(record, { event: 'Synced', by: 'admin', note: "Pulled directly from Meta's Graph API — wasn't captured by the webhook yet." });
      if (assignedTo) record.history = pushHistory(record, { event: 'Auto-assigned by city', by: 'system', note: (mapped.city || '') + ' · pre-sales matched' });

      await dbInsert('leads', id, record);
      inserted++; formInserted++;
    }
    formResults.push({ id: form.id, name: form.name, total: leads.length, inserted: formInserted });
  }

  await saveMetaSettings({ lastSyncedAt: new Date().toISOString(), lastSyncInserted: inserted });
  return { inserted, skipped, forms: formResults };
}

// Tells Meta "send this app's webhook events for this Page" — without this, Meta never
// delivers leadgen events even if the app-level webhook (see registerAppWebhook) is set up
// and this Page's token is valid. Safe to call again on every (re)connect/refresh; Meta just
// confirms the existing subscription.
export async function subscribePageToApp(pageId, token) {
  try {
    const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${pageId}/subscribed_apps?subscribed_fields=leadgen&access_token=${encodeURIComponent(token)}`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) return { error: data?.error?.message || 'Meta did not confirm the Page subscription — leads may not arrive until this succeeds.' };
    return { data };
  } catch (e) {
    return { error: String((e && e.message) || e) };
  }
}

// One-time, app-level setup: tells Meta which URL + verify token to call for `leadgen`
// events on ANY Page that later subscribes (see subscribePageToApp above). Needs an App
// Access Token, built from META_APP_ID + META_APP_SECRET (Meta's own "<app-id>|<app-secret>"
// format — no extra network round trip to fetch one).
export async function registerAppWebhook() {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const verifyToken = process.env.META_LEAD_VERIFY_TOKEN;
  const baseUrl = process.env.PUBLIC_BASE_URL;
  if (!appId || !appSecret) return { error: 'Set META_APP_ID and META_APP_SECRET in your environment first (App Dashboard → Settings → Basic).' };
  if (!verifyToken) return { error: 'Set META_LEAD_VERIFY_TOKEN in your environment first — this is the value Meta will be told to send back on verification.' };
  if (!baseUrl) return { error: 'Set PUBLIC_BASE_URL in your environment first — it needs to be your live https:// domain.' };

  const callbackUrl = `${baseUrl.replace(/\/$/, '')}/api/leads/meta-webhook`;
  const appToken = `${appId}|${appSecret}`;
  try {
    const url = `https://graph.facebook.com/${API_VERSION}/${appId}/subscriptions?object=page&callback_url=${encodeURIComponent(callbackUrl)}&verify_token=${encodeURIComponent(verifyToken)}&fields=leadgen&access_token=${encodeURIComponent(appToken)}`;
    const res = await fetch(url, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) return { error: data?.error?.message || 'Meta did not confirm the webhook registration.' };
    return { data: { callbackUrl } };
  } catch (e) {
    return { error: String((e && e.message) || e) };
  }
}
