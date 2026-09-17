'use client';
// components/employee/ui.jsx — shared shell + small helpers for the two "mine only" employee
// dashboards (Pre-sales, Sales Engineer): a sidebar+topbar shell reusing the same .adm-* CSS
// as components/admin/ui.jsx's AdminShell (app/admin/admin.css, imported once for both roles
// by app/employee/layout.jsx) so these two panels read as one visual system with Admin instead
// of their own bespoke look, plus a KPI card with a real "+N vs last 7 days" trend chip
// (lib/adminMetrics.js's windowDelta) and a Source-column attribution helper so a lead sourced
// via the Partner App / Employee App / a QR code / a referral link shows WHO it actually came
// from underneath the channel name — mirroring components/admin/LeadsPage.jsx's own
// attributionInfo(), just folded into the Source cell instead of a separate column (there's
// no room for one at this table's width).
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  IconLeads, IconDemo, IconReports, IconSettings, IconPhone, IconChevronDown, IconArrowUp,
  IconMeta, IconHandshake, IconEmployees, IconWhatsApp, IconQrCode, IconLink, IconProducts,
} from '@/components/admin/icons';
import { LEAD_SOURCES } from '@/lib/formOptions';
import { isQrKind } from '@/lib/attributionConstants';

export const ROLE_LABEL = { presales: 'Pre-Sales', sales_engineer: 'Sales Engineer' };

// Same 5 destinations for both roles. "Follow-ups" and "Demos" aren't separate data views —
// each panel maps them to a preset tab within its own Leads table (see PresalesPanel's
// SECTION_TAB / SalesEngineerPanel's SECTION_TAB), the same "shortcut into a filtered view"
// pattern Admin's own dashboard tiles already use (?tab=leads&bucket=demo).
export const EMPLOYEE_NAV_ITEMS = [
  { key: 'leads', label: 'Leads', Icon: IconLeads },
  { key: 'followups', label: 'Follow-ups', Icon: IconPhone },
  { key: 'demos', label: 'Demos', Icon: IconDemo },
  { key: 'analytics', label: 'Analytics', Icon: IconReports },
  { key: 'settings', label: 'Settings', Icon: IconSettings },
];

export function EmployeeShell({ employee, section, onSection, children }) {
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/employee', { method: 'DELETE' });
    router.push('/employee/login');
    router.refresh();
  }

  return (
    <div className="adm-root">
      <aside className="adm-sidebar">
        <div className="adm-sidebar-brand">
          <Image src="/brand/lockup-navy.png" alt="Heseos" width={282} height={64} className="adm-sidebar-logo adm-sidebar-logo-full" />
        </div>
        <nav className="adm-nav">
          {EMPLOYEE_NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`adm-nav-link${section === item.key ? ' active' : ''}`}
              onClick={() => onSection(item.key)}
            >
              <item.Icon size={18} />
              <span className="adm-nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="adm-main">
        <header className="adm-topbar">
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--adm-ink)' }}>{ROLE_LABEL[employee.role] || 'Team'}</div>
          <div className="adm-topbar-right">
            <div className="adm-user">
              <span className="adm-user-avatar">{(employee.name || employee.email || '?').charAt(0).toUpperCase()}</span>
              <span className="adm-user-info">
                <span className="adm-user-name">{employee.name || employee.email}</span>
                <span className="adm-user-role">{employee.location || ROLE_LABEL[employee.role] || ''}</span>
              </span>
              <IconChevronDown size={14} />
            </div>
            <button className="dash-logout" onClick={logout}>Log out</button>
          </div>
        </header>
        <main className="adm-content">{children}</main>
      </div>
    </div>
  );
}

// KPI card with a raw-count "+N vs last 7 days" / "No change vs last 7 days" trend chip —
// deliberately its own small component rather than reusing components/admin/ui.jsx's
// StatCard, which always renders a % delta ("12% vs last 7 days"); changing StatCard itself
// would ripple into every admin page that already uses it. `deltaValue` is a plain count from
// lib/adminMetrics.js's windowDelta(...).value — never negative (it's "how many arrived in
// the last 7 days"), so there's no down-arrow case to handle.
export function TrendKpiCard({ label, value, deltaValue, Icon }) {
  const flat = !deltaValue;
  return (
    <div className="adm-stat-card">
      <span className="adm-stat-icon adm-stat-icon--orange"><Icon size={19} /></span>
      <div className="adm-stat-label">{label}</div>
      <div className="adm-stat-value">{value}</div>
      <div className="adm-stat-delta" style={flat ? { color: 'var(--adm-text-faint)' } : undefined}>
        {flat ? '—' : <><IconArrowUp size={12} /> +{deltaValue}</>} <span className="adm-stat-delta-sub">{flat ? 'No change vs. last 7 days' : 'vs. last 7 days'}</span>
      </div>
    </div>
  );
}

// Source column: QR Code (Partner)/(Location) collapse to "WhatsApp QR", Referral Link
// (Partner)/(Customer) collapse to "WhatsApp Referral" — same collapse as Admin's LeadsPage,
// so an employee sees the same channel name an admin would for the same lead.
export function sourceLabelFor(l) {
  if (isQrKind(l.source)) return 'WhatsApp QR';
  if (l.source === 'referral_partner' || l.source === 'referral_customer') return 'WhatsApp Referral';
  return LEAD_SOURCES[l.source] || l.source;
}

const SOURCE_ICON = {
  meta_lead_form: IconMeta,
  partner_app: IconHandshake,
  employee_app: IconEmployees,
  whatsapp_bot: IconWhatsApp,
};
export function sourceIconFor(l) {
  if (isQrKind(l.source)) return IconQrCode;
  if (l.source === 'referral_partner' || l.source === 'referral_customer') return IconLink;
  return SOURCE_ICON[l.source] || IconProducts;
}

export function partnerDisplayName(p) {
  return (p && (p.shopName || p.businessName || p.name)) || null;
}

// Who a lead actually came from, underneath the Source cell's channel name — a Partner App /
// QR (Partner) / Referral (Partner) lead resolves to that partner's own shop/business name
// (shopName first, same priority as GrowthPage.jsx's ownerLabel and every other admin-facing
// partner display), an Employee App lead resolves to the colleague who punched it in, a
// placement QR resolves to that link's own label (e.g. "Viman Nagar"), and a customer referral
// resolves to the referring customer's name. Returns null (nothing shown) for a lead with no
// attribution at all (Meta, Google Ads, WhatsApp Direct, manual entry).
export function attributionFor(l, { partners, employees, links, leads }) {
  if (l.partnerId) {
    const p = (partners || []).find((x) => x.id === l.partnerId);
    return p ? partnerDisplayName(p) : null;
  }
  if (l.addedByEmployeeId) {
    const e = (employees || []).find((x) => x.id === l.addedByEmployeeId);
    return e ? e.name : null;
  }
  if (l.attributionKind === 'qr_location' && l.attributionLinkId) {
    const link = (links || []).find((x) => x.id === l.attributionLinkId);
    return link ? (link.label || null) : null;
  }
  if (l.attributionKind === 'referral_customer' && l.referredByLeadId) {
    const ref = (leads || []).find((x) => x.id === l.referredByLeadId);
    return ref ? ref.name : null;
  }
  return null;
}
