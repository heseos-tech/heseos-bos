import { Suspense } from 'react';
import { InstallerAppShell } from '@/components/installer/ui';

// Client-side session check (see components/partner/ui.jsx's useSessionGate) — same reasoning as
// the Partner and Team app layouts: no server round trip before the shell can paint.
export default function InstallerAppLayout({ children }) {
  return (
    <div className="hp-root">
      <Suspense fallback={null}>
        <InstallerAppShell>{children}</InstallerAppShell>
      </Suspense>
    </div>
  );
}
