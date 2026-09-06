// app/api/partner/payouts/route.js — a partner's own payout ledger, read-only. Backed by the
// SAME `payouts` table admin's Payouts page writes to (app/api/admin/payouts) — real entries an
// admin recorded after actually settling with the partner some other way (bank transfer, UPI,
// cash), never invented or estimated here. There's nothing to estimate live either: Rewards &
// Earnings (lib/payout.js) already shows this period's running estimate — this is the settled
// history underneath it, so a partner can see what they were actually paid and when.
import { dbWhere } from '@/lib/db';
import { getPartner } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const partner = await getPartner();
  if (!partner) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const payouts = await dbWhere('payouts', 'partnerId', partner.id);
  payouts.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return Response.json(payouts);
}
