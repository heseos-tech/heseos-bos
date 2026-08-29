import { notFound } from 'next/navigation';
import { getPartner } from '@/lib/auth';
import { dbGetById } from '@/lib/db';
import LeadDetailScreen from '@/components/partner/LeadDetailScreen';

export const dynamic = 'force-dynamic';

export default async function PartnerLeadDetailPage({ params }) {
  const { id } = await params;
  const partner = await getPartner();
  const lead = await dbGetById('leads', id);
  if (!lead || lead.partnerId !== partner.id) notFound();
  return <LeadDetailScreen lead={lead} />;
}
