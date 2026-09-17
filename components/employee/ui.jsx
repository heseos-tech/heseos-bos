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
import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  IconLeads, IconDemo, IconReports, IconSettings, IconPhone, IconChevronDown, IconArrowUp,
  IconQrCode, IconLink, IconProducts,
  IconMore,
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

// Real brand/source artwork (provided by the team, /public/icons/sources) rather than
// hand-drawn approximations — Meta/WhatsApp/Google keep their real brand colors so they stay
// instantly recognizable, while Website/Partner App/Employee App (no brand of their own) are
// recolored to the app's own ink+orange palette (see admin.css's --adm-ink/--adm-orange) so
// they read as part of this UI rather than a random stock icon. Each is a small (p) => <img>
// component with the same {size} prop shape as the SVG icons in components/admin/icons.jsx,
// so call sites like `<SourceIcon size={14} />` don't need to know which kind they got.
const srcIcon = (file) => (p) => (
  // eslint-disable-next-line @next/next/no-img-element -- tiny fixed-size decorative icon, not worth next/image's overhead here
  <img src={`/icons/sources/${file}`} alt="" width={p?.size || 16} height={p?.size || 16} style={{ display: 'block', objectFit: 'contain' }} />
);
const IconSrcWebsite = srcIcon('website.png');
const IconSrcMeta = srcIcon('meta.png');
const IconSrcWhatsApp = srcIcon('whatsapp.png');
const IconSrcGoogle = srcIcon('google.png');
const IconSrcPartner = srcIcon('partner.png');
const IconSrcEmployee = srcIcon('employee.png');

const SOURCE_ICON = {
  website_api: IconSrcWebsite,
  meta_lead_form: IconSrcMeta,
  google_ads_lead_form: IconSrcGoogle,
  partner_app: IconSrcPartner,
  employee_app: IconSrcEmployee,
  whatsapp_bot: IconSrcWhatsApp,
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


// Source filter dropdown (toolbar) — same collapse as sourceLabelFor above, so the filter
// options match what the Source column actually shows: a QR code is filterable as "WhatsApp
// QR" regardless of whether it's qr_partner or qr_location underneath, same idea for referral
// links. 'all', 'qr' and 'referral' are the only synthetic (non-real-source) values.
export const SOURCE_FILTER_OPTIONS = Object.entries(LEAD_SOURCES)
  .filter(([k]) => !['qr_partner', 'qr_location', 'referral_partner', 'referral_customer'].includes(k))
  .map(([v, l]) => ({ v, l }))
  .concat([{ v: 'qr', l: 'WhatsApp QR' }, { v: 'referral', l: 'WhatsApp Referral' }]);

export function matchesSourceFilter(l, filterValue) {
  if (!filterValue || filterValue === 'all') return true;
  const s = l.source || 'manual_entry';
  if (filterValue === 'qr') return isQrKind(s);
  if (filterValue === 'referral') return s === 'referral_partner' || s === 'referral_customer';
  return s === filterValue;
}

// Row actions collapsed into a single "⋯" trigger + dropdown — a row that showed 4-5 chip
// buttons at once (Not Picked / Not Interested / Follow-up / Schedule Demo / Timeline) ate a
// third of the table's width per row. `primary` (if given) stays a normal visible button next
// to the trigger — the one action worth one click, not two — and everything else, `items`,
// lives in the dropdown. Reuses .adm-user-menu (already built for AdminShell's own user
// dropdown in components/admin/ui.jsx) rather than introducing new CSS. Only one row's menu
// is ever open at a time — `openId`/`rowId`/`onToggle` are lifted to the table's own state so
// opening one row's menu closes whichever other row had one open.
export function RowActionsMenu({ rowId, openId, onToggle, primary, items }) {
  const open = openId === rowId;
  const ref = useRef(null);

  // Close on an outside click (but not on the trigger itself, which toggles) — without this,
  // several rows' menus could end up visually stacking as you click around the table.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onToggle(null);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open, onToggle]);

  return (
    <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
      {primary && <button className="chip-btn primary" onClick={primary.onClick} disabled={primary.disabled}>{primary.label}</button>}
      {items && items.length > 0 && (
        <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
          <button className="adm-icon-btn" style={{ width: 30, height: 30 }} onClick={() => onToggle(open ? null : rowId)}><IconMore size={16} /></button>
          {open && (
            <div className="adm-user-menu" style={{ minWidth: 170 }}>
              {items.map((it, i) => (
                <button key={i} onClick={() => { it.onClick(); onToggle(null); }} style={it.danger ? { color: '#C0392B' } : undefined}>{it.label}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
