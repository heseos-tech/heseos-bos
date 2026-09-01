// Flow Builder's backend — GET the tenant's saved visual flow (or a starter template if they've
// never opened the builder), PUT to save it. Every tenant only ever reads/writes their own row
// (see lib/auth.js's getBotTenant()); nothing here is Heseos-specific — see lib/botFlowEngine.js
// for how a saved flow actually drives a conversation.
//
// Saving does NOT turn the flow on by itself — `enabled` is a separate, explicit switch in the
// request body (see components/bot/FlowBuilderScreen.jsx's "Use this flow for my bot" toggle) so
// a tenant can build and iterate before their live bot switches over to it. Until enabled,
// app/api/bot/webhook keeps using the simpler Bot Configuration-driven engine (lib/botEngine.js).
import { dbGetById, dbInsert } from '@/lib/db';
import { getBotTenant } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const STARTER_FLOW = { nodes: [{ id: 'start', type: 'start', x: 60, y: 180, data: {} }], edges: [], enabled: false };

export async function GET() {
  const tenant = await getBotTenant();
  if (!tenant) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const flow = await dbGetById('bot_flows', tenant.id);
  return Response.json(flow || { id: tenant.id, tenantId: tenant.id, ...STARTER_FLOW });
}

export async function PUT(request) {
  const tenant = await getBotTenant();
  if (!tenant) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const nodes = Array.isArray(body.nodes) ? body.nodes : [];
  const edges = Array.isArray(body.edges) ? body.edges : [];
  if (!nodes.some((n) => n && n.type === 'start')) {
    return Response.json({ error: 'Every flow needs a Start step to begin from.' }, { status: 400 });
  }
  const flow = { id: tenant.id, tenantId: tenant.id, nodes, edges, enabled: body.enabled === true, updatedAt: new Date().toISOString() };
  await dbInsert('bot_flows', tenant.id, flow);
  return Response.json(flow);
}
