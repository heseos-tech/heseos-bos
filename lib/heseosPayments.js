// Online payment (Razorpay) for door-lock orders — the state machine behind the "Pay online" option on the
// landing page. COD orders never touch this file (lib/heseosOrders.js still creates them with
// paymentMethod 'cod' / paymentStatus 'pending').
//
// paymentStatus values:
//   'pending'   COD, not collected yet (the original value)
//   'awaiting'  online order created, customer has not paid yet (hidden from fulfilment: can't be confirmed/packed)
//   'paid'      money received (online capture, or COD marked collected)
//   'refunded'  online payment refunded in full
//
// An online order is only ever marked paid after we have asked Razorpay for the payment ourselves
// (webhook body / browser callback are just "something happened" signals) and checked: same Razorpay order,
// same amount as the order total, status captured. The write that records it is atomic (dbClaim on
// razorpayPaymentId), so the browser callback and the webhook racing each other can never apply it twice or
// send two receipts.
import { dbGetById, dbList, dbPatch, dbClaim } from '@/lib/db';
import {
  fetchRazorpayOrderPayments, captureRazorpayPayment, refundRazorpayPayment, toPaise,
} from '@/lib/razorpay';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fail = (error, extra = {}) => ({ ok: false, error, ...extra });

export const isAwaitingOnline = (o) => o?.paymentMethod === 'online' && o?.paymentStatus === 'awaiting';

export async function findOrderByRazorpayOrderId(rzpOrderId) {
  if (!rzpOrderId) return null;
  const orders = await dbList('orders');
  return orders.find((o) => o?.razorpay?.orderId === rzpOrderId) || null;
}

// payment = a Razorpay payment entity (from the API, or the webhook's payload.payment.entity).
export async function applyOnlinePayment(orderId, payment, by = 'Razorpay') {
  const order = await dbGetById('orders', orderId);
  if (!order) return fail('Order not found');
  const rz = order.razorpay;
  if (!rz?.orderId) return fail('This is not an online-payment order');
  if (!payment?.id || payment.order_id !== rz.orderId) return fail('Payment does not belong to this order');

  const now = new Date().toISOString();
  if (Number(payment.amount) !== Number(rz.amountPaise) || (payment.currency || 'INR') !== 'INR') {
    await dbPatch('orders', orderId, {
      history: [...(order.history || []), { status: `Online payment ${payment.id} of ${inr(Number(payment.amount) / 100)} did NOT match the order total ${inr(Number(rz.amountPaise) / 100)} — not applied, review in Razorpay`, at: now, by }],
      updatedAt: now,
    });
    return fail('Payment amount does not match the order total');
  }

  let p = payment;
  if (p.status === 'authorized') {
    const cap = await captureRazorpayPayment(p.id, Number(rz.amountPaise));
    if (!cap.ok) return fail(`Could not capture the payment: ${cap.error}`);
    p = cap.data;
  }
  if (p.status !== 'captured') return fail(`Payment is ${p.status || 'not completed'}`, { pending: true });

  if (order.razorpayPaymentId === p.id) return { ok: true, applied: false, order };

  const alreadyPaidByHand = order.paymentStatus === 'paid' && !order.razorpayPaymentId;
  const cancelled = order.status === 'cancelled';
  const how = [p.method, p.method === 'upi' ? p.vpa : p.method === 'card' ? (p.card?.network ? `${p.card.network} ••${p.card.last4 || ''}` : '') : p.bank || p.wallet].filter(Boolean).join(' · ');
  const history = [
    ...(order.history || []),
    { status: `Online payment received ${inr(Number(p.amount) / 100)} — ${p.id}${how ? ` (${how})` : ''}`, at: now, by },
  ];
  if (cancelled) history.push({ status: 'Payment arrived after the order was cancelled — refund it from the order', at: now, by: 'System' });
  if (alreadyPaidByHand) history.push({ status: 'Order had already been marked paid by hand — this online payment is a duplicate, refund one of them', at: now, by: 'System' });
  const confirms = order.status === 'placed';
  if (confirms) history.push({ status: 'confirmed', at: now, by: 'Auto (online payment)' });

  const claim = await dbClaim('orders', orderId, 'razorpayPaymentId', {
    paymentStatus: 'paid',
    paymentMethod: 'online',
    paidAt: now,
    razorpayPaymentId: p.id,
    paymentDetail: how || null,
    ...(confirms ? { status: 'confirmed' } : {}),
    razorpay: { ...rz, paymentId: p.id },
    history,
    updatedAt: now,
  });
  if (!claim.ok) return { ok: true, applied: false, order: claim.data || order }; // the other path got there first
  return { ok: true, applied: true, order: claim.data, confirmed: confirms };
}

