'use client';
// Bare /team (also the PWA start_url) — a first-time hero screen, same shape as the Partner
// app's app/partner/page.jsx (see that file for why this is a client-side check instead of a
// server-side `await getEmployee()` gate: it used to block this page's own render AND the
// redirect target's render on two sequential DB round trips before any HTML shipped).
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function TeamRootPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/employee', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { authenticated: false }))
      .then((data) => {
        if (cancelled) return;
        const employee = data && data.authenticated ? data.employee : null;
        if (employee) {
          router.replace(employee.role === 'admin' ? '/admin' : '/team/home');
          return;
        }
        setChecking(false);
      })
      .catch(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (checking) return <div className="hp-root" />;

  return (
    <div className="hp-root">
      <div className="hp-hero">
        <div className="hp-hero-bg" style={{ backgroundImage: "url('/Home-Screen.webp')" }} />
        <div className="hp-hero-scrim" />
        <div className="hp-hero-content">
          <img src="/brand/lockup-white.png" alt="Heseos — Lighting Ahead" className="hp-brand-logo" />

          <div className="hp-hero-top">
            <h1 className="hp-h1">Your Leads.<br />On <span className="hp-accent-text">The Go</span>.</h1>
            <p className="hp-sub">Work your assigned leads, schedule demos, send quotations, and close deals — right from your phone.</p>
          </div>

          <div>
            <Link href="/team/login" className="hp-btn hp-btn-primary hp-btn-block">Login</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
