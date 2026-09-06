import LeadDetailClient from '@/components/team/LeadDetailClient';

// Just unwraps the route param — no auth/DB work happens here any more (that used to be
// `await getEmployee()` then `await dbGetById(...)` sequentially, blocking the page on two DB
// round trips before any HTML shipped). LeadDetailClient fetches from the existing
// /api/leads/[id] route instead and re-applies the same visibility rule client-side — see
// components/team/LeadDetailClient.jsx.
export default async function TeamLeadDetailPage({ params }) {
  const { id } = await params;
  return <LeadDetailClient id={id} />;
}
