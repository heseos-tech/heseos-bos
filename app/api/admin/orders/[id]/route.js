// Admin -> Orders: advance status / cancel / mark paid for one order. Same access level as the
// list route (any logged-in employee) — see that file's own header comment for why.
import { dbGetById } from '@/lib/db';
import { getEmployee } from '@/lib/auth';
import { advanceOrderStatus, markOrderPaid, ORDER_STATUSES } from '@/lib/heseosOrders';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = new Set(ORDER_STATUSES.map((s) => s.key));

export async function GET(request, { params }) {
  const employee = await getEmployee();
  if (!employee) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const order = await dbGetById('orders', id);
  if (!order) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json(order);
}

export async function PATCH(request, { params }) {
  const employee = await getEmployee();
  if (!employee) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const existing = await dbGetById('orders', id);
  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const actorLabel = employee.name || 'Admin';

  if (body.markPaid === true) {
    const updated = await markOrderPaid(id, actorLabel);
    return Response.json(updated);
  }

  if (body.status !== undefined) {
    if (!VALID_STATUSES.has(body.status)) {
      return Response.json({ error: `Unknown status "${body.status}"` }, { status: 400 });
    }
    const updated = await advanceOrderStatus(id, body.status, actorLabel);
    return Response.json(updated);
  }

  return Response.json({ error: 'Nothing to update — send status or markPaid' }, { status: 400 });
}
