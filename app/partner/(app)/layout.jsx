import { redirect } from 'next/navigation';
import { getPartner } from '@/lib/auth';
import { AppShell } from '@/components/partner/ui';

export default async function PartnerAppLayout({ children }) {
  const partner = await getPartner();
  if (!partner) redirect('/partner/login');

  return (
    <div className="hp-root">
      <AppShell>{children}</AppShell>
    </div>
  );
}
