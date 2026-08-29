import { redirect } from 'next/navigation';

// This tab now lives on the single /team/home page (see components/team/TeamHome.jsx) so
// switching tabs never refetches data. This route stays only so old bookmarks/links keep
// working.
export default function TeamProfileLegacyRedirect() {
  redirect('/team/home?tab=profile');
}
