import { getPartner } from '@/lib/auth';
import { dbWhere } from '@/lib/db';
import { earningsFor } from '@/lib/partnerMock';
import DashboardScreen from '@/components/partner/DashboardScreen';

export const dynamic = 'force-dynamic';

export default async function PartnerHomePage() {
  const partner = await getPartner();
  const leads = await dbWhere('leads', 'partnerId', partner.id);
  const earnings = earningsFor(leads);
  return <DashboardScreen partner={partner} leads={leads} earnings={earnings} />;
}
