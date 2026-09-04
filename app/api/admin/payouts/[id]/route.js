// app/api/admin/payouts/[id]/route.js — edit or remove one payout ledger entry. Admin-only,
// same trust boundary as app/api/admin/payouts/route.js. PATCH is how a pending entry gets
// settled: an admin fills in the method/reference once they've actually paid the partner some
// other way, then flips status to 'paid' — this endpoint never touches money itself.
import { dbGetById, dbPatch, dbDelete } from '@/lib/db';
import { getEmployee } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const STATUSES = new Set(['pending', 'processing', 'paid']);

async function requireAdmin() {
  const employee = await getEmployee();
  if (!employee || employee.role !== 'admin') return null;
  return employee;
}

export async function PATCH(request, { params }) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const existing = await dbGetById('payouts', id);
  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const patch = { updatedAt: new Date().toISOString() };

  if (body.amount !== undefined) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) return Response.json({ error: 'A positive amount is required' }, { status: 400 });
    patch.amount = amount;
  }
  if (body.method !== undefined) patch.method = body.method || '';
  if (body.reference !== undefined) patch.reference = body.reference || '';
  if (body.note !== undefined) patch.note = body.note || '';
  if (body.status !== undefined) {
    if (!STATUSES.has(body.status)) return Response.json({ error: `status must be one of ${[...STATUSES].join(', ')}` }, { status: 400 });
    patch.status = body.status;
    patch.paidAt = body.status === 'paid' ? new Date().toISOString() : null;
  }

  const updated = await dbPatch('payouts', id, patch);
  return Response.json(updated);
}

export async function DELETE(request, { params }) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const existing = await dbGetById('payouts', id);
  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 });
  // A paid entry is the audit trail that a partner was actually settled — never let it be
  // deleted, only a pending/processing one entered by mistake.
  if (existing.status === 'paid') return Response.json({ error: 'Cannot delete a paid payout' }, { status: 400 });
  const ok = await dbDelete('payouts', id);
  if (!ok) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ success: true });
}
