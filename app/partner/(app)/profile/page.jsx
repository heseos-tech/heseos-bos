import { getPartner } from '@/lib/auth';
import ProfileScreen from '@/components/partner/ProfileScreen';

export const dynamic = 'force-dynamic';

export default async function PartnerProfilePage() {
  const partner = await getPartner();
  return <ProfileScreen partner={partner} />;
}
