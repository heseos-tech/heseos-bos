import { getPartner } from '@/lib/auth';
import { dbWhere } from '@/lib/db';
import MyLeadsScreen from '@/components/partner/MyLeadsScreen';

export const dynamic = 'force-dynamic';

export default async function PartnerLeadsPage() {
  const partner = await getPartner();
  const leads = await dbWhere('leads', 'partnerId', partner.id);
  return <MyLeadsScreen leads={leads} />;
}
