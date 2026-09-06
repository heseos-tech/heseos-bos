import LeadDetailClient from '@/components/partner/LeadDetailClient';

// Just unwraps the route param — no auth/DB work happens here any more (that used to be
// `await getPartner()` then `await dbGetById(...)` sequentially, blocking the page on two DB
// round trips before any HTML shipped). LeadDetailClient fetches from the existing
// /api/leads/[id] route instead, which already enforces the same auth + ownership check
// server-side — see components/partner/LeadDetailClient.jsx.
export default async function PartnerLeadDetailPage({ params }) {
  const { id } = await params;
  return <LeadDetailClient id={id} />;
}
