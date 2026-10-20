// lib/installBooking.js — "Book installation": the button on the order-delivered WhatsApp message
// (lib/heseosNotify.js) opens a public page where the customer picks a date + time window, which is
// saved on the order for Operations. Operations then add the installer's fee, which opens the job
// to installation partners in that city (lib/installJobs.js) — same flow as a date Operations set
// themselves, just started by the customer.
//
// The link is stateless and unguessable: `<orderId>.<HMAC signature>` — same approach as
// lib/quotationShare.js — so nothing new is stored to create one and it can't be forged for
// someone else's order.
import crypto from 'crypto';
import { dbGetById, dbPatch } from '@/lib/db';
import { INSTALL_SLOTS, setInstallationSchedule } from '@/lib/heseosOrders';
import { publicBaseUrl } from '@/lib/publicUrl';

const secret = () =>
  process.env.AUTH_SECRET ||
  process.env.DATABASE_URL ||
  (process.env.NODE_ENV === 'production' ? null : 'heseos-dev-install-booking-secret');

function sign(payload) {
  const s = secret();
  if (!s) throw new Error('AUTH_SECRET is required to create installation booking links');
  return crypto.createHmac('sha256', `install-booking:${s}`).update(payload).digest('base64url').slice(0, 24);
}

export function buildInstallBookingToken(orderId) {
  return `${orderId}.${sign(String(orderId))}`;
}

// Recovers the order id, or null if the token is malformed/forged. Never throws.
export function verifyInstallBookingToken(token) {
  if (!token || typeof token !== 'string') return null;
  const i = token.lastIndexOf('.');
  if (i <= 0) return null;
  const orderId = token.slice(0, i);
  const sig = token.slice(i + 1);
  let expected;
  try { expected = sign(orderId); } catch { return null; }
  const a = Buffer.from(sig); const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return orderId;
}

// Full https link, or null when PUBLIC_BASE_URL isn't set (callers then fall back to the plain message).
export function buildInstallBookingLink(orderId) {
  const base = publicBaseUrl();
  if (!base) return null;
  return `${base}/book-installation/${buildInstallBookingToken(orderId)}`;
}

// Today / limits in India time (the customers and the team are all in IST).
const IST_MS = 5.5 * 60 * 60 * 1000;
export const BOOKING_MIN_DAYS = 1;   // earliest: tomorrow
export const BOOKING_MAX_DAYS = 60;
export function istDate(offsetDays = 0, now = Date.now()) {
  return new Date(now + IST_MS + offsetDays * 86400000).toISOString().slice(0, 10);
}

export const BOOKING_SLOTS = INSTALL_SLOTS;

// Why a customer can't (re)book right now, or '' when they can. Shared by the page and the API.
export function bookingBlockReason(order) {
  if (!order || order.status === 'cancelled') return 'This order is no longer active.';
  if (order.status === 'installed') return 'Installation for this order is already complete.';
  if (order.status !== 'delivered') return 'You can book the installation once your order has been delivered.';
  if (order.installPartnerId) return 'An installation partner has already been assigned to your order. To change the time, please message us on WhatsApp.';
  return '';
}

export async function submitInstallBooking(orderId, { date, slot, note } = {}) {
  const order = await dbGetById('orders', orderId);
  const blocked = bookingBlockReason(order);
  if (blocked) return { ok: false, status: order ? 409 : 404, error: order ? blocked : 'Order not found' };

  const d = String(date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(`${d}T00:00:00Z`))) return { ok: false, status: 400, error: 'Please pick a valid date' };
  if (d < istDate(BOOKING_MIN_DAYS)) return { ok: false, status: 400, error: 'Please pick a date from tomorrow onwards' };
  if (d > istDate(BOOKING_MAX_DAYS)) return { ok: false, status: 400, error: `Please pick a date within the next ${BOOKING_MAX_DAYS} days` };
  if (!BOOKING_SLOTS.includes(slot)) return { ok: false, status: 400, error: 'Please choose a time window' };

  const r = await setInstallationSchedule(orderId, { date: d, slot }, 'Customer');
  const now = new Date().toISOString();
  const cleanNote = String(note || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  const updated = await dbPatch('orders', orderId, {
    installRequestedAt: now,
    installRequestSource: 'customer',
    installCustomerNote: cleanNote,
    installConfirmedAt: null,
    history: [...(r.order.history || []), { status: `Customer requested installation on ${d} (${slot})${cleanNote ? ` — "${cleanNote}"` : ''}`, at: now, by: 'Customer' }],
    updatedAt: now,
  });
  return { ok: true, order: updated };
}
