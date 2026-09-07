// Meta Lead Ads settings — everything for this integration is configured from Admin ->
// Settings, nothing from server env vars: connect a Page (paste a Page Access Token), choose
// exactly which of that Page's Lead Ad (Instant Form) forms should flow into the `leads` table,
// and save the Meta App ID/Secret used for the one-time, app-wide webhook registration (see
// registerAppWebhook and app/api/admin/meta/route.js's save_app_credentials action). The verify
// token is generated and stored automatically the first time it's needed (see
// ensureVerifyToken) — nobody ever types one in.
//
// Storage: a single row in the `settings` table, id 'meta_ads' — the ONLY place any of this
// configuration lives. Shape:
//   { pageAccessToken, pageId, pageName, forms: [{id, name, status, enabled}], appId, appSecret,
//     verifyToken, webhookRegistered, webhookRegisteredAt, webhookCallbackUrl, connectedAt,
//     connectedBy, updatedAt }

import crypto from 'crypto';
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

// The token actually used to pull lead field data from Meta — the Page Access Token the admin
// connected in Admin -> Settings. No other page is captured until one is connected there.
export function activeAccessToken(settings) {
  return (settings && settings.pageAccessToken) || null;
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

    // `/me` just echoes back whatever identity owns the token — for a genuine Page Access Token
    // that IS the Page, but for a User token or a Business Suite System User token (which the
    // Settings UI explicitly suggests generating) it's the person/system-user's own id instead,
    // and that id has no leadgen_forms edge at all: Meta answers with the misleading
    // "(#100) Tried accessing nonexisting field (leadgen_forms)" rather than a clear permission
    // error. Try to resolve to an actual Page + Page-scoped token via /me/accounts (the standard
    // Meta exchange for this) before falling back to treating the pasted token as page-scoped —
    // this makes both kinds of token "just work" rather than silently failing later.
    try {
      const acctRes = await fetch(`https://graph.facebook.com/${API_VERSION}/me/accounts?fields=id,name,access_token&limit=100&access_token=${encodeURIComponent(token)}`);
      const accounts = await acctRes.json().catch(() => ({}));
      if (acctRes.ok && Array.isArray(accounts?.data) && accounts.data.length) {
        if (accounts.data.length === 1) {
          const p = accounts.data[0];
          return { data: { id: p.id, name: p.name, pageAccessToken: p.access_token } };
        }
        return {
          error: `This token manages ${accounts.data.length} Pages (${accounts.data.map((p) => p.name).join(', ')}) — paste that specific Page's own access token instead (Meta Business Suite → that Page's Settings → Page Access Token, or Graph API Explorer with the Page selected as the acting identity).`,
        };
      }
    } catch {
      // Network hiccup on the /me/accounts probe — fall through and try the token as-is rather
      // than failing the whole connect over a secondary check.
    }

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

// Auto-generates and persists a verify token the very first time it's needed, so nobody ever
// has to type one in (or hit Meta's 64-char cap by hand). Once stored on the settings row,
// that's the only value ever used again.
async function ensureVerifyToken(settings) {
  if (settings?.verifyToken) return settings.verifyToken;
  const token = crypto.randomBytes(24).toString('hex'); // 48 hex chars — well under Meta's 64-char cap
  await saveMetaSettings({ verifyToken: token });
  return token;
}

// One-time, app-level setup: tells Meta which URL + verify token to call for `leadgen`
// events on ANY Page that later subscribes (see subscribePageToApp above). Fully self-service
// from Admin → Settings, no server env vars at all: appId/appSecret come from what the admin
// saved there (see save_app_credentials in app/api/admin/meta/route.js), the verify token is
// generated and stored automatically (see ensureVerifyToken above), and the callback URL is
// built from `requestHost` — the Host header off the admin's own request to register this,
// since that's the one domain we know for certain reaches this deployment.
export async function registerAppWebhook(requestHost) {
  const settings = await getMetaSettings();
  const appId = settings?.appId;
  const appSecret = settings?.appSecret;
  if (!appId || !appSecret) return { error: 'Save your Meta App ID and App Secret above first (Meta App Dashboard → Settings → Basic).' };

  const verifyToken = await ensureVerifyToken(settings);
  const baseUrl = requestHost ? `https://${requestHost}` : null;
  if (!baseUrl) return { error: "Could not determine this site's public URL automatically — try registering again from the live Admin panel." };

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
