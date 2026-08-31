// components/admin/ui.jsx — shared primitives for the admin dashboard: shell (sidebar +
// topbar), stat cards, chart pieces (donut / horizontal funnel), status badge, pagination
// and a small modal wrapper. Mirrors the components/partner/ui.jsx convention.
'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  IconDashboard, IconLeads, IconPartners, IconSalesEngineer, IconPresales, IconDemo,
  IconQuotation, IconConversions, IconReports, IconPayouts, IconTasks, IconSettings,
  IconSearch, IconBell, IconChevronDown, IconChevronLeft, IconChevronRight, IconArrowUp,
  IconArrowDown, IconX, IconLogout, IconQrCode,
} from './icons';

// Every item points at the SAME route (/admin) with a different ?tab= — see
// components/admin/AdminHome.jsx. `tab` here must match AdminHome's switch cases exactly.
export const NAV_ITEMS = [
  { tab: 'dashboard', href: '/admin', label: 'Dashboard', Icon: IconDashboard },
  { tab: 'leads', href: '/admin?tab=leads', label: 'Leads', Icon: IconLeads },
  { tab: 'partners', href: '/admin?tab=partners', label: 'Partners', Icon: IconPartners },
  { tab: 'sales-engineers', href: '/admin?tab=sales-engineers', label: 'Sales Engineers', Icon: IconSalesEngineer },
  { tab: 'presales', href: '/admin?tab=presales', label: 'Pre-sales', Icon: IconPresales },
  { tab: 'demo-schedule', href: '/admin?tab=demo-schedule', label: 'Demo Schedule', Icon: IconDemo },
  { tab: 'quotations', href: '/admin?tab=quotations', label: 'Quotations', Icon: IconQuotation },
  { tab: 'conversions', href: '/admin?tab=conversions', label: 'Conversions', Icon: IconConversions },
  { tab: 'reports', href: '/admin?tab=reports', label: 'Reports', Icon: IconReports },
  { tab: 'growth', href: '/admin?tab=growth', label: 'QR & Referrals', Icon: IconQrCode },
  { tab: 'payouts', href: '/admin?tab=payouts', label: 'Payouts', Icon: IconPayouts },
  { tab: 'tasks', href: '/admin?tab=tasks', label: 'Tasks', Icon: IconTasks },
  { tab: 'settings', href: '/admin?tab=settings', label: 'Settings', Icon: IconSettings },
];

const ROLE_LABEL = { admin: 'Super Admin', presales: 'Pre-Sales', sales_engineer: 'Sales Engineer' };

