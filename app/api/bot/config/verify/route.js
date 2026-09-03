// Bot Configuration's "actually test this" endpoint — called on load (if credentials are
// already saved) and from the "Test Connection" button, and again right after Save. Accepts
// the credentials currently in the form (not yet saved) so a tenant can test before saving,
// falling back to whatever's already on the tenant record otherwise. Never trusts the client
// for anything except testing the tenant's OWN typed-in values — no arbitrary phoneNumberId/
// token pair reaches this without a valid session (getBotTenant()).

import { getBotTenant } from '@/lib/auth';
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
  return Response.json(result);
}
