// Google Ads Lead Form settings — self-service, mirroring lib/websiteLeads.js's shape.
//
// Google's Lead Form Webhook integration is simpler than Meta's: there's no OAuth/access-token
// exchange and nothing to auto-subscribe from our side — the advertiser pastes a webhook URL
// and a secret "key" directly into each Lead Form asset's Delivery settings inside the Google
// Ads UI (Tools & Settings → Conversions → Lead form extension → Webhook), and Google includes
// that key as `google_key` on every submission so we can validate it. See
// https://developers.google.com/google-ads/webhook/docs/implementation for the wire format.
//
// So the ONLY thing to configure here is: generate a key, hand the admin the webhook URL + key
// to paste into Google Ads (once per lead form asset — Google has no API for us to push this
// config to, unlike Meta's Page subscription), and let them pause/resume or rotate the key.
//
// Storage: a single row in the `settings` table, id 'google_ads_leads'.
//   { webhookKey, enabled, createdAt, createdBy, regeneratedAt, updatedAt }

import crypto from 'crypto';
import { dbGetById, dbInsert } from '@/lib/db';

const SETTINGS_ID = 'google_ads_leads';

export async function getGoogleAdsLeadSettings() {
  return (await dbGetById('settings', SETTINGS_ID)) || null;
}

export async function saveGoogleAdsLeadSettings(patch) {
  const existing = (await getGoogleAdsLeadSettings()) || {};
  const next = { ...existing, ...patch, id: SETTINGS_ID, updatedAt: new Date().toISOString() };
  await dbInsert('settings', SETTINGS_ID, next);
  return next;
}

export function generateWebhookKey() {
  return `gak_${crypto.randomBytes(24).toString('base64url')}`;
}
