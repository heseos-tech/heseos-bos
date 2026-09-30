// Heseos's own WhatsApp-shopping order pipeline — a cart built up in lib/botFlowEngine.js's
// 'catalog' node type (see that file's own header comment on why this is a Heseos-only
// mechanic, not a generic Flow Builder capability) turns into a real row in the `orders`
// table here, the moment the shopping flow reaches its closing handoff. Deliberately its own
// file rather than folded into lib/heseosLeadSync.js — an order isn't a lead, has its own
// lifecycle (Placed -> Packed -> Shipped -> Delivered, plus a separate payment-received flag),
// and is managed from its own Admin -> Orders tab (components/admin/OrdersPage.jsx), not the
// Leads pipeline.
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

function computeCartTotal(cart) {
  return (cart || []).reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.qty) || 0), 0);
}

// Safe to call unconditionally from every flow handoff — same "no-op unless this chat's own
// state actually holds what I need" contract as lib/heseosLeadSync.js's scheduleHeseosDemo/
// submitHeseosRating. Only ever has a non-empty chat.cart AND chat.answers.orderAddress set
// when the chat was actually walked through lib/heseosShoppingFlow.js's catalog -> checkout
// steps to their end — nothing else in the app ever sets either of these.
export async function createHeseosOrderFromCart(chat) {
  const cart = Array.isArray(chat?.cart) ? chat.cart : [];
  const address = chat?.answers?.orderAddress;
  if (!cart.length || !address) return null;
  try {
    const id = `ORD${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;
    const now = new Date().toISOString();
    const items = cart.map((item) => ({
      productId: item.productId,
      name: item.name,
      price: Number(item.price) || 0,
      qty: Number(item.qty) || 0,
      lineTotal: (Number(item.price) || 0) * (Number(item.qty) || 0),
    }));
    const order = {
      id,
      phone: chat.phone,
      chatId: chat.id,
      customerName: chat?.answers?.orderName || chat.name || 'WhatsApp customer',
      deliveryAddress: address,
      items,
      subtotal: computeCartTotal(cart),
      status: 'placed',
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      notes: '',
      history: [{ status: 'placed', at: now, by: 'WhatsApp' }],
      createdAt: now,
      updatedAt: now,
    };
    await dbInsert('orders', id, order);
    return order;
  } catch (err) {
    console.error('createHeseosOrderFromCart error:', err);
    return null;
  }
}

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
