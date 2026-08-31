// Meta Lead Ads settings — lets the admin connect one Meta Page (by pasting a Page Access
// Token) and choose exactly which of that Page's Lead Ad (Instant Form) forms should flow
// into the `leads` table, instead of the old all-or-nothing setup where every leadgen event
// on the Page was captured and the only "config" was env vars + Meta's own dashboard.
//
// Storage: a single row in the `settings` table, id 'meta_ads'. Shape:
//   { pageAccessToken, pageId, pageName, forms: [{id, name, status, enabled}], connectedAt, connectedBy, updatedAt }

import { dbGetById, dbInsert } from '@/lib/db';

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
