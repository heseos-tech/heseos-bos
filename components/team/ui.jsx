'use client';
// Team-app-only chrome: bottom nav + shell. Everything else (buttons, fields, badges, avatar,
// screen header, section head) is generic and shared straight from the Partner app's
// components/partner/ui.jsx — no need to fork it.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconHome, IconLeads, IconUser } from '@/components/partner/icons';

const NAV_ITEMS = [
  { href: '/team/home', label: 'Home', icon: IconHome },
  { href: '/team/leads', label: 'Leads', icon: IconLeads },
  { href: '/team/profile', label: 'Profile', icon: IconUser },
];

export function TeamBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="hp-bottom-nav">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(item.href + '/');
        return (
          <Link key={item.href} href={item.href} className={`hp-nav-item${active ? ' active' : ''}`}>
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
