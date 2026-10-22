// app/api/shop/door-lock/route.js
// PUBLIC (no login) — the HESEOS Smart Door Lock landing page (/lock, public/door-lock/index.html)
// talks to this. GET returns the price the page should display; POST places an order.
//
// An order placed here: re-priced server-side from lib/heseosDoorLock.js (the browser's idea of the
// price is never trusted), written to the `orders` table (shows up in Admin -> Orders exactly like a
// WhatsApp-cart order), and the customer is sent an "order placed" confirmation on WhatsApp from
// HESEOS Buddy's own number. Payment is Cash / UPI on delivery, same as the rest of the order
// system (lib/heseosOrders.js).
//
// Abuse guards, since this is open to the internet AND triggers an outbound WhatsApp message to
// whatever number is typed in: a hidden honeypot field, a per-phone cap (3 orders / hour), and
// `clientRef` de-duplication so a double-tap or a browser retry never creates two orders.
import { dbList } from '@/lib/db';
import { DOOR_LOCK, indianMobile } from '@/lib/heseosDoorLock';
import { createHeseosLandingOrder } from '@/lib/heseosOrders';
import { canonicalState, lookupPincode } from '@/lib/pincodeLookup';
import { notifyHeseosOrderPlaced } from '@/lib/heseosNotify';

export const dynamic = 'force-dynamic';

const HOUR_MS = 60 * 60 * 1000;
const clean = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);

export async function GET() {
  return Response.json({ name: DOOR_LOCK.name, mrp: DOOR_LOCK.mrp, price: DOOR_LOCK.price, maxQty: DOOR_LOCK.maxQty });
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }

  // Honeypot — a real visitor never sees or fills this field. Pretend success so a bot learns nothing.
  if (body?.website) return Response.json({ ok: true, orderId: 'ORD00000000' });

  const name = clean(body?.name, 80);
  const mobile = indianMobile(body?.phone);
  const address = clean(body?.address, 300);
  const city = clean(body?.city, 60);
  const pincode = String(body?.pincode || '').replace(/\D/g, '');
  let state = canonicalState(body?.state);
  const quantity = Math.floor(Number(body?.quantity));
  const clientRef = clean(body?.clientRef, 64) || null;

  if (name.length < 2) return Response.json({ error: 'Please enter your full name.' }, { status: 400 });
  if (!mobile) return Response.json({ error: 'Please enter a valid 10-digit mobile number.' }, { status: 400 });
  if (address.length < 8) return Response.json({ error: 'Please enter your full delivery address.' }, { status: 400 });
  if (city.length < 2) return Response.json({ error: 'Please enter your city.' }, { status: 400 });
  if (!/^\d{6}$/.test(pincode)) return Response.json({ error: 'Please enter a valid 6-digit pincode.' }, { status: 400 });
  // The form fills the state from the pincode; if it didn't arrive (an old cached page, or a lookup that failed),
  // work it out here so the courier hand-off always has one.
  if (!state) state = (await lookupPincode(pincode)).state;
  if (!state) return Response.json({ error: 'Please select your state.' }, { status: 400 });
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > DOOR_LOCK.maxQty) {
    return Response.json({ error: `Quantity must be between 1 and ${DOOR_LOCK.maxQty}.` }, { status: 400 });
  }

  const phone = `91${mobile}`; // WhatsApp MSISDN form — same shape bot_chats/orders already use
  const existing = await dbList('orders');

  // Same click sent twice -> hand back the order that already exists.
  if (clientRef) {
    const dup = existing.find((o) => o.clientRef === clientRef);
    if (dup) return Response.json({ ok: true, orderId: dup.id, total: dup.subtotal, quantity: dup.items?.[0]?.qty || quantity, duplicate: true });
  }

  const recent = existing.filter((o) => o.phone === phone && o.source === 'landing_page' && Date.now() - new Date(o.createdAt).getTime() < HOUR_MS);
  if (recent.length >= 3) {
    return Response.json({ error: 'Too many orders from this number in the last hour. Please contact us on WhatsApp.' }, { status: 429 });
  }

  let order;
  try {
    order = await createHeseosLandingOrder({ name, phone, address, city, state, pincode, quantity, clientRef, product: DOOR_LOCK });
  } catch (err) {
    console.error('POST /api/shop/door-lock createHeseosLandingOrder error:', err);
    return Response.json({ error: 'Could not place your order right now. Please try again in a moment.' }, { status: 500 });
  }

  // Best-effort — notifyHeseosOrderPlaced never throws, and a failed WhatsApp send must not undo
  // an order that's already safely recorded.
  const wa = await notifyHeseosOrderPlaced(order).catch((err) => { console.error('notifyHeseosOrderPlaced error:', err); return null; });

  return Response.json({ ok: true, orderId: order.id, total: order.subtotal, quantity, whatsappSent: !!wa?.ok });
}
