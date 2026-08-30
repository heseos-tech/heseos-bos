import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getEmployee } from '@/lib/auth';

// Bare /team (also the PWA start_url) — a first-time hero screen, same shape as the Partner
// app's app/partner/page.jsx, so opening the app for the first time (or installing the PWA)
// feels like a native app rather than a link into the desktop /employee dashboards. Already
// logged in? Skip straight past it.
export default async function TeamRootPage() {
  const employee = await getEmployee();
  if (employee) {
    if (employee.role === 'admin') redirect('/admin');
    redirect('/team/home');
  }

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
