// Velocity Shipping -> HESEOS shipment status webhook. In Velocity: Settings -> Webhooks -> add
//   https://<your public address>/api/shipping/velocity/webhook
// with authentication "API Key" (header X-API-Key) or "Bearer Token", and the same secret you put in the
// VELOCITY_WEBHOOK_SECRET environment variable. See lib/velocityShipping.js for what happens next.
//
// Velocity disables a webhook after 5 failed deliveries, so once the request is authenticated this route
// ALWAYS answers 200 — an unknown order or an internal hiccup is logged, never returned as an error.
import { loadOrdersForVelocity, findOrderForVelocityData, applyVelocityUpdate, velocityWebhookAuthorised, velocityConfig } from '@/lib/velocityShipping';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (!velocityConfig().webhookSecret) return Response.json({ error: 'Webhook is not configured' }, { status: 503 });
  if (!velocityWebhookAuthorised(request)) {
    // A secret mismatch here makes Velocity retry, fail 5 times and DISABLE the webhook — so say so in the logs.
    console.error('Velocity webhook: 401 — the secret Velocity sent does not match VELOCITY_WEBHOOK_SECRET');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const d = body?.data || {};
    if (!d.shipment_id && !d.tracking_number && !d.order_external_id) return Response.json({ received: true, ignored: 'no shipment reference' });
    // Only forward shipments drive the HESEOS order; return / RTO events are just recorded as a status.
    const orders = await loadOrdersForVelocity();
    const order = findOrderForVelocityData(d, orders);
    if (!order) {
      console.error('Velocity webhook: no matching order for', d.order_external_id || d.shipment_id || d.tracking_number);
      return Response.json({ received: true, ignored: 'unknown order' });
    }
    const forward = !d.shipment_type || d.shipment_type === 'forward';
    const status = d.status ? String(d.status) : '';
    console.log('Velocity webhook:', order.id, 'status=', status || '-', 'sub=', d.sub_status || '-', 'type=', d.shipment_type || 'forward');
    await applyVelocityUpdate(order, {
      subStatus: d.sub_status || '',
      status: forward || /^rto_/.test(status) ? status : '',
      shipmentId: d.shipment_id, awb: d.tracking_number, courier: d.carrier_name, trackingUrl: d.tracking_url,
      eventId: body.event_id, eventAt: body.event_timestamp,
    }, 'Velocity');
  } catch (err) {
    console.error('Velocity webhook error:', err);
  }
  return Response.json({ received: true });
}
