import { redirect, notFound } from 'next/navigation';
import { getBotTenant } from '@/lib/auth';
import { dbGetById } from '@/lib/db';
import FlowBuilderScreen from '@/components/bot/FlowBuilderScreen';

export const dynamic = 'force-dynamic';

export default async function FlowBuilderEditPage({ params }) {
  const tenant = await getBotTenant();
  if (!tenant) redirect('/bot');
  const { id } = await params;
  const flow = await dbGetById('bot_flows', id);
  if (!flow || flow.tenantId !== tenant.id) notFound();
  const { password, ...safeTenant } = tenant;
  return <FlowBuilderScreen tenant={safeTenant} flow={flow} />;
}
