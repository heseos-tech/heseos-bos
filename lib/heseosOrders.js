// Heseos's order pipeline — orders placed on the door-lock landing page (/lock — see
// lib/heseosDoorLock.js and app/api/shop/door-lock/route.js) after a WhatsApp conversation sends the
// customer there. An order isn't a lead: it has its own lifecycle (Placed -> Confirmed -> Packed -> Dispatched ->
// Delivered -> Installation Done, plus a separate payment-received flag) and is managed from its own Admin -> Orders tab
// (components/admin/OrdersPage.jsx), not the Leads pipeline. (The earlier in-chat WhatsApp
// catalogue/cart/checkout flow has been removed — this landing page is the only ordering path.)
//
// Payment model: the customer chooses on the landing page.
//   • Cash / UPI on delivery (default) — paymentMethod 'cod', paymentStatus 'pending'; the team marks it
//     collected later (components/admin/OrdersPage.jsx's "Mark Paid").
//   • Pay online (Razorpay) — paymentMethod 'online', paymentStatus 'awaiting' until Razorpay confirms the
//     money; then 'paid' and the order auto-confirms (lib/heseosPayments.js). Needs RAZORPAY_* env vars.
import { dbGetById, dbInsert, dbPatch } from '@/lib/db';
import { indianMobile } from '@/lib/heseosDoorLock';
import { resolveServiceArea } from '@/lib/pincodeLookup';
import { velocityBeforePickup, velocityShipmentEnded } from '@/lib/velocityStatusLabels';

export const ORDER_STATUSES = [
  { key: 'placed', label: 'Placed' },
  // Set once the team has phoned the customer and confirmed the order with them.
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'packed', label: 'Packed' },
  // Stored key stays 'shipped' (orders already saved with it keep working); shown as "Dispatched".
  { key: 'shipped', label: 'Dispatched' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'installed', label: 'Installation Done' },
  { key: 'cancelled', label: 'Cancelled' },
];

// The forward path a "Advance" action on Admin -> Orders steps through — Cancelled is reached
// separately (its own explicit action, never part of the normal forward march), same split as
// lib/leadStage.js treats Converted vs Rejected for leads.
export const ORDER_FORWARD_STATUSES = ['placed', 'confirmed', 'packed', 'shipped', 'delivered', 'installed'];

// Admin -> Orders' "Advance" / "Cancel" / "Mark Paid" actions all funnel through this — same
// append-only history convention lib/leadStage.js's pushHistory uses for leads, kept local here
// since orders' own status set is completely different (Placed/Packed/Shipped/Delivered vs a
// lead's contact/demo/converted stages) and doesn't belong mixed into that file.
export async function advanceOrderStatus(orderId, nextStatus, actorLabel) {
  const order = await dbGetById('orders', orderId);
  if (!order) return null;
  const now = new Date().toISOString();
  const history = [...(order.history || []), { status: nextStatus, at: now, by: actorLabel || 'Admin' }];
  return dbPatch('orders', orderId, { status: nextStatus, history, updatedAt: now });
}

// Installation slots the Operations panel offers (stored as the label itself so Admin and the
// WhatsApp message read naturally without a lookup).
export const INSTALL_SLOTS = ['Morning (9 am – 12 pm)', 'Afternoon (12 – 4 pm)', 'Evening (4 – 7 pm)'];

// Operations calls the customer, agrees an installation date, and records it here, together with
// the fee the installation partner will earn for the job. `date` is 'YYYY-MM-DD' (or '' to clear
// it); `fee` is rupees (or '' / null to clear it). Returns { order, changed, feeChanged } —
// `changed` is true only when the date or time window moved, so callers message the customer
// exactly then (a fee-only edit, or re-saving the same values, never texts them again).
export const INSTALL_FEE_MAX = 1000000;
export function cleanInstallFee(fee) {
  if (fee === undefined || fee === null || fee === '') return null;
  const n = Math.round(Number(fee) * 100) / 100;
  return Number.isFinite(n) && n >= 0 && n <= INSTALL_FEE_MAX ? n : NaN;
}
export async function setInstallationSchedule(orderId, { date = '', slot = '', fee } = {}, actorLabel) {
  const order = await dbGetById('orders', orderId);
  if (!order) return null;
  const cleanDate = /^\d{4}-\d{2}-\d{2}$/.test(String(date)) ? String(date) : '';
  const cleanSlot = cleanDate ? String(slot || '').slice(0, 60) : '';
  const feeGiven = fee !== undefined;
  const cleanFee = feeGiven ? cleanInstallFee(fee) : (order.installFee ?? null);
  const changed = (order.installDate || '') !== cleanDate || (order.installSlot || '') !== cleanSlot;
  const feeChanged = feeGiven && (order.installFee ?? null) !== cleanFee;
  if (!changed && !feeChanged) return { order, changed: false, feeChanged: false };
  const now = new Date().toISOString();
  const history = [...(order.history || [])];
  if (changed) {
    history.push({ status: cleanDate ? `Installation scheduled for ${cleanDate}${cleanSlot ? ` (${cleanSlot})` : ''}` : 'Installation date cleared', at: now, by: actorLabel || 'Operations' });
  }
  if (feeChanged) {
    history.push({ status: cleanFee == null ? 'Installation fee cleared' : `Installation fee set to ₹${cleanFee}`, at: now, by: actorLabel || 'Operations' });
  }
  const updated = await dbPatch('orders', orderId, {
    installDate: cleanDate,
    installSlot: cleanSlot,
    installFee: cleanFee,
    ...(changed ? { installScheduledAt: cleanDate ? now : null, installScheduledBy: cleanDate ? (actorLabel || 'Operations') : null } : {}),
    history,
    updatedAt: now,
  });
  return { order: updated, changed, feeChanged };
}

