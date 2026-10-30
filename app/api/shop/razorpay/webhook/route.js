// app/api/shop/razorpay/webhook/route.js
// Razorpay -> HESEOS. In Razorpay Dashboard -> Settings -> Webhooks add
//   https://<live address>/api/shop/razorpay/webhook
// with the secret you also put in RAZORPAY_WEBHOOK_SECRET, and tick: payment.captured, order.paid,
// payment.failed, refund.processed, refund.failed.
//
// This is the safety net behind the browser callback (app/api/shop/door-lock/pay): a customer who pays and
// then closes the tab, or whose network drops, is still matched to their order here. Both paths end in the same
// atomic write (lib/heseosPayments.js applyOnlinePayment), so nothing is ever applied or messaged twice.
// Once the signature checks out this route always answers 200 — Razorpay retries (and eventually disables a
// webhook) on non-2xx.
import { after } from 'next/server';
import { verifyWebhookSignature, razorpayConfig } from '@/lib/razorpay';
import { findOrderByRazorpayOrderId, applyOnlinePayment, recordPaymentFailure, applyRefundEvent } from '@/lib/heseosPayments';
import { notifyHeseosPaymentReceived } from '@/lib/heseosNotify';
import { dbList } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (!razorpayConfig().webhookSecret) return Response.json({ error: 'Webhook is not configured' }, { status: 503 });
  const raw = await request.text();
  if (!verifyWebhookSignature(raw, request.headers.get('x-razorpay-signature'))) {
    console.error('Razorpay webhook: 401 — signature does not match RAZORPAY_WEBHOOK_SECRET');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const evt = JSON.parse(raw);
    const event = String(evt?.event || '');
    const payment = evt?.payload?.payment?.entity;
    const refund = evt?.payload?.refund?.entity;

    if ((event === 'payment.captured' || event === 'order.paid' || event === 'payment.authorized') && payment) {
      const order = await findOrderByRazorpayOrderId(payment.order_id);
      if (!order) { console.error('Razorpay webhook: no order for', payment.order_id); return Response.json({ received: true, ignored: 'unknown order' }); }
      const r = await applyOnlinePayment(order.id, payment, 'Razorpay (webhook)');
      if (!r.ok && !r.pending) console.error('Razorpay webhook apply error:', order.id, r.error);
      if (r.applied) after(async () => { await notifyHeseosPaymentReceived(r.order).catch((e) => console.error('notifyHeseosPaymentReceived error:', e)); });
    } else if (event === 'payment.failed' && payment) {
      const order = await findOrderByRazorpayOrderId(payment.order_id);
      if (order) await recordPaymentFailure(order.id, payment);
    } else if ((event === 'refund.processed' || event === 'refund.failed') && refund) {
      const orders = await dbList('orders');
      const order = orders.find((o) => o?.razorpayPaymentId && o.razorpayPaymentId === refund.payment_id);
      if (order) await applyRefundEvent(order.id, refund, event);
    }
  } catch (err) {
    console.error('Razorpay webhook error:', err);
  }
  return Response.json({ received: true });
}
