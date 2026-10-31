// app/api/shop/door-lock/route.js
// PUBLIC (no login) — the HESEOS Smart Door Lock landing page (/lock, public/door-lock/index.html)
// talks to this. GET returns the price the page should display; POST places an order.
//
// An order placed here: re-priced server-side from lib/heseosDoorLock.js (the browser's idea of the
// price is never trusted), written to the `orders` table (shows up in Admin -> Orders exactly like a
// WhatsApp-cart order), and the customer is sent an "order placed" confirmation on WhatsApp from
// HESEOS Buddy's own number. Payment: the customer picks Cash / UPI on delivery (default) or, when
// Razorpay is configured, pays online — an online order is created as 'awaiting' payment, gets NO WhatsApp
// message yet, and is confirmed (+ receipt sent) by app/api/shop/door-lock/pay or the Razorpay webhook
// (lib/heseosPayments.js).
//
// Abuse guards, since this is open to the internet AND triggers an outbound WhatsApp message to
// whatever number is typed in: a hidden honeypot field, a per-phone cap (3 orders / hour), and
// `clientRef` de-duplication so a double-tap or a browser retry never creates two orders.
import crypto from 'crypto';
import { dbList, dbDelete, dbPatch } from '@/lib/db';
import { razorpayConfigured, razorpayConfig, createRazorpayOrder } from '@/lib/razorpay';
import { DOOR_LOCK, indianMobile } from '@/lib/heseosDoorLock';
import { createHeseosLandingOrder } from '@/lib/heseosOrders';
import { checkServiceArea, recordUnserviceable, NOT_SERVICEABLE_MESSAGE } from '@/lib/serviceArea';
import { getClientIp } from '@/lib/rateLimit';
import { geoFromHeaders } from '@/lib/userAgent';
import { notifyHeseosOrderPlaced } from '@/lib/heseosNotify';

export const dynamic = 'force-dynamic';

const HOUR_MS = 60 * 60 * 1000;
const clean = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);

// What the browser needs to open Razorpay Checkout (the key id is public by design; the secret never leaves the server).
function checkoutFor(order) {
  return {
    key: razorpayConfig().keyId,
    orderId: order.razorpay.orderId,
    amount: order.razorpay.amountPaise,
    currency: 'INR',
    name: 'HESEOS',
    description: `${order.items?.[0]?.name || 'HESEOS Smart Door Lock'} × ${order.items?.[0]?.qty || 1}`,
    prefill: { name: order.customerName, contact: `+${order.phone}` },
  };
}

