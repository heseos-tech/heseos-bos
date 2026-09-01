import { redirect } from 'next/navigation';
import { getBotTenant } from '@/lib/auth';
import { dbWhere } from '@/lib/db';
import FlowListScreen from '@/components/bot/FlowListScreen';

export const dynamic = 'force-dynamic';

export default async function FlowBuilderListPage() {
  const tenant = await getBotTenant();
  if (!tenant) redirect('/bot');
  const { password, ...safeTenant } = tenant;
  const flows = await dbWhere('bot_flows', 'tenantId', tenant.id);
  flows.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  return <FlowListScreen tenant={safeTenant} flows={flows} />;
}
