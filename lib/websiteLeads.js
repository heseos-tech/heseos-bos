// Website Lead Form capture — self-service so the admin can wire up their own website's
// contact/enquiry form without asking a developer to touch this codebase. The admin generates
// an API key in Settings, hands it (plus the endpoint URL) to whoever builds/maintains the
// website form, and every submission POSTed with that key lands straight in the same `leads`
// table other channels use (see app/api/leads/website/route.js).
//
// Deliberately a SEPARATE endpoint from the existing app/api/leads (the internal, same-origin
// route the embedded LeadForm component already posts to) rather than retrofitting auth onto
// that one — this one is meant to be called cross-origin, from arbitrary external code, so it
// needs its own key check, rate limiting and CORS handling that the internal route doesn't.
//
// Storage: a single row in the `settings` table, id 'website_leads'.
//   { apiKey, enabled, createdAt, createdBy, regeneratedAt, updatedAt }

import crypto from 'crypto';
import { dbGetById, dbInsert } from '@/lib/db';

const SETTINGS_ID = 'website_leads';

export async function getWebsiteLeadSettings() {
  return (await dbGetById('settings', SETTINGS_ID)) || null;
}

export async function saveWebsiteLeadSettings(patch) {
  const existing = (await getWebsiteLeadSettings()) || {};
  const next = { ...existing, ...patch, id: SETTINGS_ID, updatedAt: new Date().toISOString() };
  await dbInsert('settings', SETTINGS_ID, next);
  return next;
}

export function generateApiKey() {
  return `wlk_${crypto.randomBytes(24).toString('base64url')}`;
}
