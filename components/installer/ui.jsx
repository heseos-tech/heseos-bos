'use client';
// Installer app chrome: session gate, bottom nav, shell. Everything else is the Partner app's own
// generic pieces (components/partner/ui.jsx + icons.jsx) — an installation partner IS a partner
// (partners.type === 'installer'), so referral links, QR codes, lead punching, bank details and
// payouts are the exact same screens, re-based under /installer via AppBaseContext.
import { useRef } from 'react';
import Link from 'next/link';
import {
  useNavHeightVar, useDashboardTab, useDashboardTabState, DashboardTabContext, SessionContext, useSessionGate,
  AppBaseContext, usePartnerSession,
} from '@/components/partner/ui';
import { IconHome, IconUser, IconPlus, IconWallet } from '@/components/partner/icons';
import { IconOrders } from '@/components/admin/icons';
import SplashScreen from '@/components/partner/SplashScreen';

export const INSTALLER_BASE = '/installer';
export const useInstallerSession = usePartnerSession;

const NAV_ITEMS = [
  { tab: 'home', href: '/installer/home', label: 'Home', icon: IconHome },
  { tab: 'jobs', href: '/installer/home?tab=jobs', label: 'Jobs', icon: IconOrders, shift: 'left' },
  { href: '/installer/leads/new', label: 'Add Lead', icon: IconPlus, center: true },
  { tab: 'earnings', href: '/installer/home?tab=earnings', label: 'Earnings', icon: IconWallet, shift: 'right' },
  { tab: 'profile', href: '/installer/home?tab=profile', label: 'Profile', icon: IconUser },
];

const shiftClass = (i) => (i.shift === 'left' ? ' hp-nav-item--shift-left' : i.shift === 'right' ? ' hp-nav-item--shift-right' : '');

export function InstallerBottomNav() {
  const { tab, setTab, isHome, homePath } = useDashboardTab();
  const activeTab = isHome ? tab : null;
  const navRef = useRef(null);
  useNavHeightVar(navRef);
  return (
    <nav ref={navRef} className="hp-bottom-nav">
      {NAV_ITEMS.map((item) => {
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
        if (isHome) {
          return (
            <button
              key={item.tab}
              type="button"
              className={`hp-nav-item${active ? ' active' : ''}${shiftClass(item)}`}
              onClick={() => {
                setTab(item.tab);
                window.history.replaceState(null, '', item.tab === 'home' ? homePath : `${homePath}?tab=${item.tab}`);
              }}
            >
              <Icon size={21} />
              <span>{item.label}</span>
            </button>
          );
        }
        return (
          <Link key={item.tab} href={item.href} className={`hp-nav-item${active ? ' active' : ''}${shiftClass(item)}`}>
            <Icon size={21} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function InstallerAppShell({ children }) {
  const tabState = useDashboardTabState('/installer/home');
  const session = useSessionGate({
    authEndpoint: '/api/auth/partner',
    userKey: 'partner',
    loginHref: '/installer/login',
    // Other kinds of partner belong in the regular Partner app.
    resolveRedirect: (partner) => (partner && partner.type !== 'installer' ? '/partner/home' : null),
  });
  const ready = session.status === 'authenticated';
  return (
    <AppBaseContext.Provider value={INSTALLER_BASE}>
      <DashboardTabContext.Provider value={tabState}>
        <SessionContext.Provider value={session}>
          <div className="hp-shell">
            <SplashScreen />
            {ready ? (
              <div className="hp-shell-scroll">{children}</div>
            ) : (
              <div className="hp-shell-scroll"><div className="hp-empty"><div className="hp-empty-sub">Loading…</div></div></div>
            )}
            <InstallerBottomNav />
          </div>
        </SessionContext.Provider>
      </DashboardTabContext.Provider>
    </AppBaseContext.Provider>
  );
}
