// Approve or reject one Bot Console signup. Approving is the moment a pending tenant actually
// becomes usable: it flips approvalStatus so the login route (app/api/auth/bot/route.js) will
// issue a session, and — only the first time, guarded by `seeded` — seeds the same demo Inbox
// (lib/botMock.js) self-service signups used to get instantly, so an approved tenant still
// lands on a populated console rather than an empty one.
import { getEmployee } from '@/lib/auth';
import { dbGetById, dbPatch, dbInsert } from '@/lib/db';
import { seedTenantData } from '@/lib/botMock';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const employee = await getEmployee();
  if (!employee || employee.role !== 'admin') return null;
  return employee;
}

export async function PATCH(request, { params }) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const tenant = await dbGetById('bot_tenants', id);
  if (!tenant) return Response.json({ error: 'Not found' }, { status: 404 });

  const { action } = await request.json().catch(() => ({}));
  if (!['approve', 'reject'].includes(action)) return Response.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });

  if (action === 'reject') {
    const updated = await dbPatch('bot_tenants', id, { approvalStatus: 'rejected' });
    const { password, waAccessToken, ...safe } = updated;
    return Response.json(safe);
  }

  const patch = { approvalStatus: 'approved' };
  let updated = await dbPatch('bot_tenants', id, patch);

  if (!tenant.seeded) {
    const { chats, messages } = seedTenantData(updated);
    await Promise.all([
      ...chats.map((c) => dbInsert('bot_chats', c.id, c)),
      ...messages.map((m) => dbInsert('bot_messages', m.id, m)),
    ]);
    updated = await dbPatch('bot_tenants', id, { seeded: true });
  }

  const { password, waAccessToken, ...safe } = updated;
  return Response.json(safe);
}
