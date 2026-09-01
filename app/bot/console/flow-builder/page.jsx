import { redirect } from 'next/navigation';
import { getBotTenant } from '@/lib/auth';
import { dbGetById } from '@/lib/db';
import FlowBuilderScreen from '@/components/bot/FlowBuilderScreen';

export const dynamic = 'force-dynamic';

const STARTER_FLOW = { nodes: [{ id: 'start', type: 'start', x: 60, y: 180, data: {} }], edges: [], enabled: false };

export default async function FlowBuilderPage() {
  const tenant = await getBotTenant();
  if (!tenant) redirect('/bot');
  const { password, ...safeTenant } = tenant;
  const flow = (await dbGetById('bot_flows', tenant.id)) || { id: tenant.id, tenantId: tenant.id, ...STARTER_FLOW };
  return <FlowBuilderScreen tenant={safeTenant} initialFlow={flow} />;
}
