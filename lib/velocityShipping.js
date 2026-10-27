// Velocity Shipping (velocity.in) integration — HESEOS orders -> courier shipments.
//
//   Packed order  ->  createShipmentForOrder()   (POST /forward-order only — the order waits in Velocity
//                     as "ready to dispatch"; OUR OPERATIONS TEAM PICKS THE COURIER IN THE VELOCITY PANEL).
//   Velocity      ->  /api/shipping/velocity/webhook  ->  applyVelocityUpdate()
//                     courier assigned -> AWB / courier / tracking saved on the order;
//                     picked up / in transit -> order Dispatched + WhatsApp with the details;
//                     out for delivery -> WhatsApp; delivered -> order Delivered + WhatsApp.
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
import { notifyHeseosOrderStatus, notifyHeseosOutForDelivery } from '@/lib/heseosNotify';
import { velocityStatusLabel, velocityBeforePickup } from '@/lib/velocityStatusLabels';
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
    const raw = await res.text().catch(() => '');
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }
    return { ok: res.ok, status: res.status, data, raw };
  } catch (e) {
    return { ok: false, status: 0, data: {}, raw: '', error: String((e && e.message) || e) };
  }
}

// Turns a failed Velocity response into something an admin can act on. Velocity's error bodies vary, so
// look in the usual places and otherwise show the raw body — never a bare "HTTP 400".
function errorText(r) {
  const d = r.data || {};
  const flat = (v) => (Array.isArray(v) ? v.map(flat).filter(Boolean).join(', ') : v && typeof v === 'object' ? Object.entries(v).map(([k, x]) => `${k}: ${flat(x)}`).join('; ') : String(v ?? ''));
  const known = [d.message, d.error, d.errors, d.detail, d.payload?.message, d.payload?.errors, d.payload?.error].map(flat).find((x) => x && x.trim());
  const msg = known || r.error || (r.raw ? String(r.raw).replace(/\s+/g, ' ').trim() : '');
  return `${msg ? msg.slice(0, 400) : 'no details returned'} (HTTP ${r.status || 'no response'})`;
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
// Creates the order in Velocity and stops there: it shows up in the Velocity panel waiting for a courier,
// and Operations choose one for each order in that panel (we do NOT auto-assign). The AWB, courier and
// tracking link come back through the webhook. Calling it again does nothing while a live Velocity order
// exists; after the shipment was cancelled in Velocity it books a fresh Velocity order (id `<order>-R2` …).
export async function createShipmentForOrder(orderId, actor = 'System') {
  const cfg = velocityConfig();
  if (!velocityConfigured()) return { ok: false, error: 'Velocity is not configured — add VELOCITY_API_KEY, VELOCITY_WAREHOUSE_ID and VELOCITY_PICKUP_LOCATION in the server environment.' };
  let order = await dbGetById('orders', orderId);
  if (!order) return { ok: false, error: 'Order not found' };
  if (order.status === 'cancelled') return { ok: false, error: 'This order is cancelled' };
  const cur = order.shipping || null;
  const redo = cur?.status === 'cancelled';
  if (cur?.shipmentId && !redo) return { ok: true, order, already: true };

  const attempt = redo ? (Number(cur.attempt) || 1) + 1 : (Number(cur?.attempt) || 1);
  const state = String(order.state || '').trim() || await stateForPincode(order.pincode);
  if (!/^\d{6}$/.test(String(order.pincode || ''))) {
    order = await saveShipping(order, { status: 'failed', error: 'Order has no valid 6-digit pincode' }, 'Velocity shipment failed: no valid pincode', actor);
    return { ok: false, error: 'Order has no valid 6-digit pincode', order };
  }
  if (!state) {
    order = await saveShipping(order, { status: 'failed', error: 'Could not work out the state for this pincode' }, 'Velocity shipment failed: state unknown', actor);
    return { ok: false, error: 'Could not work out the state for this pincode', order };
  }
  const payload = buildForwardOrderPayload(order, cfg, state);
  if (attempt > 1) payload.order_id = `${order.id}-R${attempt}`;
  const r1 = await vFetch(cfg, '/custom/api/v1/forward-order', payload);
  const p1 = r1.data?.payload;
  if (!r1.ok || !p1?.shipment_id) {
    const err = `Order creation: ${errorText(r1)}`;
    order = await saveShipping(order, { status: 'failed', error: err }, `Velocity order creation failed: ${err}`, actor);
    return { ok: false, error: err, order };
  }
  // Fresh shipment: clear anything left over from a cancelled one.
  order = await saveShipping(order, {
    status: 'pending', attempt, shipmentId: p1.shipment_id, velocityOrderId: p1.order_id || null, velocityRef: payload.order_id,
    awb: null, courier: '', trackingUrl: null, labelUrl: null, error: null, cancelError: null, stale: false, staleAt: null, eventIds: [], lastEventAt: null, ofdNotifiedAt: null,
  }, redo ? `Re-sent to Velocity (${p1.shipment_id}) — waiting for a courier` : `Sent to Velocity (${p1.shipment_id}) — waiting for a courier`, actor);
  return { ok: true, order };
}

// ── Send again (after cancelling in Velocity) ─────────────────────────────────────────────────
// Operations cancelled the shipment in the Velocity panel BEFORE the courier collected it (Velocity may
// not tell us — a shipment with no courier yet has no AWB to report on), and now want it booked afresh.
// Marks the old Velocity shipment cancelled here and books a new one (`<order>-R2` …). Refused once the
// courier has picked the parcel up — it is on its way and cannot be re-sent.
export async function resendShipmentForOrder(orderId, actor = 'System') {
  const order = await dbGetById('orders', orderId);
  if (!order) return { ok: false, error: 'Order not found' };
  if (order.status === 'cancelled') return { ok: false, error: 'This order is cancelled' };
  const sh = order.shipping;
  if (sh?.shipmentId && sh.status !== 'cancelled') {
    if (!velocityBeforePickup(sh.status)) {
      return { ok: false, error: `The courier has already picked this up (${velocityStatusLabel(sh.status)}) — it cannot be sent again`, order };
    }
    await saveShipping(order, { status: 'cancelled', cancelError: null }, 'Marked as cancelled in Velocity — sending again', actor);
  }
  return createShipmentForOrder(orderId, actor);
}

// ── Cancel ─────────────────────────────────────────────────────────────────────────────────────
export async function cancelShipmentForOrder(orderId, actor = 'System') {
  const cfg = velocityConfig();
  const order = await dbGetById('orders', orderId);
  if (order?.shipping?.shipmentId && !order.shipping.awb && order.shipping.status !== 'cancelled') {
    // No courier yet, so there is no AWB to cancel through the API — it has to be cancelled in the Velocity panel.
    const err = 'Waiting in Velocity with no courier yet — cancel it in the Velocity panel';
    return { ok: false, error: err, order: await saveShipping(order, { cancelError: err }, err, actor) };
  }
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
  const ext = String(data.order_external_id || '').replace(/-R\d+$/, '');
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
  // An event from a shipment we replaced (cancelled in Velocity, then sent again) must not touch the new one.
  if (data.shipmentId && sh.shipmentId && String(data.shipmentId) !== String(sh.shipmentId)) return { order, superseded: true };
  // Velocity's cancel wording varies ('canceled', 'cancellation_…') — all mean the shipment is cancelled.
  if (data.status && /^cancel/.test(String(data.status)) && data.status !== 'cancel_requested') data = { ...data, status: 'cancelled' };
  const evAt = data.eventAt ? new Date(data.eventAt).getTime() : 0;
  const lastAt = sh.lastEventAt ? new Date(sh.lastEventAt).getTime() : 0;
  const stale = evAt && lastAt && evAt < lastAt; // out-of-order: remember the event, don't regress the status

  const patch = { eventIds: [...(sh.eventIds || []), ...(data.eventId ? [data.eventId] : [])].slice(-30) };
  if (data.shipmentId && !sh.shipmentId) patch.shipmentId = data.shipmentId;
  if (data.awb) patch.awb = String(data.awb);
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
  // Out for delivery: tell the customer once per shipment (the order itself stays "Dispatched").
  if (!stale && data.status === 'out_for_delivery' && !sh.ofdNotifiedAt && updated.status !== 'delivered' && updated.status !== 'cancelled') {
    const wa = await notifyHeseosOutForDelivery(updated).catch((e) => { console.error('notifyHeseosOutForDelivery error:', e); return null; });
    updated = await saveShipping(updated, { ofdNotifiedAt: new Date().toISOString() }, null, actor);
    notified = notified || !!wa?.ok;
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
