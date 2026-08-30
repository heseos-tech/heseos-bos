import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getPartner } from '@/lib/auth';

export default async function PartnerOnboardingPage() {
  const partner = await getPartner();
  if (partner) redirect('/partner/home');

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
