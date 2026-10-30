// Admin -> Orders: advance status / cancel / mark paid for one order. Same access level as the
// list route (any logged-in employee) — see that file's own header comment for why.
import { dbGetById } from '@/lib/db';
import { getEmployee } from '@/lib/auth';
import { dbPatch } from '@/lib/db';
import { after } from 'next/server';
import { syncOnlinePayment, convertToCod, refundOnlineOrder, isAwaitingOnline } from '@/lib/heseosPayments';
import { advanceOrderStatus, editOrder, markOrderPaid, setInstallationSchedule, cleanInstallFee, ORDER_STATUSES } from '@/lib/heseosOrders';
import { releaseJob, ensureInstallPayout } from '@/lib/installJobs';
import { notifyHeseosOrderStatus, notifyHeseosInstallationScheduled, notifyHeseosPaymentReceived, notifyHeseosRefundInitiated, notifyHeseosOrderPlaced } from '@/lib/heseosNotify';
import { velocityConfigured, velocityConfig, createShipmentForOrder, resendShipmentForOrder, cancelShipmentForOrder, syncShipmentTracking } from '@/lib/velocityShipping';

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

  // Accounts can read orders and mark them paid — nothing else (no status changes, scheduling or notes).
  if (employee.role === 'accounts' && body.markPaid !== true && body.refund !== true && body.payment !== 'check') {
    return Response.json({ error: 'Accounts can only record payments and refunds' }, { status: 403 });
  }

  // Online (Razorpay) payments. 'check' re-asks Razorpay what happened on this order (the fallback for a missed
  // webhook / a customer who paid and closed the page); 'cod' switches an unpaid online order to Cash / UPI on delivery.
  if (body.payment !== undefined) {
    const act = String(body.payment);
    if (act === 'check') {
      if (!['operations', 'admin', 'accounts'].includes(employee.role)) return Response.json({ error: 'Not allowed' }, { status: 403 });
      const r = await syncOnlinePayment(id, `${actorLabel} (check)`);
      if (r.applied) after(async () => { await notifyHeseosPaymentReceived(r.order).catch(() => {}); });
      if (!r.ok) return Response.json({ ...(await dbGetById('orders', id)), paymentNote: r.error });
      return Response.json({ ...r.order, ...(r.applied ? { paymentNote: 'Payment found — order marked paid and confirmed' } : {}) });
    }
    if (act === 'cod') {
      if (!['operations', 'admin'].includes(employee.role)) return Response.json({ error: 'Only Operations or Admin can switch an order to COD' }, { status: 403 });
      const r = await convertToCod(id, actorLabel);
      if (!r.ok) return Response.json({ error: r.error }, { status: 400 });
      after(async () => { await notifyHeseosOrderPlaced(r.order).catch(() => {}); });
      return Response.json(r.order);
    }
    return Response.json({ error: 'Unknown payment action' }, { status: 400 });
  }

  // Refund an online payment in full (Admin / Accounts). Non-admins can only refund a cancelled order.
  if (body.refund === true) {
    if (!['admin', 'accounts'].includes(employee.role)) return Response.json({ error: 'Only Admin or Accounts can refund a payment' }, { status: 403 });
    const r = await refundOnlineOrder(id, actorLabel, { admin: employee.role === 'admin' });
    if (!r.ok) return Response.json({ error: r.error }, { status: 400 });
    after(async () => { await notifyHeseosRefundInitiated(r.order).catch(() => {}); });
    return Response.json(r.order);
  }

  // Operations / Admin: correct the customer's details, address/pincode and the order lines (qty, price).
  if (body.edit !== undefined) {
    if (!['operations', 'admin'].includes(employee.role)) return Response.json({ error: 'Only Operations or Admin can edit an order' }, { status: 403 });
    const r = await editOrder(id, body.edit, actorLabel);
    if (!r.ok) return Response.json({ error: r.error }, { status: r.status || 400 });
    return Response.json({ ...r.order, ...(r.shippingStale ? { shippingStale: true } : {}), ...(r.invoiceIssued ? { invoiceIssued: true } : {}) });
  }

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

  // Velocity shipping: create / retry the courier shipment, refresh tracking, or cancel it.
  if (body.shipping) {
    const act = String(body.shipping);
    if (act === 'create') {
      if (existing.status === 'cancelled') return Response.json({ error: 'This order is cancelled' }, { status: 400 });
      const r = await createShipmentForOrder(id, actorLabel);
      if (!r.ok) return Response.json({ ...(r.order || existing), shippingError: r.error });
      return Response.json({ ...r.order, whatsappSent: !!r.whatsappSent });
    }
    if (act === 'resend') {
      const r = await resendShipmentForOrder(id, actorLabel);
      if (!r.ok) return Response.json({ ...(r.order || existing), shippingError: r.error });
      return Response.json(r.order);
    }
    if (act === 'sync') {
      const r = await syncShipmentTracking(id);
      if (!r.ok) return Response.json({ ...existing, shippingError: r.error });
      return Response.json(r.order);
    }
    if (act === 'cancel') {
      const r = await cancelShipmentForOrder(id, actorLabel);
      return Response.json({ ...(r.order || existing), ...(r.ok ? {} : { shippingError: r.error }) });
    }
    return Response.json({ error: 'Unknown shipping action' }, { status: 400 });
  }

  if (body.markPaid === true) {
    if (existing.status === 'cancelled') return Response.json({ error: 'A cancelled order cannot be marked paid' }, { status: 400 });
    if (existing.paymentStatus === 'paid') return Response.json(existing); // already paid — never record it twice
    if (existing.paymentStatus === 'refunded') return Response.json({ error: 'This payment was refunded' }, { status: 400 });
    if (isAwaitingOnline(existing)) return Response.json({ error: 'The customer is paying online — use "Check payment" to pull it in, or switch the order to COD first' }, { status: 400 });
    const mode = ['cash', 'upi'].includes(body.mode) ? body.mode : undefined;
    const updated = await markOrderPaid(id, actorLabel, mode);
    return Response.json(updated);
  }

  if (body.status !== undefined) {
    if (!VALID_STATUSES.has(body.status)) {
      return Response.json({ error: `Unknown status "${body.status}"` }, { status: 400 });
    }
    if (isAwaitingOnline(existing) && body.status !== 'cancelled') {
      return Response.json({ error: 'This order is waiting for the customer\u2019s online payment — it can be confirmed once the payment arrives (use "Check payment"), or switch it to COD first' }, { status: 400 });
    }
    let updated = await advanceOrderStatus(id, body.status, actorLabel);
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
    // Velocity: Packed -> send the order to the courier automatically; Cancelled -> cancel the shipment
    // (only possible before pickup). Best-effort — the order's own status change never fails because of
    // Velocity; the Shipping section on the order shows the error and a Retry button.
    let shippingError = null;
    if (updated && existing.status !== body.status && velocityConfigured()) {
      if (body.status === 'packed' && velocityConfig().autoShip) {
        const r = await createShipmentForOrder(id, actorLabel).catch((e) => ({ ok: false, error: String(e?.message || e) }));
        if (r.order) updated = r.order;
        if (!r.ok) shippingError = r.error;
      } else if (body.status === 'cancelled') {
        const r = await cancelShipmentForOrder(id, actorLabel).catch((e) => ({ ok: false, error: String(e?.message || e) }));
        if (r.order) updated = r.order;
        if (!r.ok) shippingError = r.error;
      }
    }
    return Response.json({ ...updated, whatsappSent, ...(shippingError ? { shippingError } : {}) });
  }

  return Response.json({ error: 'Nothing to update — send status or markPaid' }, { status: 400 });
}
