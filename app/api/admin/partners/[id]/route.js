import { dbGetById, dbPatch } from '@/lib/db';
import { getEmployee } from '@/lib/auth';

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

  const updated = await dbPatch('partners', id, patch);
  const { password, ...safe } = updated;
  return Response.json(safe);
}
