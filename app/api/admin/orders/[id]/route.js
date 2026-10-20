// Admin -> Orders: advance status / cancel / mark paid for one order. Same access level as the
// list route (any logged-in employee) — see that file's own header comment for why.
import { dbGetById } from '@/lib/db';
import { getEmployee } from '@/lib/auth';
import { dbPatch } from '@/lib/db';
import { advanceOrderStatus, markOrderPaid, setInstallationSchedule, cleanInstallFee, ORDER_STATUSES } from '@/lib/heseosOrders';
import { releaseJob, ensureInstallPayout } from '@/lib/installJobs';
import { notifyHeseosOrderStatus, notifyHeseosInstallationScheduled } from '@/lib/heseosNotify';

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

  // Operations: record the installation date agreed with the customer on the phone (and, optionally,
  // a time window) plus the fee the installation partner earns for the job. The customer is told
  // on WhatsApp whenever the date/window actually changes; a fee-only edit never texts them.
  // `releaseInstaller: true` takes the job back from the partner who claimed it.
  if (body.installation !== undefined) {
    if (existing.status === 'cancelled' || existing.status === 'placed') {
      return Response.json({ error: 'Installation can only be scheduled for a confirmed order' }, { status: 400 });
    }
    if (existing.status === 'installed') {
      return Response.json({ error: 'This installation is already complete' }, { status: 400 });
    }
    const inst = body.installation || {};
    if (inst.releaseInstaller) {
      const rel = await releaseJob(null, 'order', id, { byOps: true, actor: actorLabel });
      if (!rel.ok) return Response.json({ error: rel.error }, { status: rel.status });
      return Response.json({ ...(await dbGetById('orders', id)), whatsappSent: false });
    }
    const wanted = String(inst.date || '');
    if (wanted && !/^\d{4}-\d{2}-\d{2}$/.test(wanted)) {
      return Response.json({ error: 'Pick a valid installation date' }, { status: 400 });
    }
    if (inst.fee !== undefined && Number.isNaN(cleanInstallFee(inst.fee))) {
      return Response.json({ error: 'Enter a valid installation fee (₹0 – ₹10,00,000)' }, { status: 400 });
    }
    const r = await setInstallationSchedule(id, inst, actorLabel);
    let whatsappSent = false;
    // A date the CUSTOMER picked on the "Book installation" page (lib/installBooking.js) is only a
    // request until Operations save it here — that save confirms it to the customer once, even if
    // they keep the customer's date/window as is (so nothing "changed").
    const o = r.order;
    const confirmsCustomerBooking = !!(o?.installDate && o.installRequestSource === 'customer' && !o.installConfirmedAt);
    let order = o;
    if (o?.installDate && (r.changed || confirmsCustomerBooking)) whatsappSent = !!(await notifyHeseosInstallationScheduled(o))?.ok;
    if (confirmsCustomerBooking) {
      const now = new Date().toISOString();
      order = await dbPatch('orders', id, {
        installConfirmedAt: now,
        history: [...(o.history || []), { status: 'Installation confirmed to the customer', at: now, by: actorLabel }],
        updatedAt: now,
      });
    }
    return Response.json({ ...order, whatsappSent });
  }

  // Internal notes (e.g. "customer asked to call after 6 pm") — shown to the team, never the customer.
  if (typeof body.notes === 'string') {
    const updated = await dbPatch('orders', id, { notes: body.notes.slice(0, 1000), updatedAt: new Date().toISOString() });
    return Response.json(updated);
  }

  if (body.markPaid === true) {
    const updated = await markOrderPaid(id, actorLabel);
    return Response.json(updated);
  }

  if (body.status !== undefined) {
    if (!VALID_STATUSES.has(body.status)) {
      return Response.json({ error: `Unknown status "${body.status}"` }, { status: 400 });
    }
    const updated = await advanceOrderStatus(id, body.status, actorLabel);
    // Tell the customer on WhatsApp — only when the status actually changed (a double-click or a
    // retry never texts them twice) and only for the steps that have a message
    // (Packed / Dispatched / Delivered / Installation Done / Cancelled). Best-effort: a failed send never
    // undoes the status change; the admin just sees "WhatsApp message could not be sent".
    // Operations moving an order to Installation Done while an installer holds the job: they get paid.
    if (updated && body.status === 'installed' && existing.status !== 'installed' && updated.installPartnerId) await ensureInstallPayout('order', id);
    let whatsappSent = false;
    if (updated && existing.status !== body.status) {
      const wa = await notifyHeseosOrderStatus(updated, body.status);
      whatsappSent = !!wa?.ok;
    }
    return Response.json({ ...updated, whatsappSent });
  }

  return Response.json({ error: 'Nothing to update — send status or markPaid' }, { status: 400 });
}
