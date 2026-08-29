import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getPartner } from '@/lib/auth';

export default async function PartnerOnboardingPage() {
  const partner = await getPartner();
  if (partner) redirect('/partner/home');

  return (
    <div className="hp-root">
      <div className="hp-hero">
        <div className="hp-hero-bg" style={{ backgroundImage: "url('/Home-Screen.png')" }} />
        <div className="hp-hero-scrim" />
        <div className="hp-hero-content">
          <div className="hp-brand">
            <span className="hp-brand-mark">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M4 14a8 8 0 0 1 16 0" /><path d="M7 17.2a5 5 0 0 1 10 0" /><circle cx="12" cy="20" r="1.4" fill="#fff" stroke="none" /></svg>
            </span>
            <div className="hp-brand-text">
              <span className="hp-brand-name">HESEOS</span>
              <span className="hp-brand-tag">Lighting Ahead</span>
            </div>
          </div>

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
