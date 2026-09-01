// Flow Builder's per-flow backend — GET/PUT/DELETE one specific flow. Every call checks the
// flow's own tenantId against the signed-in tenant (see ownedFlow()) so one tenant can never
// read, overwrite or delete another tenant's flow — there's no other access control on this
// route otherwise. See app/api/bot/flow/route.js for listing/creating, and
// lib/botFlowEngine.js for how a saved flow actually drives a conversation once enabled.
import { dbGetById, dbInsert, dbDelete } from '@/lib/db';
import { getBotTenant } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function ownedFlow(tenant, id) {
  const flow = await dbGetById('bot_flows', id);
  if (!flow || flow.tenantId !== tenant.id) return null;
  return flow;
}

export async function GET(request, { params }) {
  const tenant = await getBotTenant();
  if (!tenant) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const flow = await ownedFlow(tenant, id);
  if (!flow) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json(flow);
}

export async function PUT(request, { params }) {
  const tenant = await getBotTenant();
  if (!tenant) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const existing = await ownedFlow(tenant, id);
  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const nodes = Array.isArray(body.nodes) ? body.nodes : existing.nodes;
  const edges = Array.isArray(body.edges) ? body.edges : existing.edges;
  if (!nodes.some((n) => n && n.type === 'start')) {
    return Response.json({ error: 'Every flow needs a Start step to begin from.' }, { status: 400 });
  }

  const flow = {
    ...existing,
    name: body.name !== undefined ? (String(body.name).slice(0, 80) || 'Untitled Flow') : existing.name,
    enabled: body.enabled === true,
    triggers: {
      keywords: Array.isArray(body.triggers?.keywords) ? body.triggers.keywords.slice(0, 20).map((k) => String(k).slice(0, 40)) : (existing.triggers?.keywords || []),
      attribution: Array.isArray(body.triggers?.attribution) ? body.triggers.attribution.filter((a) => a === 'qr' || a === 'referral') : (existing.triggers?.attribution || []),
      isDefault: body.triggers?.isDefault === true,
    },
    nodes,
    edges,
    updatedAt: new Date().toISOString(),
  };
  await dbInsert('bot_flows', id, flow);
  return Response.json(flow);
}

export async function DELETE(request, { params }) {
  const tenant = await getBotTenant();
  if (!tenant) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const existing = await ownedFlow(tenant, id);
  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 });
  await dbDelete('bot_flows', id);
  return Response.json({ ok: true });
}
