import { dbGetById, dbPatch } from '@/lib/db';
import { getEmployee, invalidateAccountCache } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PATCH(request, { params }) {
  const admin = await getEmployee();
  if (!admin || admin.role !== 'admin') return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const target = await dbGetById('partners', id);
  if (!target) return Response.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const patch = {};
  if (typeof body.active === 'boolean') patch.active = body.active;
  // Admin correcting/filling in "who onboarded this partner" after the fact — e.g. a partner
  // that predates this field, or a QR claim that recorded the wrong employee. An empty string
  // clears it back to "not recorded" rather than being ignored, since that's a meaningful edit
  // too (same convention as `active` above: explicit values only, never guessed).
  if ('onboardedByEmployeeId' in body) {
    const val = String(body.onboardedByEmployeeId || '').trim();
    patch.onboardedByEmployeeId = val || null;
    patch.onboardedByEmployeeAt = val ? new Date().toISOString() : null;
    patch.onboardedVia = val ? 'admin_manual' : null;
  }

  const updated = await dbPatch('partners', id, patch);
  invalidateAccountCache('partners', id);
  const { password, ...safe } = updated;
  return Response.json(safe);
}