export function AdminShell({ employee, children }) {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') || 'dashboard';
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [userMenu, setUserMenu] = useState(false);

  async function logout() {
    await fetch('/api/auth/employee', { method: 'DELETE' });
    router.push('/employee/login');
    router.refresh();
  }

  return (
    <div className={`adm-root${collapsed ? ' adm-collapsed' : ''}`}>
      <aside className="adm-sidebar">
        <Link href="/admin" className="adm-sidebar-brand">
          <Image src="/brand/lockup-navy.png" alt="Heseos" width={282} height={64} className="adm-sidebar-logo adm-sidebar-logo-full" />
          <Image src="/brand/icon.png" alt="Heseos" width={64} height={64} className="adm-sidebar-logo adm-sidebar-logo-icon" />
        </Link>

        <nav className="adm-nav">
          {NAV_ITEMS.map((item) => {
            const active = item.tab === activeTab;
            return (
              <Link key={item.tab} href={item.href} className={`adm-nav-link${active ? ' active' : ''}`}>
                <item.Icon size={18} />
                <span className="adm-nav-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <button className="adm-collapse-btn" onClick={() => setCollapsed((v) => !v)}>
          <IconChevronLeft size={14} />
          <span className="adm-nav-label">Collapse</span>
        </button>
      </aside>

      <div className="adm-main">
        <header className="adm-topbar">
          <div className="adm-search">
            <IconSearch size={17} />
            <input placeholder="Search leads, customers, partners…" />
          </div>
          <div className="adm-topbar-right">
            <button className="adm-icon-btn" aria-label="Notifications"><IconBell size={19} /></button>
            <div className="adm-user" onClick={() => setUserMenu((v) => !v)}>
              <span className="adm-user-avatar">{(employee.name || employee.email || '?').charAt(0).toUpperCase()}</span>
              <span className="adm-user-info">
                <span className="adm-user-name">{employee.name || employee.email}</span>
                <span className="adm-user-role">{ROLE_LABEL[employee.role] || employee.role}</span>
              </span>
              <IconChevronDown size={14} />
              {userMenu && (
                <div className="adm-user-menu" onClick={(e) => e.stopPropagation()}>
                  <button onClick={logout}><IconLogout size={15} /> Log out</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="adm-content">{children}</main>
      </div>
    </div>
  );
}

export function StatCard({ label, value, delta, Icon, tone = 'orange' }) {
  return (
    <div className="adm-stat-card">
      <span className={`adm-stat-icon adm-stat-icon--${tone}`}><Icon size={19} /></span>
      <div className="adm-stat-label">{label}</div>
      <div className="adm-stat-value">{value}</div>
      {delta != null && (
        <div className={`adm-stat-delta${delta < 0 ? ' down' : ''}`}>
          {delta < 0 ? <IconArrowDown size={12} /> : <IconArrowUp size={12} />}
          {Math.abs(delta)}% <span className="adm-stat-delta-sub">vs last 7 days</span>
        </div>
      )}
    </div>
  );
}

// Horizontal-bar funnel — single sequential hue (dark → light) with the terminal "Converted"
// stage picked out in the brand accent, per the ordinal-ramp guidance in the dataviz skill.
const FUNNEL_HUES = ['#0d366b', '#184f95', '#256abf', '#3987e5', '#6da7ec', '#ff7a00'];
export function Funnel({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="adm-funnel">
      {rows.map((r, i) => (
        <div className="adm-funnel-row" key={r.key}>
          <span className="adm-funnel-label">{r.label}</span>
          <div className="adm-funnel-track">
            <div className="adm-funnel-bar" style={{ width: `${Math.max(4, (r.count / max) * 100)}%`, background: FUNNEL_HUES[i % FUNNEL_HUES.length] }} />
          </div>
          <span className="adm-funnel-count">{r.count.toLocaleString('en-IN')}</span>
          <span className="adm-funnel-pct">{r.pct}%</span>
        </div>
      ))}
    </div>
  );
}

// Donut chart — plain SVG, stroke-dasharray segments. Legend carries the label + % + count
// so identity is never color-alone.
export function Donut({ rows, centerLabel }) {
  const total = rows.reduce((s, r) => s + r.count, 0) || 1;
  const R = 15.9155; // circumference ≈ 100 at this radius, so dasharray can be read as %
  let offset = 0;
  return (
    <div className="adm-donut-wrap">
      <svg viewBox="0 0 36 36" className="adm-donut">
        <circle cx="18" cy="18" r={R} fill="none" stroke="var(--adm-border)" strokeWidth="4.2" />
        {rows.map((r) => {
          const pct = (r.count / total) * 100;
          const el = (
            <circle
              key={r.key}
              cx="18" cy="18" r={R} fill="none" stroke={r.color} strokeWidth="4.2"
              strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={-offset}
              strokeLinecap="butt" transform="rotate(-90 18 18)"
            />
          );
          offset += pct;
          return el;
        })}
      </svg>
      <div className="adm-donut-center">
        <span className="adm-donut-total">{total.toLocaleString('en-IN')}</span>
        <span className="adm-donut-sub">{centerLabel}</span>
      </div>
    </div>
  );
}

export function DonutLegend({ rows }) {
  return (
    <div className="adm-legend">
      {rows.map((r) => (
        <div className="adm-legend-row" key={r.key}>
          <span className="adm-legend-dot" style={{ background: r.color }} />
          <span className="adm-legend-label">{r.label}</span>
          <span className="adm-legend-pct">{r.pct}%</span>
          <span className="adm-legend-count">{r.count}</span>
        </div>
      ))}
    </div>
  );
}

export function StatusBadge({ status }) {
  return <span className="adm-badge" style={{ color: status.c, background: status.bg }}><span className="adm-badge-dot" style={{ background: status.c }} />{status.label}</span>;
}

export function PerformanceTag({ tag }) {
  return <span className={`adm-perf adm-perf--${tag.tone}`}>{tag.label}</span>;
}

export function Pagination({ page, pageCount, total, pageSize, onPage }) {
  if (pageCount <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter((p) => p === 1 || p === pageCount || Math.abs(p - page) <= 1);
  return (
    <div className="adm-pagination">
      <span className="adm-pagination-info">Showing {from} to {to} of {total.toLocaleString('en-IN')}</span>
      <div className="adm-pagination-controls">
        <button disabled={page === 1} onClick={() => onPage(page - 1)}><IconChevronLeft size={15} /></button>
        {pages.map((p, i) => (
          <span key={p}>
            {i > 0 && pages[i - 1] !== p - 1 && <span className="adm-pagination-ellipsis">…</span>}
            <button className={p === page ? 'active' : ''} onClick={() => onPage(p)}>{p}</button>
          </span>
        ))}
        <button disabled={page === pageCount} onClick={() => onPage(page + 1)}><IconChevronRight size={15} /></button>
      </div>
    </div>
  );
}

export function Modal({ title, sub, onClose, children }) {
  return (
    <div className="adm-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="adm-modal-card">
        <div className="adm-modal-head">
          <div>
            <div className="adm-modal-title">{title}</div>
            {sub && <div className="adm-modal-sub">{sub}</div>}
          </div>
          <button className="adm-icon-btn" onClick={onClose}><IconX size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
