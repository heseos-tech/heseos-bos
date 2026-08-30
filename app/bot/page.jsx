import { redirect } from 'next/navigation';
import { getBotTenant } from '@/lib/auth';
import LoginMarketing from '@/components/bot/LoginMarketing';

// The Heseos Bot platform's front door — marketing + login, split-screen (see the MARG
// reference screenshots). Already-signed-in tenants skip straight to their console.
export default async function BotLandingPage() {
  const tenant = await getBotTenant();
  if (tenant) redirect('/bot/console/inbox');
  return <LoginMarketing />;
}