export async function markOrderPaid(orderId, actorLabel, mode) {
  const order = await dbGetById('orders', orderId);
  if (!order) return null;
  const now = new Date().toISOString();
  const via = mode === 'cash' ? 'Cash' : mode === 'upi' ? 'UPI' : '';
  const what = order.paymentMethod === 'cod' ? 'COD collected' : 'Payment received';
  const history = [...(order.history || []), { status: `${what}${via ? ` — ${via}` : ''} (${actorLabel || 'Admin'})`, at: now, by: actorLabel || 'Admin' }];
  return dbPatch('orders', orderId, { paymentStatus: 'paid', paidAt: now, ...(via ? { paymentDetail: via } : {}), history, updatedAt: now });
}

// An order placed on the public door-lock landing page (/lock — see lib/heseosDoorLock.js and
// app/api/shop/door-lock/route.js). The `orders` row is what Admin -> Orders, the order slip and the
// invoice PDFs all read — plus a few extra fields (city/pincode/source/clientRef).
// `price`/`mrp` come from the server-side DOOR_LOCK constant — the caller never passes a price.
export async function createHeseosLandingOrder({ name, phone, address, city, state, pincode, quantity, clientRef, product, paymentMethod = 'cod', payToken = null }) {
  const online = paymentMethod === 'online';
  const qty = Number(quantity) || 1;
  const id = `ORD${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;
  const now = new Date().toISOString();
  const items = [{
    productId: product.productId,
    name: product.name,
    price: product.price,
    mrp: product.mrp,
    qty,
    lineTotal: product.price * qty,
  }];
  const order = {
    id,
    phone,
    chatId: phone,
    customerName: name,
    deliveryAddress: [address, city, state, pincode].filter(Boolean).join(', '),
    city,
    state: state || '',
    pincode,
    items,
    subtotal: product.price * qty,
    status: 'placed',
    paymentMethod: online ? 'online' : 'cod',
    paymentStatus: online ? 'awaiting' : 'pending',
    ...(online ? { payToken } : {}),
    source: 'landing_page',
    clientRef: clientRef || null,
    notes: '',
    history: [{ status: online ? 'placed (waiting for online payment)' : 'placed', at: now, by: 'Landing page' }],
    createdAt: now,
    updatedAt: now,
  };
  await dbInsert('orders', id, order);
  return order;
}

// ── Edit an order (Operations / Admin) ─────────────────────────────────────────────────────────
// Corrects the customer's details, delivery address/pincode and the order lines (qty, unit price, remove /
// add a line); the total is recomputed from the lines. City and state are NEVER taken from the caller —
// when the pincode changes they are looked up again from it. Every change is written to the order history.
//
// Rules: delivered / installed / cancelled orders are closed. Once payment is received the lines are
// locked (the money already collected must match the order). If the order is already in Velocity, the
// courier is NOT told about the edit — before pickup the shipment is flagged `stale` so the team cancels
// and re-sends it; after pickup, changes to the lines or address are refused.
export const EDITABLE_STATUSES = ['placed', 'confirmed', 'packed', 'shipped'];
const r2n = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export async function editOrder(orderId, edit, actorLabel) {
  const fail = (error, status = 400) => ({ ok: false, status, error });
  const order = await dbGetById('orders', orderId);
  if (!order) return fail('Order not found', 404);
  if (!EDITABLE_STATUSES.includes(order.status)) return fail(`A ${order.status === 'cancelled' ? 'cancelled' : 'completed'} order can't be edited`);
  const e = edit && typeof edit === 'object' ? edit : {};
  const sh = order.shipping || null;
  const liveShipment = !!(sh?.shipmentId && !velocityShipmentEnded(sh.status));
  const pickedUp = liveShipment && !velocityBeforePickup(sh.status, sh.awb);
  const patch = {};
  const changes = [];
  let courierSensitive = false; // lines / address / pincode / phone / name — what the Velocity order was built from

  // ── customer ──
  if (e.customerName !== undefined) {
    const name = String(e.customerName || '').trim().slice(0, 80);
    if (!name) return fail('Enter the customer name');
    if (name !== (order.customerName || '')) { patch.customerName = name; changes.push(`name → ${name}`); courierSensitive = true; }
  }
  if (e.phone !== undefined) {
    const m = indianMobile(e.phone);
    if (!m) return fail('Enter a valid 10-digit mobile number');
    const full = `91${m}`;
    if (full !== String(order.phone || '')) {
      patch.phone = full;
      if (!order.chatId || order.chatId === order.phone) patch.chatId = full;
      changes.push(`phone ${String(order.phone || '').slice(-10)} → ${m}`);
      courierSensitive = true;
    }
  }

  // ── address + pincode (city/state always from the pincode) ──
  let addressText = e.deliveryAddress !== undefined ? String(e.deliveryAddress || '').trim().slice(0, 400) : String(order.deliveryAddress || '');
  if (e.deliveryAddress !== undefined && !addressText) return fail('Enter the delivery address');
  if (e.pincode !== undefined && String(e.pincode) !== String(order.pincode || '')) {
    const area = await resolveServiceArea(e.pincode);
    if (!area.ok) return fail(area.error, area.status || 400);
    if (order.installPartnerId && area.city !== order.city) return fail('An installer has claimed this order in its current city — release the installer first, then change the pincode');
    if (order.pincode && addressText.includes(String(order.pincode))) addressText = addressText.split(String(order.pincode)).join(area.pincode);
    // The address text carries the old city/state too (it was built "street, city, state, pincode") — keep it consistent.
    if (e.deliveryAddress === undefined) {
      if (order.city && area.city && order.city !== area.city) addressText = addressText.split(order.city).join(area.city);
      if (order.state && area.state && order.state !== area.state) addressText = addressText.split(order.state).join(area.state);
    }
    patch.pincode = area.pincode; patch.city = area.city; patch.state = area.state || '';
    changes.push(`pincode ${order.pincode || '—'} → ${area.pincode} (${[area.city, area.state].filter(Boolean).join(', ')})`);
    courierSensitive = true;
  }
  if (addressText !== String(order.deliveryAddress || '')) {
    patch.deliveryAddress = addressText;
    if (!changes.some((c) => c.startsWith('pincode'))) changes.push('delivery address');
    courierSensitive = true;
  }

  // ── lines ──
  let linesChanged = false;
  if (e.items !== undefined) {
    if (!Array.isArray(e.items) || e.items.length < 1 || e.items.length > 20) return fail('An order needs between 1 and 20 items');
    const old = Array.isArray(order.items) ? order.items : [];
    const next = [];
    for (let i = 0; i < e.items.length; i++) {
      const it = e.items[i] || {};
      const qty = Math.round(Number(it.qty));
      const price = r2n(it.price);
      if (!(qty >= 1 && qty <= 100)) return fail('Quantity must be between 1 and 100');
      if (!Number.isFinite(price) || price < 0 || price > 1000000) return fail('Enter a valid price (₹0 – ₹10,00,000)');
      const prev = it.productId ? old.find((o) => o.productId === it.productId) : null;
      const name = prev ? prev.name : String(it.name || '').trim().slice(0, 120);
      if (!name) return fail('Give every added item a name');
      next.push({ ...(prev ? { productId: prev.productId, mrp: prev.mrp } : { productId: 'custom' }), name, price, qty, lineTotal: r2n(price * qty) });
    }
    const subtotal = r2n(next.reduce((s, x) => s + x.lineTotal, 0));
    const same = JSON.stringify(next.map((x) => [x.productId, x.name, x.price, x.qty])) === JSON.stringify(old.map((x) => [x.productId, x.name, Number(x.price), Number(x.qty)]));
    if (!same) {
      if (order.paymentStatus === 'paid') return fail('Payment has already been received — items and prices can no longer be changed');
      if (order.paymentStatus === 'awaiting') return fail('This order is waiting for the customer\u2019s online payment — items and prices are locked until it is paid or switched to Cash / UPI on delivery');
      patch.items = next;
      patch.subtotal = subtotal;
      linesChanged = true;
      changes.push(`items/prices changed — total ${inr(order.subtotal)} → ${inr(subtotal)}`);
      courierSensitive = true;
    }
  }

  if (!changes.length) return { ok: true, order, changed: false };
  if (pickedUp && (linesChanged || patch.deliveryAddress || patch.pincode)) {
    return fail('The courier has already picked this order up — the items and address can no longer be changed');
  }

  const now = new Date().toISOString();
  const invoiceNote = order.invoiceNo ? ` (invoice no. ${order.invoiceNo} had already been generated)` : '';
  patch.history = [...(order.history || []), { status: `Order edited: ${changes.join('; ')}${invoiceNote}`, at: now, by: actorLabel || 'Operations' }];
  patch.updatedAt = now;
  let shippingStale = false;
  if (courierSensitive && liveShipment && !pickedUp) {
    patch.shipping = { ...sh, stale: true, staleAt: now };
    shippingStale = true;
  }
  const updated = await dbPatch('orders', orderId, patch);
  return { ok: true, order: updated, changed: true, shippingStale, invoiceIssued: !!order.invoiceNo };
}
