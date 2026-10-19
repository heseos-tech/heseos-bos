import LeadDetailClient from '@/components/partner/LeadDetailClient';

export default async function InstallerLeadDetailPage({ params }) {
  const { id } = await params;
  return <LeadDetailClient id={id} />;
}
