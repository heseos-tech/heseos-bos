import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getPartner } from '@/lib/auth';
import { AppShell } from '@/components/partner/ui';

export default async function PartnerAppLayout({ children }) {
  const partner = await getPartner();
  if (!partner) redirect('/partner/login');

  // AppShell's bottom nav reads ?tab= (useSearchParams) to highlight the active tab, which
  // Next.js requires to sit inside a Suspense boundary.
  return (
    <div className="hp-root">
      <Suspense fallback={null}>
        <AppShell>{children}</AppShell>
      </Suspense>
    </div>
  );
}
