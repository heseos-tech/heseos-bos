'use client';
// Team-app-only chrome: bottom nav + shell. Everything else (buttons, fields, badges, avatar,
// screen header, section head) is generic and shared straight from the Partner app's
// components/partner/ui.jsx — no need to fork it.
import { useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { IconHome, IconLeads, IconUser, IconPlus, IconGift } from '@/components/partner/icons';
import { useNavHeightVar } from '@/components/partner/ui';
import SplashScreen from '@/components/partner/SplashScreen';

// Home/Leads/Profile all point at the SAME route (/team/home) with a different ?tab= — see
// components/team/TeamHome.jsx. `tab` here must match TeamHome's switch cases exactly. Add Lead
// is deliberately its own real route (a wizard, not a dashboard tab) rendered as a center FAB —
// same pattern as the Partner app's own NAV_ITEMS/BottomNav (components/partner/ui.jsx), which
// this is intentionally kept in sync with. Sales engineers treat every lead as a demo they run,
// so their nav says "Demo" instead of "Leads" — presales keeps "Leads" unchanged.
function navItemsFor(role) {
  const isSE = role === 'sales_engineer';
  return [
    { tab: 'home', href: '/team/home', label: 'Home', icon: IconHome },
    { tab: 'leads', href: '/team/home?tab=leads', label: isSE ? 'Demo' : 'Leads', icon: IconLeads },
    { href: '/team/leads/new', label: 'Add Lead', icon: IconPlus, center: true },
    { tab: 'rewards', href: '/team/home?tab=rewards', label: 'Rewards', icon: IconGift },
    { tab: 'profile', href: '/team/home?tab=profile', label: 'Profile', icon: IconUser },
  ];
}

// Fixed-positioned (not a flex sibling of the scroll area) so it's pinned to the literal
// bottom of the viewport like a native tab bar — see .hp-bottom-nav in partner-app.css.
// useNavHeightVar publishes its real rendered height as --hp-nav-h so .hp-shell-scroll can
// reserve exactly enough space for it (shared with the Partner app's BottomNav).
export function TeamBottomNav({ role }) {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') || 'home';
  const navRef = useRef(null);
  useNavHeightVar(navRef);
  const items = navItemsFor(role);
  return (
    <nav ref={navRef} className="hp-bottom-nav">
      {items.map((item) => {
        const Icon = item.icon;
        if (item.center) {
          return (
            <Link key={item.href} href={item.href} className="hp-nav-center">
              <span className="hp-nav-center-btn"><Icon size={22} /></span>
              <span className="hp-nav-center-label">{item.label}</span>
            </Link>
          );
        }
        const active = item.tab === activeTab;
        return (
          <Link key={item.tab} href={item.href} className={`hp-nav-item${active ? ' active' : ''}`}>
            <Icon size={21} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function TeamAppShell({ children, role }) {
  return (
    <div className="hp-shell">
      <SplashScreen />
      <div className="hp-shell-scroll">{children}</div>
      <TeamBottomNav role={role} />
    </div>
  );
}
