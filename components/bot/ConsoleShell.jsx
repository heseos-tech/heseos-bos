'use client';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { IconInbox, IconUsers, IconLeads, IconShare, IconSettings, IconBell, IconHelp, IconLogout } from './icons';
import { Avatar } from './ui';

const NAV_ITEMS = [
  { href: '/bot/console/inbox', label: 'Inbox', icon: IconInbox },
  { href: '/bot/console/contacts', label: 'Contacts', icon: IconUsers },
  { href: '/bot/console/leads', label: 'Leads', icon: IconLeads },
  { href: '/bot/console/referrals', label: 'Referrals', icon: IconShare },
  { href: '/bot/console/bot-configuration', label: 'Bot Configuration', icon: IconSettings },
];

export default function ConsoleShell({ tenant, children }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/bot', { method: 'DELETE' });
    router.push('/bot');
    router.refresh();
  }

  return (
    <div className="bc-root bc-shell" style={{ '--bc-accent': tenant.brandColor || '#14b8a6' }}>
      <aside className="bc-sidebar">
        <div className="bc-sidebar-brand">
          <div className="bc-sidebar-mark">{(tenant.businessName || 'H').charAt(0).toUpperCase()}</div>
          <div>
            <div className="bc-sidebar-title">{tenant.businessName}</div>
            <div className="bc-sidebar-sub">Bot Console</div>
          </div>
        </div>

        <nav className="bc-nav">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link key={item.href} href={item.href} className={`bc-nav-item${active ? ' active' : ''}`}>
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="bc-sidebar-foot">
          <Avatar name={tenant.contactName || tenant.businessName} size="sm" />
          <div>
            <div className="bc-sidebar-foot-name">{tenant.contactName || tenant.businessName}</div>
            <div className="bc-sidebar-foot-role">{tenant.status === 'live' ? 'Bot is live' : 'Bot paused'}</div>
          </div>
          <button className="bc-sidebar-logout" onClick={logout} aria-label="Log out"><IconLogout size={17} /></button>
        </div>
      </aside>

      <div className="bc-main">{children}</div>
    </div>
  );
}

export function Topbar({ title }) {
  return (
    <div className="bc-topbar">
      <div className="bc-topbar-title">{title}</div>
      <div className="bc-topbar-right">
        <button className="bc-icon-btn" aria-label="Notifications"><IconBell size={17} /></button>
        <button className="bc-icon-btn" aria-label="Help"><IconHelp size={17} /></button>
      </div>
    </div>
  );
}
