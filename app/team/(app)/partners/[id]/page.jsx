import PartnerDashboardClient from '@/components/team/PartnerDashboardClient';

// Just unwraps the route param — same pattern as ../../leads/[id]/page.jsx. The client component
// fetches /api/team/partners (already scoped server-side to the signed-in employee's own
// onboarded partners) and shows "couldn't be found" for any id outside that list.
export default async function TeamPartnerDashboardPage({ params }) {
  const { id } = await params;
  return <PartnerDashboardClient id={id} />;
}
