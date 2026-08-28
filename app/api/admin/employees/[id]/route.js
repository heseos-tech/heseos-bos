import { dbGetById, dbPatch } from '@/lib/db';
import { getEmployee, EMPLOYEE_ROLES } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PATCH(request, { params }) {
  const admin = await getEmployee();
  if (!admin || admin.role !== 'admin') return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const target = await dbGetById('employees', id);
  if (!target) return Response.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const patch = {};
  if (typeof body.active === 'boolean') patch.active = body.active;
  if (body.role) {
    if (!EMPLOYEE_ROLES.includes(body.role)) return Response.json({ error: 'Invalid role' }, { status: 400 });
    patch.role = body.role;
  }

  const updated = await dbPatch('employees', id, patch);
  const { password, ...safe } = updated;
  return Response.json(safe);
}
