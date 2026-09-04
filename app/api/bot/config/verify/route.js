// Bot Configuration's "actually test this" endpoint — called on load (if credentials are
// already saved) and from the "Test Connection" button, and again right after Save. Accepts
// the credentials currently in the form (not yet saved) so a tenant can test before saving,
// falling back to whatever's already on the tenant record otherwise. Never trusts the client
// for anything except testing the tenant's OWN typed-in values — no arbitrary phoneNumberId/
// token pair reaches this without a valid session (getBotTenant()).

import { getBotTenant } from '@/lib/auth';
import { dbPatch } from '@/lib/db';
import { verifyBotCredentials } from '@/lib/botWhatsapp';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const tenant = await getBotTenant();
  if (!tenant) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const phoneNumberId = String(body.waPhoneNumberId ?? tenant.waPhoneNumberId ?? '').trim();
  const token = String(body.waAccessToken ?? tenant.waAccessToken ?? '').trim();

  if (!phoneNumberId || !token) {
    return Response.json({ ok: false, error: 'Add a Phone Number ID and Access Token first.' });
  }

  const result = await verifyBotCredentials({ phoneNumberId, token });

  // Persist the outcome on the tenant record — this is what lets Bot Configuration show a
  // connection status on load WITHOUT re-hitting Meta every time the page is opened (it used to
  // auto-test on every mount, which meant loading the page could itself surface a freshly
  // expired token as a page-load error, over and over). Test Connection / Save still trigger a
  // real live check on demand; this cached result is only what the badge shows in between.
  const verifyPatch = {
    waVerifiedStatus: result.ok ? 'connected' : 'error',
    waVerifiedAt: new Date().toISOString(),
    waVerifiedName: result.ok ? (result.verifiedName || null) : null,
    waVerifiedError: result.ok ? null : (result.error || null),
  };

  // Meta's own display_phone_number is now the single source of truth for tenant.whatsappNumber
  // — the field every QR code, referral link (lib/attribution.js's buildWaLink) and "Get
  // Started" WhatsApp CTA (app/get-started/route.js) resolves to. It used to be a one-time
  // random placeholder set at signup and never updated again, so a tenant could have a fully
  // working, verified WhatsApp connection while every scan/click still silently opened a chat
  // with a phone number that never existed. Refreshing it here — every successful verification,
  // not just at signup — keeps it correct even if the connected number ever changes.
  if (result.ok && result.displayPhoneNumber && result.displayPhoneNumber !== tenant.whatsappNumber) {
    verifyPatch.whatsappNumber = result.displayPhoneNumber;
  }

  try { await dbPatch('bot_tenants', tenant.id, verifyPatch); }
  catch (err) { console.error('Failed to save WhatsApp verification result:', err); }

  return Response.json(result);
}