// "Check payment": ask Razorpay what happened on this order's Razorpay order — the fallback for a missed
// webhook / a customer who paid and closed the tab.
export async function syncOnlinePayment(orderId, by = 'Razorpay') {
  const order = await dbGetById('orders', orderId);
  if (!order) return fail('Order not found');
  if (!order.razorpay?.orderId) return fail('This is not an online-payment order');
  if (order.paymentStatus === 'paid' || order.paymentStatus === 'refunded') return { ok: true, applied: false, order };
  const list = await fetchRazorpayOrderPayments(order.razorpay.orderId);
  if (!list.ok) return fail(list.error);
  const items = list.data?.items || [];
  const good = items.find((x) => x.status === 'captured') || items.find((x) => x.status === 'authorized');
  if (!good) {
    const last = items[items.length - 1];
    return fail(last ? `Latest attempt: ${last.status}${last.error_description ? ` — ${last.error_description}` : ''}` : 'No payment has been made on this order yet', { pending: true });
  }
  return applyOnlinePayment(orderId, good, by);
}

export async function recordPaymentFailure(orderId, payment) {
  const order = await dbGetById('orders', orderId);
  if (!order || order.paymentStatus === 'paid') return null;
  return dbPatch('orders', orderId, {
    lastPaymentFailure: { at: new Date().toISOString(), paymentId: payment?.id || null, reason: payment?.error_description || payment?.error_reason || 'Payment failed' },
  });
}

// Customer (or Ops) switches an unpaid online order to Cash / UPI on delivery.
export async function convertToCod(orderId, by) {
  const order = await dbGetById('orders', orderId);
  if (!order) return fail('Order not found');
  if (order.status === 'cancelled') return fail('This order is cancelled');
  if (!isAwaitingOnline(order)) return fail('This order is not waiting for an online payment');
  const now = new Date().toISOString();
  const updated = await dbPatch('orders', orderId, {
    paymentMethod: 'cod',
    paymentStatus: 'pending',
    razorpay: { ...order.razorpay, abandoned: true },
    history: [...(order.history || []), { status: 'Switched to Cash / UPI on delivery (online payment not made)', at: now, by: by || 'Customer' }],
    updatedAt: now,
  });
  return { ok: true, order: updated };
}

// Full refund of an online payment. Admin / Accounts only (the route checks the role). Non-admins may only
// refund a cancelled order.
export async function refundOnlineOrder(orderId, by, { admin = false } = {}) {
  const order = await dbGetById('orders', orderId);
  if (!order) return fail('Order not found');
  if (order.paymentMethod !== 'online' || !order.razorpayPaymentId) return fail('Only orders paid online can be refunded here');
  if (order.paymentStatus === 'refunded') return fail('This payment has already been refunded');
  if (order.paymentStatus !== 'paid') return fail('No online payment to refund');
  if (order.status !== 'cancelled' && !admin) return fail('Cancel the order first, then refund it');

  const now = new Date().toISOString();
  // One refund at a time — a double-click can't send two.
  const lock = await dbClaim('orders', orderId, 'refundRequestedAt', { refundRequestedAt: now });
  if (!lock.ok) return fail('A refund for this order is already in progress');

  const amountPaise = Number(order.razorpay?.amountPaise) || toPaise(order.subtotal);
  const r = await refundRazorpayPayment(order.razorpayPaymentId, amountPaise, { order: order.id, by: String(by || 'Admin').slice(0, 40) });
  if (!r.ok) {
    await dbPatch('orders', orderId, { refundRequestedAt: null });
    return fail(`Razorpay refused the refund: ${r.error}`);
  }
  const rf = r.data || {};
  const updated = await dbPatch('orders', orderId, {
    paymentStatus: 'refunded',
    refund: { id: rf.id, amount: amountPaise / 100, status: rf.status || 'pending', at: now, by: by || 'Admin' },
    history: [...(order.history || []), { status: `Refund of ${inr(amountPaise / 100)} initiated — ${rf.id} (by ${by || 'Admin'})`, at: now, by: by || 'Admin' }],
    updatedAt: now,
  });
  return { ok: true, order: updated };
}

// Razorpay refund.processed / refund.failed webhooks.
export async function applyRefundEvent(orderId, refund, event) {
  const order = await dbGetById('orders', orderId);
  if (!order) return null;
  const now = new Date().toISOString();
  if (event === 'refund.failed') {
    return dbPatch('orders', orderId, {
      paymentStatus: 'paid', refundRequestedAt: null,
      refund: { ...(order.refund || {}), status: 'failed' },
      history: [...(order.history || []), { status: `Refund ${refund?.id || ''} FAILED — retry from the order or from the Razorpay dashboard`, at: now, by: 'Razorpay' }],
      updatedAt: now,
    });
  }
  if (order.refund?.status === 'processed') return order;
  return dbPatch('orders', orderId, {
    refund: { ...(order.refund || {}), id: refund?.id || order.refund?.id, status: 'processed', processedAt: now },
    history: [...(order.history || []), { status: 'Refund processed by Razorpay — the money is on its way to the customer', at: now, by: 'Razorpay' }],
    updatedAt: now,
  });
}
