import { redirect } from 'next/navigation';
import { getBotTenant } from '@/lib/auth';
import ConsoleShell from '@/components/bot/ConsoleShell';

export default async function BotConsoleLayout({ children }) {
  const tenant = await getBotTenant();
  if (!tenant) redirect('/bot');
  const { password, ...safeTenant } = tenant;
  return <ConsoleShell tenant={safeTenant}>{children}</ConsoleShell>;
}
