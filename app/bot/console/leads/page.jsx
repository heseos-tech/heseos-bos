import { redirect } from 'next/navigation';
import { getBotTenant } from '@/lib/auth';
import LeadsScreen from '@/components/bot/LeadsScreen';

export const dynamic = 'force-dynamic';

export default async function BotLeadsPage() {
  const tenant = await getBotTenant();
  if (!tenant) redirect('/bot');
  return <LeadsScreen />;
}
