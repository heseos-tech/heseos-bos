import { Suspense } from 'react';
import { TeamAppShell } from '@/components/team/ui';

// No server-side auth guard here any more (that used to be `await getEmployee()` + role checks
// + redirect, which made this a force-dynamic route and blocked every navigation on a DB round
// trip). TeamAppShell now checks the session client-side — including the admin/presales/
// sales_engineer role routing — and redirects itself if needed. See
// components/team/ui.jsx's TeamAppShell + components/partner/ui.jsx's useSessionGate.
//
// TeamAppShell's bottom nav reads ?tab= (useSearchParams) to highlight the active tab, which
// Next.js requires to sit inside a Suspense boundary.
export default function TeamAppLayout({ children }) {
  return (
    <div className="hp-root">
      <Suspense fallback={null}>
        <TeamAppShell>{children}</TeamAppShell>
      </Suspense>
    </div>
  );
}
