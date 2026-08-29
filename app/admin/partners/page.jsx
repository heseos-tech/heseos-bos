import { redirect } from 'next/navigation';

// This section now lives on the single /admin page (see components/admin/AdminHome.jsx) so
// switching tabs never refetches data. This route stays only so old bookmarks/links to
// /admin/partners keep working.
export default function AdminLegacyRedirect() {
  redirect('/admin?tab=partners');
}
