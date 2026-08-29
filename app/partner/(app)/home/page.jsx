import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getPartner } from '@/lib/auth';
import PartnerHome from '@/components/partner/PartnerHome';

export const dynamic = 'force-dynamic';

// The single Partner-app route — Home, Leads, Rewards and Profile all render inside PartnerHome
// now, switched by ?tab= instead of a separate page each. See components/partner/PartnerHome.jsx.
export default async function PartnerHomePage() {
  const partner = await getPartner();
  if (!partner) redirect('/partner/login');
  return (
    <Suspense fallback={null}>
      <PartnerHome partner={partner} />
    </Suspense>
  );
}
