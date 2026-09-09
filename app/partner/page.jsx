'use client';
// The bare /partner hero/onboarding screen — also the exact URL Capacitor's server.url loads
// on every cold app open (see capacitor.config.ts). It used to be a server component that did
// `await getPartner()` before rendering ANYTHING, so a returning (already-logged-in) partner's
// cold launch paid for: this page's DB round trip, a server redirect to /partner/home, then
// THAT page's own DB round trip — two sequential auth checks before any HTML shipped, on top
// of whatever Vercel cold-start cost. Ported from the MARG Mitra app's pattern instead: render
// nothing (a lightweight check) first, THEN decide — no server-side gate blocking the shell.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function PartnerOnboardingPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/partner', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { authenticated: false }))
      .then((data) => {
        if (cancelled) return;
        if (data && data.authenticated) {
          router.replace('/partner/home');
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

  // Nothing to show yet while we check — a signed-in partner never sees this hero flash by
  // before being sent on to /partner/home; a guest sees it appear the moment the (fast, local)
  // check comes back negative.
  if (checking) return <div className="hp-root" />;

  return (
    <div className="hp-root">
      <div className="hp-hero">
        <div className="hp-hero-bg" style={{ backgroundImage: "url('/Home-Screen.webp')" }} />
        <div className="hp-hero-scrim" />
        <div className="hp-hero-content">
          <img src="/brand/lockup-white.png" alt="Heseos — Lighting Ahead" className="hp-brand-logo" />

          <div className="hp-hero-top">
            <h1 className="hp-h1">Smart Homes<br />Start with <span className="hp-accent-text">You</span></h1>
            <p className="hp-sub">Punch leads. Earn rewards.<br />Power the future of smart living.</p>
          </div>

          <div>
            <Link href="/partner/login" className="hp-btn hp-btn-primary hp-btn-block">Login</Link>
            <div style={{ height: 12 }} />
            <Link href="/partner/signup" className="hp-btn hp-btn-outline hp-btn-block">Sign Up</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
