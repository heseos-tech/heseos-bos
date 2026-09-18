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
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  IconLeads, IconDemo, IconReports, IconSettings, IconPhone, IconChevronDown, IconArrowUp,
  IconQrCode, IconLink, IconProducts,
  IconMore,
} from '@/components/admin/icons';
import { LEAD_SOURCES, TIMELINE, BUDGET_BY_PROPERTY } from '@/lib/formOptions';
import { isQrKind } from '@/lib/attributionConstants';

export const ROLE_LABEL = { presales: 'Pre-Sales', sales_engineer: 'Sales Engineer' };

// Lead Detail modal needs human labels for `timeline` and `budget` too (Interest/Property
// Type already have PI_LABEL/PT_LABEL built locally in each panel from PRODUCT_INTEREST/
// PROPERTY_TYPE) — budget is the odd one out since its options are conditional on propertyType
// (see lib/formOptions.js's BUDGET_BY_PROPERTY), so the lookup has to check the right tier
// rather than a single flat map.
const TIMELINE_LABEL = Object.fromEntries(TIMELINE.map((t) => [t.v, t.l]));
export function timelineLabelFor(lead) {
  return TIMELINE_LABEL[lead?.timeline] || lead?.timeline || '—';
}
export function budgetLabelFor(lead) {
  const tier = BUDGET_BY_PROPERTY[lead?.propertyType] || [];
  const match = tier.find((b) => b.v === lead?.budget);
  return (match && match.l) || lead?.budget || '—';
}

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

