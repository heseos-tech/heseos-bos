'use client';
// Team-app-only chrome: bottom nav + shell. Everything else (buttons, fields, badges, avatar,
// screen header, section head) is generic and shared straight from the Partner app's
// components/partner/ui.jsx — no need to fork it.
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { IconHome, IconLeads, IconUser } from '@/components/partner/icons';

// All three point at the SAME route (/team/home) with a different ?tab= — see
// components/team/TeamHome.jsx. `tab` here must match TeamHome's switch cases exactly.
const NAV_ITEMS = [
  { tab: 'home', href: '/team/home', label: 'Home', icon: IconHome },
  { tab: 'leads', href: '/team/home?tab=leads', label: 'Leads', icon: IconLeads },
  { tab: 'profile', href: '/team/home?tab=profile', label: 'Profile', icon: IconUser },
];

export function TeamBottomNav() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') || 'home';
  return (
    <nav className="hp-bottom-nav">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
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

export function TeamAppShell({ children }) {
  return (
    <div className="hp-shell">
      <div className="hp-shell-scroll">{children}</div>
      <TeamBottomNav />
    </div>
  );
}
