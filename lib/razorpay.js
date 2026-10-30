// Razorpay (razorpay.com) — thin server-side client, no SDK (plain fetch + Node crypto).
//
// Env (set on Vercel):
//   RAZORPAY_KEY_ID          rzp_live_… (or rzp_test_… while testing) — also handed to the browser for Checkout
//   RAZORPAY_KEY_SECRET      the matching secret — server only, never sent to the browser
//   RAZORPAY_WEBHOOK_SECRET  the secret you type when adding the webhook in Razorpay -> Settings -> Webhooks
//                            (URL: https://<live address>/api/shop/razorpay/webhook,
//                             events: payment.captured, order.paid, payment.failed, refund.processed, refund.failed)
//
// Leave RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET blank and online payment stays OFF: the landing page simply
// doesn't show the "Pay online" option and every order is Cash / UPI on delivery, exactly as before.
import crypto from 'crypto';

const API = 'https://api.razorpay.com/v1';

export function razorpayConfig() {
  return {
    keyId: (process.env.RAZORPAY_KEY_ID || '').trim(),
    keySecret: (process.env.RAZORPAY_KEY_SECRET || '').trim(),
    webhookSecret: (process.env.RAZORPAY_WEBHOOK_SECRET || '').trim(),
  };
}
export function razorpayConfigured() {
  const c = razorpayConfig();
  return !!(c.keyId && c.keySecret);
}

const toPaise = (rupees) => Math.round((Number(rupees) + Number.EPSILON) * 100);
export { toPaise };

async function rzp(path, { method = 'GET', body } = {}) {
  const c = razorpayConfig();
  if (!c.keyId || !c.keySecret) return { ok: false, status: 503, error: 'Online payment is not configured' };
  try {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${c.keyId}:${c.keySecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, status: res.status, error: json?.error?.description || `Razorpay error ${res.status}`, raw: json };
    return { ok: true, data: json };
  } catch (err) {
    return { ok: false, status: 502, error: String(err?.message || err) };
  }
}

// A Razorpay "order" is the payable amount Checkout opens against. Amount is in paise.
export async function createRazorpayOrder({ amountRupees, receipt, notes = {} }) {
  const amount = toPaise(amountRupees);
  if (!(amount >= 100)) return { ok: false, error: 'Amount is too small for online payment' };
  return rzp('/orders', { method: 'POST', body: { amount, currency: 'INR', receipt: String(receipt).slice(0, 40), notes } });
}
export const fetchRazorpayPayment = (paymentId) => rzp(`/payments/${encodeURIComponent(paymentId)}`);
export const fetchRazorpayOrderPayments = (rzpOrderId) => rzp(`/orders/${encodeURIComponent(rzpOrderId)}/payments`);
// Only needed when the Razorpay account is NOT set to auto-capture (a payment then stays "authorized").
export const captureRazorpayPayment = (paymentId, amountPaise) =>
  rzp(`/payments/${encodeURIComponent(paymentId)}/capture`, { method: 'POST', body: { amount: amountPaise, currency: 'INR' } });
export const refundRazorpayPayment = (paymentId, amountPaise, notes = {}) =>
  rzp(`/payments/${encodeURIComponent(paymentId)}/refund`, { method: 'POST', body: { amount: amountPaise, speed: 'normal', notes } });

function safeEqualHex(a, b) {
  try {
    const x = Buffer.from(String(a || ''), 'utf8');
    const y = Buffer.from(String(b || ''), 'utf8');
    return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
  } catch { return false; }
}

// Checkout success callback: signature = HMAC_SHA256(razorpay_order_id + "|" + razorpay_payment_id, key_secret).
export function verifyCheckoutSignature({ orderId, paymentId, signature }) {
  const { keySecret } = razorpayConfig();
  if (!keySecret || !orderId || !paymentId || !signature) return false;
  const expected = crypto.createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
  return safeEqualHex(expected, signature);
}

// Webhook: X-Razorpay-Signature = HMAC_SHA256(raw request body, webhook secret).
export function verifyWebhookSignature(rawBody, signature) {
  const { webhookSecret } = razorpayConfig();
  if (!webhookSecret || !signature) return false;
  const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  return safeEqualHex(expected, signature);
}