// Renders attributionDetailFor()'s result as the "who sourced this lead" block in the Lead
// Detail modal (PresalesPanel/SalesEngineerPanel) — partner leads get BOTH the partner's own
// name and their shop/business name as separate lines (not collapsed into one string like the
// Source column does), since that's the whole point of looking a lead up here.
export function AttributionDetail({ detail }) {
  if (!detail) {
    return <div style={{ fontSize: 13.5, color: 'var(--adm-text-faint)' }}>Direct — no partner, employee or referrer on file.</div>;
  }
  if (detail.kind === 'partner') {
    const p = detail.partner;
    if (!p) return <div style={{ fontSize: 13.5, color: 'var(--adm-text-faint)' }}>Partner record not found.</div>;
    return (
      <div style={{ display: 'grid', gap: 6 }}>
        <div><span className="adm-lead-sub">Partner Name: </span><span style={{ fontSize: 13.5, color: 'var(--adm-ink)', fontWeight: 600 }}>{p.businessName || p.name || '—'}</span></div>
        <div><span className="adm-lead-sub">Partner Business Name: </span><span style={{ fontSize: 13.5, color: 'var(--adm-ink)', fontWeight: 600 }}>{p.shopName || '—'}</span></div>
        {p.phone && <div><span className="adm-lead-sub">Partner Phone: </span><span style={{ fontSize: 13.5, color: 'var(--adm-ink)' }}>{p.phone}</span></div>}
      </div>
    );
  }
  if (detail.kind === 'employee') {
    const e = detail.employee;
    if (!e) return <div style={{ fontSize: 13.5, color: 'var(--adm-text-faint)' }}>Employee record not found.</div>;
    return (
      <div><span className="adm-lead-sub">Added by employee: </span><span style={{ fontSize: 13.5, color: 'var(--adm-ink)', fontWeight: 600 }}>{e.name}</span>{e.role && <span className="adm-lead-sub"> · {ROLE_LABEL[e.role] || e.role}</span>}</div>
    );
  }
  if (detail.kind === 'qr_location') {
    const link = detail.link;
    return (
      <div><span className="adm-lead-sub">QR location: </span><span style={{ fontSize: 13.5, color: 'var(--adm-ink)', fontWeight: 600 }}>{link.label || link.id}</span>{link.city && <span className="adm-lead-sub"> · {[link.locality, link.city].filter(Boolean).join(', ')}</span>}</div>
    );
  }
  if (detail.kind === 'referral_customer') {
    const ref = detail.referredLead;
    return (
      <div><span className="adm-lead-sub">Referred by: </span><span style={{ fontSize: 13.5, color: 'var(--adm-ink)', fontWeight: 600 }}>{ref.name}</span>{ref.phone && <span className="adm-lead-sub"> · {ref.phone}</span>}</div>
    );
  }
  return null;
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

// Full attribution record (not just the one-line display string above) for the Lead Detail
// modal — a Pre-sales/Sales Engineer exec asking "who referred this lead" wants the partner's
// OWN name and their shop/business name as two separate facts (see components/partner/
// MyProfileScreen.jsx's businessName="Partner Name"/shopName="Partner Business Name" split),
// not one collapsed string. Same priority chain as attributionFor (partnerId wins regardless of
// whether the channel was Partner App, a QR scan, or a shared referral link — see
// lib/attribution.js's header comment on qr_partner/referral_partner both setting partnerId),
// falling through to the employee who punched the lead in, the physical QR location, or the
// customer who referred them.
export function attributionDetailFor(l, { partners, employees, links, leads }) {
  if (l.partnerId) {
    const p = (partners || []).find((x) => x.id === l.partnerId);
    return p ? { kind: 'partner', partner: p } : { kind: 'partner', partner: null };
  }
  if (l.addedByEmployeeId) {
    const e = (employees || []).find((x) => x.id === l.addedByEmployeeId);
    return e ? { kind: 'employee', employee: e } : { kind: 'employee', employee: null };
  }
  if (l.attributionKind === 'qr_location' && l.attributionLinkId) {
    const link = (links || []).find((x) => x.id === l.attributionLinkId);
    return link ? { kind: 'qr_location', link } : null;
  }
  if (l.attributionKind === 'referral_customer' && l.referredByLeadId) {
    const ref = (leads || []).find((x) => x.id === l.referredByLeadId);
    return ref ? { kind: 'referral_customer', referredLead: ref } : null;
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
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const [coords, setCoords] = useState(null);

  // The dropdown used to be `position: absolute` inside the row, but the table sits in
  // .adm-table-scroll (overflow-x: auto — which per the CSS spec also computes overflow-y to
  // auto once one axis isn't `visible`), so any row near the bottom of that scroll box had its
  // menu silently clipped there, forcing a scroll to see it. Rendering it in a portal with
  // `position: fixed` coordinates taken from the trigger button escapes that (and any other)
  // clipping ancestor entirely, and flips the menu upward when there isn't room below.
  function measure() {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const menuH = menuRef.current?.offsetHeight || (40 * (items?.length || 0) + 12);
    const spaceBelow = window.innerHeight - r.bottom;
    const openUp = spaceBelow < menuH + 10 && r.top > menuH + 10;
    setCoords({
      right: Math.max(8, window.innerWidth - r.right),
      top: openUp ? undefined : r.bottom + 6,
      bottom: openUp ? window.innerHeight - r.top + 6 : undefined,
    });
  }

  function handleTriggerClick() {
    if (open) { onToggle(null); return; }
    measure();
    onToggle(rowId);
  }

  // Close on an outside click (but not on the trigger itself, which toggles), and keep the
  // menu anchored to the trigger button while the page or the table scrolls or resizes —
  // without this, several rows' menus could end up visually stacking as you click around the
  // table, or the menu could drift away from its trigger.
  useEffect(() => {
    if (!open) return;
    measure(); // re-measure now that the menu is actually in the DOM and has a real height
    function onScrollOrResize() { measure(); }
    function onDocClick(e) {
      if (btnRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      onToggle(null);
    }
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    document.addEventListener('mousedown', onDocClick);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      document.removeEventListener('mousedown', onDocClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
      {primary && <button className="chip-btn primary" onClick={primary.onClick} disabled={primary.disabled}>{primary.label}</button>}
      {items && items.length > 0 && (
        <>
          <button ref={btnRef} className="adm-icon-btn" style={{ width: 30, height: 30 }} onClick={handleTriggerClick}><IconMore size={16} /></button>
          {open && coords && createPortal(
            <div
              ref={menuRef}
              className="adm-user-menu"
              style={{ position: 'fixed', minWidth: 170, top: coords.top, bottom: coords.bottom, right: coords.right }}
            >
              {items.map((it, i) => (
                <button key={i} onClick={() => { it.onClick(); onToggle(null); }} style={it.danger ? { color: '#C0392B' } : undefined}>{it.label}</button>
              ))}
            </div>,
            document.body
          )}
        </>
      )}
    </div>
  );
}
