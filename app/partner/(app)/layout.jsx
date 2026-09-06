import { Suspense } from 'react';
import { AppShell } from '@/components/partner/ui';

// No server-side auth guard here any more (that used to be `await getPartner()` + redirect,
// which made this a force-dynamic route and blocked every single navigation on a DB round
// trip). AppShell now checks the session client-side and redirects to /partner/login itself if
// it's missing — see components/partner/ui.jsx's useSessionGate for the full reasoning. This
// layout ships as a plain static shell instead.
//
// AppShell's bottom nav reads ?tab= (useSearchParams) to highlight the active tab, which
// Next.js requires to sit inside a Suspense boundary.
export default function PartnerAppLayout({ children }) {
  return (
    <div className="hp-root">
      <Suspense fallback={null}>
        <AppShell>{children}</AppShell>
      </Suspense>
    </div>
  );
}
