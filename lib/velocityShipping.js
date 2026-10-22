// Velocity Shipping (velocity.in) integration — HESEOS orders -> courier shipments.
//
//   Packed order  ->  createShipmentForOrder()   (POST /forward-order, then /forward-order-shipment)
//                     saves AWB / courier / label on order.shipping and tells the customer.
//   Velocity      ->  /api/shipping/velocity/webhook  ->  applyVelocityUpdate()
//                     moves the order to Dispatched / Delivered and keeps the tracking link current.
//   Admin button  ->  retry / refresh tracking / cancel, via app/api/admin/orders/[id]/route.js.
//
// Everything is configured with environment variables (the API key is a secret — never stored in the DB):
//   VELOCITY_API_KEY          (required) Velocity dashboard -> Settings -> API Keys
//   VELOCITY_WAREHOUSE_ID     (required) pickup warehouse id, e.g. WHYYB5 (dashboard -> Warehouses)
//   VELOCITY_PICKUP_LOCATION  (required) the warehouse's name exactly as in the dashboard
//   VELOCITY_WEBHOOK_SECRET   (required for the webhook) shared secret entered in Velocity -> Settings -> Webhooks
//   VELOCITY_AUTO_SHIP        'false' switches off the automatic shipment when an order is marked Packed
//   VELOCITY_PKG_WEIGHT_KG / _LENGTH_CM / _BREADTH_CM / _HEIGHT_CM   parcel size (defaults 1 kg, 25x20x12 cm)
//   VELOCITY_BASE_URL         defaults to https://shazam.velocity.in

import crypto from 'node:crypto';
import { dbGetById, dbPatch, dbList } from '@/lib/db';
import { advanceOrderStatus } from '@/lib/heseosOrders';
import { notifyHeseosOrderStatus, notifyHeseosShipmentCreated } from '@/lib/heseosNotify';
import { velocityStatusLabel } from '@/lib/velocityStatusLabels';
import { lookupPincode } from '@/lib/pincodeLookup';

const num = (v, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };

export function velocityConfig() {
  const apiKey = String(process.env.VELOCITY_API_KEY || '').trim();
  return {
    baseUrl: String(process.env.VELOCITY_BASE_URL || 'https://shazam.velocity.in').replace(/\/+$/, ''),
    apiKey,
    warehouseId: String(process.env.VELOCITY_WAREHOUSE_ID || '').trim(),
    pickupLocation: String(process.env.VELOCITY_PICKUP_LOCATION || '').trim(),
    webhookSecret: String(process.env.VELOCITY_WEBHOOK_SECRET || '').trim(),
    autoShip: String(process.env.VELOCITY_AUTO_SHIP || '').toLowerCase() !== 'false',
    pkg: {
      weight: num(process.env.VELOCITY_PKG_WEIGHT_KG, 1),
      length: num(process.env.VELOCITY_PKG_LENGTH_CM, 25),
      breadth: num(process.env.VELOCITY_PKG_BREADTH_CM, 20),
      height: num(process.env.VELOCITY_PKG_HEIGHT_CM, 12),
    },
  };
}

export function velocityConfigured() {
  const c = velocityConfig();
  return !!(c.apiKey && c.warehouseId && c.pickupLocation);
}

