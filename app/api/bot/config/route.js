// Bot Configuration screen's backend — GET the tenant's own config, PATCH to self-service edit
// it (business profile, welcome message per language, quick-menu, Go Live toggle). This is the
// "self service bot configuration so we can make bot live on the go" ask: every field here is
// editable by the tenant themselves, no developer involved.

import crypto from 'crypto';
import { dbPatch } from '@/lib/db';
import { getBotTenant } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// waPhoneNumberId/waAccessToken are the tenant's own Meta-generated credentials (self-service
// WhatsApp connect — see components/bot/ConfigScreen.jsx's "WhatsApp Connection" card). Note
// what is deliberately NOT here: waVerifyToken (generated once at signup, never re-editable —
// changing it would break the tenant's already-configured Meta webhook) and linkToHeseosLeads
// (a manual, trust-based grant — see app/api/bot/webhook/route.js — never tenant-settable).
//
// qrWelcomeMessage is optional, per-language, same shape as welcomeMessage — sent instead of it
// when a chat's first message came from a QR scan / partner link (see lib/botEngine.js's
// welcomeText()). Blank for a given language just falls back to the regular welcomeMessage.
const EDITABLE_FIELDS = ['businessName', 'botName', 'brandColor', 'status', 'languages', 'welcomeMessage', 'qrWelcomeMessage', 'menuOptions', 'whatsappNumber', 'waPhoneNumberId', 'waAccessToken'];

export async function GET() {
  let tenant = await getBotTenant();
  if (!tenant) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  // Backfill for tenants created before WhatsApp connect existed — every tenant needs their own
  // waVerifyToken to paste into their Meta App's webhook config (app/api/bot/webhook checks it).
  if (!tenant.waVerifyToken) {
    tenant = await dbPatch('bot_tenants', tenant.id, { waVerifyToken: crypto.randomBytes(16).toString('base64url') });
  }
  const { password, ...safe } = tenant;
  return Response.json(safe);
}

export async function PATCH(request) {
  const tenant = await getBotTenant();
  if (!tenant) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));

  const patch = {};
  for (const key of EDITABLE_FIELDS) {
    if (body[key] !== undefined) patch[key] = body[key];
  }
  if (patch.status && !['live', 'paused'].includes(patch.status)) delete patch.status;
  if (Object.keys(patch).length === 0) return Response.json({ error: 'Nothing to update' }, { status: 400 });

  const updated = await dbPatch('bot_tenants', tenant.id, patch);
  if (!updated) return Response.json({ error: 'Not found' }, { status: 404 });
  const { password, ...safe } = updated;
  return Response.json(safe);
}