export async function GET() {
  return Response.json({ name: DOOR_LOCK.name, mrp: DOOR_LOCK.mrp, price: DOOR_LOCK.price, maxQty: DOOR_LOCK.maxQty, onlinePayment: razorpayConfigured(), onlineDiscount: razorpayConfigured() ? (DOOR_LOCK.onlineDiscount || 0) : 0 });
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }

  // Honeypot — a real visitor never sees or fills this field. Pretend success so a bot learns nothing.
  if (body?.website) return Response.json({ ok: true, orderId: 'ORD00000000' });

  const name = clean(body?.name, 80);
  const mobile = indianMobile(body?.phone);
  const address = clean(body?.address, 300);
  const pincode = String(body?.pincode || '').replace(/\D/g, '');
  const quantity = Math.floor(Number(body?.quantity));
  const clientRef = clean(body?.clientRef, 64) || null;
  const wantsOnline = body?.paymentMethod === 'online';
  if (wantsOnline && !razorpayConfigured()) {
    return Response.json({ error: 'Online payment isn\u2019t available right now. Please choose Cash / UPI on delivery.' }, { status: 400 });
  }

  if (name.length < 2) return Response.json({ error: 'Please enter your full name.' }, { status: 400 });
  if (!mobile) return Response.json({ error: 'Please enter a valid 10-digit mobile number.' }, { status: 400 });
  if (address.length < 8) return Response.json({ error: 'Please enter your full delivery address.' }, { status: 400 });
  if (!/^\d{6}$/.test(pincode)) return Response.json({ error: 'Please enter a valid 6-digit pincode.' }, { status: 400 });
  // City and state are never taken from the form — they come from the pincode, so the courier hand-off
  // always has a real city and state (the page shows them read-only).
  const area = await checkServiceArea(pincode);
  const { city, state } = area;
  // Pune only (lib/serviceArea.js): anywhere else is not an order — keep the name / number / pincode so we can get back to them.
  if (area.known && !area.serviceable) {
    await recordUnserviceable({ pincode, city, state, name, phone: mobile, sid: clean(body?.sid, 40), ip: getClientIp(request), geo: geoFromHeaders(request.headers), source: 'order_attempt' });
    return Response.json({ error: NOT_SERVICEABLE_MESSAGE, nonServiceable: true, city }, { status: 422 });
  }
  if (!city || !state) return Response.json({ error: 'We couldn\u2019t verify this pincode right now. Please check it and try again.' }, { status: 400 });
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > DOOR_LOCK.maxQty) {
    return Response.json({ error: `Quantity must be between 1 and ${DOOR_LOCK.maxQty}.` }, { status: 400 });
  }

  const phone = `91${mobile}`; // WhatsApp MSISDN form — same shape bot_chats/orders already use
  const existing = await dbList('orders');

  // Same click sent twice -> hand back the order that already exists.
  if (clientRef) {
    const dup = existing.find((o) => o.clientRef === clientRef);
    if (dup) {
      const again = { ok: true, orderId: dup.id, total: dup.subtotal, quantity: dup.items?.[0]?.qty || quantity, duplicate: true };
      // Double-tap on "Pay online": hand back the same Razorpay order so Checkout opens for the same amount.
      if (dup.paymentStatus === 'awaiting' && dup.razorpay?.orderId && dup.payToken) {
        Object.assign(again, { paymentMethod: 'online', payToken: dup.payToken, checkout: checkoutFor(dup) });
      }
      return Response.json(again);
    }
  }

  const recent = existing.filter((o) => o.phone === phone && o.source === 'landing_page' && Date.now() - new Date(o.createdAt).getTime() < HOUR_MS);
  if (recent.length >= 3) {
    return Response.json({ error: 'Too many orders from this number in the last hour. Please contact us on WhatsApp.' }, { status: 429 });
  }

  let order;
  try {
    order = await createHeseosLandingOrder({
      name, phone, address, city, state, pincode, quantity, clientRef, product: DOOR_LOCK,
      paymentMethod: wantsOnline ? 'online' : 'cod',
      payToken: wantsOnline ? crypto.randomBytes(18).toString('hex') : null,
    });
  } catch (err) {
    console.error('POST /api/shop/door-lock createHeseosLandingOrder error:', err);
    return Response.json({ error: 'Could not place your order right now. Please try again in a moment.' }, { status: 500 });
  }

  // Online: open a Razorpay order for exactly this order's total (computed server-side). If Razorpay is
  // unreachable, remove the just-created order so no ghost "awaiting payment" order is left behind.
  if (wantsOnline) {
    const rz = await createRazorpayOrder({ amountRupees: order.subtotal, receipt: order.id, notes: { orderId: order.id, phone } });
    if (!rz.ok) {
      console.error('POST /api/shop/door-lock createRazorpayOrder error:', rz.error);
      await dbDelete('orders', order.id).catch(() => {});
      return Response.json({ error: 'We couldn\u2019t start the online payment right now. Please try again, or choose Cash / UPI on delivery.' }, { status: 502 });
    }
    const withRz = await dbPatch('orders', order.id, { razorpay: { orderId: rz.data.id, amountPaise: rz.data.amount, createdAt: new Date().toISOString() } });
    return Response.json({ ok: true, orderId: order.id, total: order.subtotal, quantity, paymentMethod: 'online', payToken: order.payToken, checkout: checkoutFor(withRz || { ...order, razorpay: { orderId: rz.data.id, amountPaise: rz.data.amount } }) });
  }

  // Best-effort — notifyHeseosOrderPlaced never throws, and a failed WhatsApp send must not undo
  // an order that's already safely recorded.
  const wa = await notifyHeseosOrderPlaced(order).catch((err) => { console.error('notifyHeseosOrderPlaced error:', err); return null; });

  return Response.json({ ok: true, orderId: order.id, total: order.subtotal, quantity, whatsappSent: !!wa?.ok });
}