// Raw call. Resolves { ok, status, data } — never throws.
async function vFetch(cfg, path, body) {
  try {
    const res = await fetch(`${cfg.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: {}, error: String((e && e.message) || e) };
  }
}

function errorText(r) {
  const d = r.data || {};
  const msg = d.message || d.error || (Array.isArray(d.errors) ? d.errors.join(', ') : (d.errors ? JSON.stringify(d.errors) : '')) || r.error || '';
  return String(msg).slice(0, 300) || `Velocity returned HTTP ${r.status}`;
}

// ── State from pincode ─────────────────────────────────────────────────────────────────────────
// New orders carry `state` from the order form; older ones are resolved from the pincode here.
export async function stateForPincode(pin) {
  return (await lookupPincode(pin)).state;
}

// ── Payload ────────────────────────────────────────────────────────────────────────────────────
function istStamp(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
  const g = (t) => parts.find((p) => p.type === t)?.value || '00';
  return `${g('year')}-${g('month')}-${g('day')} ${g('hour') === '24' ? '00' : g('hour')}:${g('minute')}`;
}

export function buildForwardOrderPayload(order, cfg, state) {
  const prepaid = order.paymentStatus === 'paid' || order.paymentMethod === 'prepaid';
  const items = (order.items || []).map((it, i) => ({
    name: String(it.name || 'Item').slice(0, 120),
    sku: String(it.productId || `ITEM${i + 1}`).slice(0, 60),
    units: Math.max(1, Number(it.qty) || 1),
    selling_price: Number(it.price) || 0,
  }));
  const subTotal = Number(order.subtotal) || items.reduce((s, it) => s + it.units * it.selling_price, 0);
  const phone = String(order.phone || '').replace(/\D/g, '').slice(-10);
  return {
    order_id: order.id,
    order_date: istStamp(order.createdAt ? new Date(order.createdAt) : new Date()),
    billing_customer_name: String(order.customerName || 'Customer').slice(0, 80),
    billing_address: String(order.deliveryAddress || '').slice(0, 250),
    billing_city: String(order.city || '').slice(0, 60),
    billing_pincode: String(order.pincode || ''),
    billing_state: state,
    billing_country: 'India',
    billing_phone: phone,
    shipping_is_billing: true,
    print_label: true,
    order_items: items,
    payment_method: prepaid ? 'PREPAID' : 'COD',
    sub_total: subTotal,
    cod_collectible: prepaid ? 0 : subTotal,
    shipping_charges: 0,
    length: cfg.pkg.length, breadth: cfg.pkg.breadth, height: cfg.pkg.height, weight: cfg.pkg.weight,
    pickup_location: cfg.pickupLocation,
    warehouse_id: cfg.warehouseId,
  };
}

// ── Saving results on the order ────────────────────────────────────────────────────────────────
async function saveShipping(order, patch, historyLine, actor) {
  const now = new Date().toISOString();
  const shipping = { provider: 'velocity', ...(order.shipping || {}), ...patch, updatedAt: now };
  const history = historyLine ? [...(order.history || []), { status: historyLine, at: now, by: actor || 'Velocity' }] : (order.history || []);
  return dbPatch('orders', order.id, { shipping, history, updatedAt: now });
}

// Fetch tracking for an AWB (also used to learn the public tracking link right after assignment).
export async function fetchVelocityTracking(awb, cfg = velocityConfig()) {
  const r = await vFetch(cfg, '/custom/api/v1/order-tracking', { awbs: [String(awb)] });
  if (!r.ok) return { ok: false, error: errorText(r) };
  const td = r.data?.result?.[String(awb)]?.tracking_data;
  if (!td) return { ok: false, error: 'No tracking data yet' };
  return { ok: true, status: td.shipment_status || null, trackUrl: td.track_url || null, activities: td.shipment_track_activities || [] };
}

// ── Create shipment ────────────────────────────────────────────────────────────────────────────
// Step 1 creates the order in Velocity, step 2 assigns a courier (Velocity's own shipping rules pick
// it when no carrier id is given). Safe to call again after a failure: step 1 is skipped once a
// shipment id is saved, and nothing happens when an AWB already exists.
export async function createShipmentForOrder(orderId, actor = 'System') {
  const cfg = velocityConfig();
  if (!velocityConfigured()) return { ok: false, error: 'Velocity is not configured — add VELOCITY_API_KEY, VELOCITY_WAREHOUSE_ID and VELOCITY_PICKUP_LOCATION in the server environment.' };
  let order = await dbGetById('orders', orderId);
  if (!order) return { ok: false, error: 'Order not found' };
  if (order.status === 'cancelled') return { ok: false, error: 'This order is cancelled' };
  if (order.shipping?.awb) return { ok: true, order, already: true };

  let shipmentId = order.shipping?.shipmentId || null;
  if (!shipmentId) {
    const state = String(order.state || '').trim() || await stateForPincode(order.pincode);
    if (!/^\d{6}$/.test(String(order.pincode || ''))) {
      order = await saveShipping(order, { status: 'failed', error: 'Order has no valid 6-digit pincode' }, 'Velocity shipment failed: no valid pincode', actor);
      return { ok: false, error: 'Order has no valid 6-digit pincode', order };
    }
    if (!state) {
      order = await saveShipping(order, { status: 'failed', error: 'Could not work out the state for this pincode' }, 'Velocity shipment failed: state unknown', actor);
      return { ok: false, error: 'Could not work out the state for this pincode', order };
    }
    const r1 = await vFetch(cfg, '/custom/api/v1/forward-order', buildForwardOrderPayload(order, cfg, state));
    const p1 = r1.data?.payload;
    if (!r1.ok || !p1?.shipment_id) {
      const err = errorText(r1);
      order = await saveShipping(order, { status: 'failed', error: err }, `Velocity order creation failed: ${err}`, actor);
      return { ok: false, error: err, order };
    }
    shipmentId = p1.shipment_id;
    order = await saveShipping(order, { status: 'created', shipmentId, velocityOrderId: p1.order_id || null, error: null }, `Order created in Velocity (${shipmentId})`, actor);
    // If the account has "Courier Auto Assignment" on, the AWB may already exist — the webhook will deliver it.
    if (p1.awb_generated === 1 && !p1.awb_code) return { ok: true, order, pendingAwb: true };
  }

  const r2 = await vFetch(cfg, '/custom/api/v1/forward-order-shipment', { shipment_id: shipmentId, carrier_id: '' });
  const p2 = r2.data?.payload;
  if (!r2.ok || !p2?.awb_code) {
    const err = errorText(r2);
    order = await saveShipping(order, { status: 'failed', error: `Courier not assigned: ${err}` }, `Velocity courier assignment failed: ${err}`, actor);
    return { ok: false, error: err, order };
  }
  const trk = await fetchVelocityTracking(p2.awb_code, cfg).catch(() => ({ ok: false }));
  order = await saveShipping(order, {
    status: 'ready_for_pickup', awb: String(p2.awb_code), courier: p2.courier_name || '', labelUrl: /^https:\/\//.test(p2.label_url || '') ? p2.label_url : null,
    trackingUrl: trk.ok ? trk.trackUrl : null, error: null, assignedAt: new Date().toISOString(),
  }, `Courier assigned: ${p2.courier_name || 'courier'}, AWB ${p2.awb_code}`, actor);
  const wa = await notifyHeseosShipmentCreated(order).catch((e) => { console.error('notifyHeseosShipmentCreated error:', e); return null; });
  return { ok: true, order, whatsappSent: !!wa?.ok };
}

// ── Cancel ─────────────────────────────────────────────────────────────────────────────────────
export async function cancelShipmentForOrder(orderId, actor = 'System') {
  const cfg = velocityConfig();
  const order = await dbGetById('orders', orderId);
  if (!order?.shipping?.awb) return { ok: true, skipped: true, order };
  if (['cancelled', 'delivered', 'rto_delivered'].includes(order.shipping.status)) return { ok: true, skipped: true, order };
  if (!cfg.apiKey) return { ok: false, error: 'Velocity is not configured', order };
  const r = await vFetch(cfg, '/custom/api/v1/cancel-order', { awbs: [order.shipping.awb] });
  if (!r.ok) {
    const err = errorText(r);
    return { ok: false, error: err, order: await saveShipping(order, { cancelError: err }, `Velocity cancel failed: ${err} — cancel it in the Velocity panel`, actor) };
  }
  return { ok: true, order: await saveShipping(order, { status: 'cancel_requested', cancelError: null }, 'Shipment cancellation requested in Velocity', actor) };
}

// ── Status updates (webhook + manual refresh) ──────────────────────────────────────────────────
// Velocity status -> HESEOS order status. Only ever moves an order FORWARD (a late or repeated event
// can't undo Delivered), and never touches a cancelled / installed order.
const ORDER_RANK = { placed: 0, confirmed: 1, packed: 2, shipped: 3, delivered: 4, installed: 5 };
function orderStatusFor(vStatus) {
  if (vStatus === 'in_transit' || vStatus === 'out_for_delivery') return 'shipped';
  if (vStatus === 'delivered') return 'delivered';
  return null;
}

export function findOrderForVelocityData(data, orders) {
  const ext = String(data.order_external_id || '');
  return orders.find((o) => ext && o.id === ext)
    || orders.find((o) => data.shipment_id && o.shipping?.shipmentId === data.shipment_id)
    || orders.find((o) => data.tracking_number && o.shipping?.awb === String(data.tracking_number))
    || orders.find((o) => data.order_id && o.shipping?.velocityOrderId === data.order_id)
    || null;
}

// data: { status, shipmentId, awb, courier, trackingUrl, eventId, eventAt }
export async function applyVelocityUpdate(order, data, actor = 'Velocity') {
  const sh = order.shipping || {};
  if (data.eventId && (sh.eventIds || []).includes(data.eventId)) return { order, duplicate: true };
  const evAt = data.eventAt ? new Date(data.eventAt).getTime() : 0;
  const lastAt = sh.lastEventAt ? new Date(sh.lastEventAt).getTime() : 0;
  const stale = evAt && lastAt && evAt < lastAt; // out-of-order: remember the event, don't regress the status

  const patch = { eventIds: [...(sh.eventIds || []), ...(data.eventId ? [data.eventId] : [])].slice(-30) };
  if (data.shipmentId && !sh.shipmentId) patch.shipmentId = data.shipmentId;
  if (data.awb && !sh.awb) patch.awb = String(data.awb);
  if (data.courier) patch.courier = data.courier;
  if (data.trackingUrl && /^https:\/\//.test(data.trackingUrl)) patch.trackingUrl = data.trackingUrl;
  let line = null;
  if (!stale && data.status) {
    if (data.status !== sh.status) line = `Courier status: ${velocityStatusLabel(data.status)}`;
    patch.status = data.status;
    if (evAt) patch.lastEventAt = new Date(evAt).toISOString();
  }
  let updated = await saveShipping(order, patch, line, actor);

  // Move the order along (and tell the customer) — only forward.
  let notified = false;
  const target = stale ? null : orderStatusFor(data.status);
  if (target && updated.status !== 'cancelled' && (ORDER_RANK[target] ?? -1) > (ORDER_RANK[updated.status] ?? 99)) {
    updated = await advanceOrderStatus(updated.id, target, 'Velocity');
    const wa = await notifyHeseosOrderStatus(updated, target).catch((e) => { console.error('notifyHeseosOrderStatus (velocity) error:', e); return null; });
    notified = !!wa?.ok;
  }
  return { order: updated, notified };
}

// Manual "Refresh tracking" (Admin) — the pull fallback when a webhook is missed.
export async function syncShipmentTracking(orderId) {
  const order = await dbGetById('orders', orderId);
  if (!order?.shipping?.awb) return { ok: false, error: 'This order has no AWB yet' };
  const t = await fetchVelocityTracking(order.shipping.awb);
  if (!t.ok) return { ok: false, error: t.error };
  const r = await applyVelocityUpdate(order, { status: t.status, trackingUrl: t.trackUrl }, 'Tracking refresh');
  return { ok: true, order: r.order };
}

// ── Webhook auth ───────────────────────────────────────────────────────────────────────────────
// Velocity can send the shared secret as `X-API-Key: <secret>` or `Authorization: Bearer <secret>`.
export function velocityWebhookAuthorised(request) {
  const secret = velocityConfig().webhookSecret;
  if (!secret) return false;
  const h = request.headers;
  const given = h.get('x-api-key') || (h.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!given) return false;
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(secret).digest();
  return crypto.timingSafeEqual(a, b);
}

export async function loadOrdersForVelocity() { return dbList('orders'); }
