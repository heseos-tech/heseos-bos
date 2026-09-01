// Flow Builder's list backend — GET every flow the tenant has built, POST to create a new one
// (optionally seeded from an existing flow's nodes/edges/triggers, for the "Duplicate" action in
// components/bot/FlowListScreen.jsx). Editing, saving and deleting one specific flow lives in
// app/api/bot/flow/[id]/route.js. Every tenant only ever touches their own rows (see
// lib/auth.js's getBotTenant()); nothing here is Heseos-specific — see lib/botFlowEngine.js for
// how a tenant's saved flows actually get chosen between and run.
import { dbWhere, dbInsert } from '@/lib/db';
import { getBotTenant } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function uid() {
  return `flow_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export async function GET() {
  const tenant = await getBotTenant();
  if (!tenant) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const flows = await dbWhere('bot_flows', 'tenantId', tenant.id);
  flows.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  return Response.json(flows);
}

export async function POST(request) {
  const tenant = await getBotTenant();
  if (!tenant) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));

  const nodes = Array.isArray(body.nodes) && body.nodes.some((n) => n && n.type === 'start')
    ? body.nodes
    : [{ id: 'start', type: 'start', x: 60, y: 180, data: {} }];
  const edges = Array.isArray(body.edges) ? body.edges : [];
  const triggers = {
    keywords: Array.isArray(body.triggers?.keywords) ? body.triggers.keywords.slice(0, 20).map((k) => String(k).slice(0, 40)) : [],
    attribution: Array.isArray(body.triggers?.attribution) ? body.triggers.attribution.filter((a) => a === 'qr' || a === 'referral') : [],
    // Never carried over when duplicating a flow — two flows silently fighting to be the
    // fallback is a confusing state a tenant should have to opt into deliberately, per flow.
    isDefault: false,
  };

  const now = new Date().toISOString();
  const id = uid();
  const flow = { id, tenantId: tenant.id, name: String(body.name || 'Untitled Flow').slice(0, 80) || 'Untitled Flow', enabled: false, triggers, nodes, edges, createdAt: now, updatedAt: now };
  await dbInsert('bot_flows', id, flow);
  return Response.json(flow);
}
