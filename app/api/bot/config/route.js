// Bot Configuration screen's backend — GET the tenant's own config, PATCH to self-service edit
// it (business profile, welcome message per language, quick-menu, Go Live toggle). This is the
// "self service bot configuration so we can make bot live on the go" ask: every field here is
// editable by the tenant themselves, no developer involved.

import { dbPatch } from '@/lib/db';
import { getBotTenant } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const EDITABLE_FIELDS = ['businessName', 'botName', 'brandColor', 'status', 'languages', 'welcomeMessage', 'menuOptions', 'whatsappNumber'];

export async function GET() {
  const tenant = await getBotTenant();
  if (!tenant) return Response.json({ error: 'Unauthorized' }, { status: 401 });
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
