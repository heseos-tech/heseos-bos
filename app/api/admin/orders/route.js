// Admin backend for WhatsApp Shopping orders (lib/heseosShoppingFlow.js/lib/heseosOrders.js).
// GET   — every order, newest first, for the Admin -> Orders tab. Any logged-in employee can
//         read/manage orders (same access level as Leads/Growth) — this is an operational
//         fulfillment queue, not a sensitive admin-only setting.
// PATCH — advance status, cancel, or mark paid — see [id]/route.js.
import { dbList } from '@/lib/db';
import { getEmployee } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const employee = await getEmployee();
  if (!employee) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const orders = await dbList('orders');
  orders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return Response.json(orders);
}
