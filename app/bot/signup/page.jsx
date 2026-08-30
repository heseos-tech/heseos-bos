import { redirect } from 'next/navigation';
import { getBotTenant } from '@/lib/auth';
import SignupWizard from '@/components/bot/SignupWizard';

export default async function BotSignupPage() {
  const tenant = await getBotTenant();
  if (tenant) redirect('/bot/console/inbox');
  return <SignupWizard />;
}
