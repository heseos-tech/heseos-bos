import { redirect } from 'next/navigation';
import { getPartner } from '@/lib/auth';
import PartnerDashboard from '@/components/PartnerDashboard';

export default async function PartnerPage() {
  const partner = await getPartner();
  if (!partner) redirect('/partner/login');
  return <PartnerDashboard partner={partner} />;
}
