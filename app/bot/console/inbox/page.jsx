import { redirect } from 'next/navigation';
import { getBotTenant } from '@/lib/auth';
import InboxScreen from '@/components/bot/InboxScreen';

export const dynamic = 'force-dynamic';

export default async function BotInboxPage() {
  const tenant = await getBotTenant();
  if (!tenant) redirect('/bot');
  const { password, ...safeTenant } = tenant;
  return <InboxScreen tenant={safeTenant} />;
}
