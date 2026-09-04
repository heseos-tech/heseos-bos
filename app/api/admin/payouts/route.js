// app/api/admin/payouts/route.js — partner payout/settlement LEDGER (Admin -> Payouts). This is
// bookkeeping only: a record of what was agreed and, once settled outside this system (bank
// transfer, UPI, cash — whatever the business actually used), a place to note the reference and
// mark it paid. Nothing here ever moves money — there is no payment gateway integration and
// none should be added; "processed" means an admin ticked a box after paying the partner some
// other way, exactly like Admin -> Conversions' invoice tracking never charges anyone.
//
// Distinct from lib/payout.js's payoutFor(), which only ever computes a live ESTIMATE from
// tiered config + converted leads — this table is where that estimate becomes an actual,
// admin-recorded ledger entry once someone decides to settle it.
import { dbInsert, dbList } from '@/lib/db';
import { getEmployee } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const employee = await getEmployee();
  if (!employee || employee.role !== 'admin') return null;
  return employee;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const payouts = await dbList('payouts');
  return Response.json(payouts);
}

export async function POST(request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  if (!body.partnerId) return Response.json({ error: 'partnerId is required' }, { status: 400 });
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return Response.json({ error: 'A positive amount is required' }, { status: 400 });

  const id = `PAY${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const payout = {
    id,
    partnerId: body.partnerId,
    periodLabel: body.periodLabel || '',
    amount,
    status: 'pending',
    method: body.method || '',
    reference: '',
    note: body.note || '',
    createdBy: admin.id,
    createdAt: now,
    updatedAt: now,
    paidAt: null,
  };
  await dbInsert('payouts', id, payout);
  return Response.json(payout);
}
