import { redirect } from 'next/navigation';

// This section now lives on the single /partner/home page (see
// components/partner/PartnerHome.jsx) so switching tabs never refetches data. This route stays
// only so old bookmarks/links to /partner/leads keep working.
export default function PartnerLeadsPage() {
  redirect('/partner/home?tab=leads');
}
