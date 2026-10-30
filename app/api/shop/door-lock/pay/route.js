// app/api/shop/door-lock/pay/route.js
// PUBLIC — the landing page calls this after a Razorpay Checkout attempt:
//   { action: 'verify', orderId, payToken, razorpay_order_id, razorpay_payment_id, razorpay_signature }
//       → checks the signature, asks Razorpay for the payment itself, and (once) marks the order paid +
//         auto-confirmed + sends the WhatsApp receipt.
//   { action: 'cod', orderId, payToken }
//       → the customer gave up on paying online: switch the order to Cash / UPI on delivery and send the
//         normal "order placed" message.
// `payToken` is a random secret handed out when the order was created, so knowing an order id alone is not enough.
import { after } from 'next/server';
import { dbGetById } from '@/lib/db';
import { verifyCheckoutSignature, fetchRazorpayOrderPayments } from '@/lib/razorpay';
import { applyOnlinePayment, convertToCod } from '@/lib/heseosPayments';
import { notifyHeseosPaymentReceived, notifyHeseosOrderPlaced } from '@/lib/heseosNotify';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const same = (a, b) => {
  const x = Buffer.from(String(a || '')); const y = Buffer.from(String(b || ''));
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
};

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }
  const order = await dbGetById('orders', String(body?.orderId || ''));
  if (!order || !order.payToken || !same(order.payToken, body?.payToken)) {
    return Response.json({ error: 'We couldn’t find this order.' }, { status: 404 });
  }

  if (body.action === 'cod') {
    const r = await convertToCod(order.id, 'Customer');
    if (!r.ok) return Response.json({ error: r.error }, { status: 400 });
    after(async () => { await notifyHeseosOrderPlaced(r.order).catch((e) => console.error('notifyHeseosOrderPlaced error:', e)); });
    return Response.json({ ok: true, paymentMethod: 'cod', total: r.order.subtotal });
  }

  if (body.action === 'verify') {
    const rzOrderId = String(body.razorpay_order_id || '');
    const rzPaymentId = String(body.razorpay_payment_id || '');
    if (rzOrderId !== order.razorpay?.orderId) return Response.json({ error: 'Payment does not belong to this order.' }, { status: 400 });
    if (!verifyCheckoutSignature({ orderId: rzOrderId, paymentId: rzPaymentId, signature: body.razorpay_signature })) {
      return Response.json({ error: 'We couldn’t verify this payment. If money was deducted it will be matched automatically — our team will contact you.' }, { status: 400 });
    }
    // Ask Razorpay for the payment itself rather than trusting the browser's word for the amount/status.
    const list = await fetchRazorpayOrderPayments(rzOrderId);
    const pay = list.ok ? (list.data?.items || []).find((x) => x.id === rzPaymentId) : null;
    if (!pay) return Response.json({ ok: true, paid: false, pending: true, message: 'Your payment is being confirmed — you will get a WhatsApp message shortly.' });
    const r = await applyOnlinePayment(order.id, pay, 'Razorpay (checkout)');
    if (!r.ok) {
      if (r.pending) return Response.json({ ok: true, paid: false, pending: true, message: 'Your payment is being confirmed — you will get a WhatsApp message shortly.' });
      console.error('door-lock pay verify error:', order.id, r.error);
      return Response.json({ error: 'We couldn’t confirm this payment automatically. Our team will check and contact you.' }, { status: 409 });
    }
    if (r.applied) after(async () => { await notifyHeseosPaymentReceived(r.order).catch((e) => console.error('notifyHeseosPaymentReceived error:', e)); });
    return Response.json({ ok: true, paid: true, paymentId: rzPaymentId, total: r.order.subtotal });
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 });
}
