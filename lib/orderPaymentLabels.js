// Small, client-safe helpers for showing an order's payment state on the Admin / Operations / Accounts / Team
// screens (kept free of server imports so 'use client' components can use it). See lib/heseosPayments.js for
// what the paymentStatus values mean.
export const isOnline = (o) => o?.paymentMethod === 'online';
export const isAwaitingOnline = (o) => o?.paymentMethod === 'online' && o?.paymentStatus === 'awaiting';

// { label, tone } — tone 'active' (green), 'pending' (amber) or 'off' (grey) matches the existing adm-status-pill classes.
export function paymentPill(o) {
  if (o?.paymentStatus === 'paid') return { label: isOnline(o) ? 'Paid online' : 'Paid', tone: 'active' };
  if (o?.paymentStatus === 'refunded') return { label: 'Refunded', tone: 'off' };
  if (isAwaitingOnline(o)) return { label: 'Awaiting online', tone: 'pending' };
  return { label: o?.paymentMethod === 'cod' || !o?.paymentMethod ? 'COD · Pending' : 'Pending', tone: 'pending' };
}

const dt = (v) => (v ? new Date(v).toLocaleDateString('en-IN') : '');
// One-line description for the order's detail view.
export function paymentLine(o) {
  const s = o?.paymentStatus;
  if (s === 'paid') {
    const how = o.paymentDetail ? ` · ${o.paymentDetail}` : '';
    return isOnline(o)
      ? `Paid online${o.paidAt ? ` (${dt(o.paidAt)})` : ''}${how}${o.razorpayPaymentId ? ` · ${o.razorpayPaymentId}` : ''}`
      : `Paid${o.paidAt ? ` (${dt(o.paidAt)})` : ''}${how}`;
  }
  if (s === 'refunded') return `Refunded${o.refund?.at ? ` (${dt(o.refund.at)})` : ''}${o.refund?.status ? ` · ${o.refund.status}` : ''}${o.refund?.id ? ` · ${o.refund.id}` : ''}`;
  if (isAwaitingOnline(o)) return `Waiting for online payment${o.lastPaymentFailure ? ` — last attempt failed: ${o.lastPaymentFailure.reason}` : ''}`;
  return 'Pending (Cash/UPI on delivery)';
}

// Which payment actions apply to this order.
export function paymentActions(o) {
  const cancelled = o?.status === 'cancelled';
  return {
    // COD: the team records the cash/UPI collected. Never for an order still waiting on Razorpay.
    canMarkPaid: o?.paymentStatus !== 'paid' && o?.paymentStatus !== 'refunded' && !isAwaitingOnline(o) && !cancelled,
    canCheckPayment: isAwaitingOnline(o) && !cancelled,
    canConvertToCod: isAwaitingOnline(o) && !cancelled,
    canRefund: isOnline(o) && o?.paymentStatus === 'paid' && !!o?.razorpayPaymentId,
    markPaidLabel: o?.paymentMethod === 'cod' || !o?.paymentMethod ? 'Mark COD Collected' : 'Mark Paid',
  };
}
