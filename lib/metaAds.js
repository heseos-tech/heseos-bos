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
