import { redirect } from 'next/navigation';
import { getBotTenant } from '@/lib/auth';
import ContactsScreen from '@/components/bot/ContactsScreen';

export const dynamic = 'force-dynamic';

export default async function BotContactsPage() {
  const tenant = await getBotTenant();
  if (!tenant) redirect('/bot');
  return <ContactsScreen />;
}
