import { redirect } from 'next/navigation';
import { getBotTenant } from '@/lib/auth';
import ConfigScreen from '@/components/bot/ConfigScreen';

export const dynamic = 'force-dynamic';

export default async function BotConfigurationPage() {
  const tenant = await getBotTenant();
  if (!tenant) redirect('/bot');
  const { password, ...safeTenant } = tenant;
  return <ConfigScreen tenant={safeTenant} />;
}
