'use client';
// Team-app-only chrome: bottom nav + shell. Everything else (buttons, fields, badges, avatar,
// screen header, section head) is generic and shared straight from the Partner app's
// components/partner/ui.jsx — no need to fork it.
import { useRef, useContext } from 'react';
import Link from 'next/link';
import { IconHome, IconLeads, IconUser, IconPlus, IconGift } from '@/components/partner/icons';
import { useNavHeightVar, useDashboardTab, useDashboardTabState, DashboardTabContext, SessionContext, useSessionGate } from '@/components/partner/ui';
import SplashScreen from '@/components/partner/SplashScreen';

// Home/Leads/Profile all point at the SAME route (/team/home) with a different ?tab= — see
// components/team/TeamHome.jsx. `tab` here must match TeamHome's switch cases exactly. Add Lead
// is deliberately its own real route (a wizard, not a dashboard tab) rendered as a center FAB —
// same pattern as the Partner app's own NAV_ITEMS/BottomNav (components/partner/ui.jsx), which
// this is intentionally kept in sync with. Sales engineers treat every lead as a demo they run,
// so their nav says "Demo" instead of "Leads" — presales keeps "Leads" unchanged.
// Team app puts an employee (not a partner) in the shared SessionContext — see
// components/partner/ui.jsx's SessionContext/useSessionGate for the mechanism itself.
export function useEmployeeSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useEmployeeSession must be used inside TeamAppShell');
  return ctx.user;
}

// Small per-item visual nudge so the icons either side of the center "Add Lead" circle
// don't read as crowded against it — mirrors the Partner app's own navItemShiftClass
// (components/partner/ui.jsx) and the .hp-nav-item--shift-left/-right rules in
// partner-app.css, which both apps share.
function navItemShiftClass(item) {
  if (item.tab === 'leads') return ' hp-nav-item--shift-left';
  if (item.tab === 'rewards') return ' hp-nav-item--shift-right';
  return '';
}

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
// See components/partner/ui.jsx's DashboardTabContext/useDashboardTabState comment for why
// this doesn't just use <Link> for every item — the short version: /team/home is force-dynamic
// (its layout reads cookies() to authenticate), so a real Next.js navigation on every tab tap
// re-ran that auth check from scratch before the tab could even switch. Home/Leads/Rewards/
// Profile now flip client-side with zero network calls instead.
export function TeamBottomNav() {
  const { role } = useEmployeeSession() || {};
  const { tab, setTab, isHome, homePath } = useDashboardTab();
  const activeTab = isHome ? tab : null;
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
        if (isHome) {
          return (
            <button
              key={item.tab}
              type="button"
              className={`hp-nav-item${active ? ' active' : ''}${navItemShiftClass(item)}`}
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
          <Link key={item.tab} href={item.href} className={`hp-nav-item${active ? ' active' : ''}${navItemShiftClass(item)}`}>
            <Icon size={21} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function TeamAppShell({ children }) {
  const tabState = useDashboardTabState('/team/home');
  const session = useSessionGate({
    authEndpoint: '/api/auth/employee',
    userKey: 'employee',
    loginHref: '/team/login',
    resolveRedirect: (employee) => {
      if (employee.role === 'admin') return '/admin';
      if (employee.role !== 'presales' && employee.role !== 'sales_engineer') return '/team/login';
      return null;
    },
  });
  const ready = session.status === 'authenticated';
  return (
    <DashboardTabContext.Provider value={tabState}>
      <SessionContext.Provider value={session}>
        <div className="hp-shell">
          <SplashScreen />
          {ready ? (
            <div className="hp-shell-scroll">{children}</div>
          ) : (
            <div className="hp-shell-scroll"><div className="hp-empty"><div className="hp-empty-sub">Loading…</div></div></div>
          )}
          <TeamBottomNav />
        </div>
      </SessionContext.Provider>
    </DashboardTabContext.Provider>
  );
}
