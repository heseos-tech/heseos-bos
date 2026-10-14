// Heseos's order pipeline — orders placed on the door-lock landing page (/lock — see
// lib/heseosDoorLock.js and app/api/shop/door-lock/route.js) after a WhatsApp conversation sends the
// customer there. An order isn't a lead: it has its own lifecycle (Placed -> Packed -> Shipped ->
// Delivered, plus a separate payment-received flag) and is managed from its own Admin -> Orders tab
// (components/admin/OrdersPage.jsx), not the Leads pipeline. (The earlier in-chat WhatsApp
// catalogue/cart/checkout flow has been removed — this landing page is the only ordering path.)
//
// v1 payment model: Cash/UPI on delivery, confirmed manually by Admin (see
// components/admin/OrdersPage.jsx's "Mark Paid" action) — no payment gateway wired up yet, so
// every order is created with paymentStatus: 'pending' and paymentMethod: 'cod' unconditionally.
// A future online-payment version would add a paymentMethod choice + a gateway webhook that
// flips paymentStatus itself instead of an admin doing it by hand.
import { dbGetById, dbInsert, dbPatch } from '@/lib/db';

export const ORDER_STATUSES = [
  { key: 'placed', label: 'Placed' },
  { key: 'packed', label: 'Packed' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
];

// The forward path a "Advance" action on Admin -> Orders steps through — Cancelled is reached
// separately (its own explicit action, never part of the normal forward march), same split as
// lib/leadStage.js treats Converted vs Rejected for leads.
export const ORDER_FORWARD_STATUSES = ['placed', 'packed', 'shipped', 'delivered'];

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

export async function markOrderPaid(orderId, actorLabel) {
  const order = await dbGetById('orders', orderId);
  if (!order) return null;
  const now = new Date().toISOString();
  const history = [...(order.history || []), { status: `Payment received (${actorLabel || 'Admin'})`, at: now, by: actorLabel || 'Admin' }];
  return dbPatch('orders', orderId, { paymentStatus: 'paid', paidAt: now, history, updatedAt: now });
}

// An order placed on the public door-lock landing page (/lock — see lib/heseosDoorLock.js and
// app/api/shop/door-lock/route.js). The `orders` row is what Admin -> Orders, the order slip and the
// invoice PDFs all read — plus a few extra fields (city/pincode/source/clientRef).
// `price`/`mrp` come from the server-side DOOR_LOCK constant — the caller never passes a price.
export async function createHeseosLandingOrder({ name, phone, address, city, pincode, quantity, clientRef, product }) {
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
    deliveryAddress: [address, city, pincode].filter(Boolean).join(', '),
    city,
    pincode,
    items,
    subtotal: product.price * qty,
    status: 'placed',
    paymentMethod: 'cod',
    paymentStatus: 'pending',
    source: 'landing_page',
    clientRef: clientRef || null,
    notes: '',
    history: [{ status: 'placed', at: now, by: 'Landing page' }],
    createdAt: now,
    updatedAt: now,
  };
  await dbInsert('orders', id, order);
  return order;
}
