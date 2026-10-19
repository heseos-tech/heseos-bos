'use client';
// Bare /installer (also the Installer app's start_url): signed-in installers go straight to their
// jobs, everyone else to the login screen. Client-side check for the same reason as /partner and /team.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function InstallerRootPage() {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/partner', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { authenticated: false }))
      .then((data) => { if (!cancelled) router.replace(data && data.authenticated ? '/installer/home' : '/installer/login'); })
      .catch(() => { if (!cancelled) router.replace('/installer/login'); });
    return () => { cancelled = true; };
  }, [router]);
  return <div className="hp-root" />;
}
