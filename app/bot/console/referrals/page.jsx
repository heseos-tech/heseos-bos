import { redirect } from 'next/navigation';
import { getBotTenant } from '@/lib/auth';
import ReferralsScreen from '@/components/bot/ReferralsScreen';

export const dynamic = 'force-dynamic';

export default async function BotReferralsPage() {
  const tenant = await getBotTenant();
  if (!tenant) redirect('/bot');
  return <ReferralsScreen />;
}
