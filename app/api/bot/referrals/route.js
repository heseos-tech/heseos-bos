// Referral sources for the tenant's bot (e.g. "shared via a website widget", "WhatsApp QR in
// store"). Seeded once at signup (see app/api/auth/bot/register) — a real integration would
// track these per-source click/scan counts live.

import { getBotTenant } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const tenant = await getBotTenant();
  if (!tenant) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  return Response.json(tenant.referrals || []);
}
