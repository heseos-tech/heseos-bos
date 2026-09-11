// components/admin/icons.jsx — hand-rolled icon set for the admin dashboard (sidebar,
// topbar, stat cards, tables). Same convention as components/partner/icons.jsx: no icon
// library, plain inline SVGs.
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
const S = (path, size = 18, extra = {}) => <svg width={size} height={size} viewBox="0 0 24 24" {...base} {...extra}>{path}</svg>;

export const IconDashboard = (p) => S(<><path d="M3 11.5L12 4l9 7.5" /><path d="M5.5 10v9.5a1 1 0 001 1h11a1 1 0 001-1V10" /></>, p?.size);
export const IconLeads = (p) => S(<><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20a6.5 6.5 0 0113 0" /><path d="M16.5 9a2.6 2.6 0 010 5M19 20a5 5 0 00-3.7-4.8" /></>, p?.size);
export const IconPartners = (p) => S(<><circle cx="7.5" cy="8.5" r="3" /><circle cx="16.5" cy="8.5" r="3" /><path d="M1.8 20a5.9 5.9 0 0111.4 0M10.8 20a5.9 5.9 0 0111.4 0" /></>, p?.size);
export const IconSalesEngineer = (p) => S(<><rect x="3" y="7.5" width="18" height="12.5" rx="2" /><path d="M8 7.5V6a2 2 0 012-2h4a2 2 0 012 2v1.5" /><path d="M3 13h18" /></>, p?.size);
export const IconPresales = (p) => S(<><circle cx="12" cy="8" r="3.4" /><path d="M4.5 20a7.5 7.5 0 0115 0" /></>, p?.size);
export const IconDemo = (p) => S(<><rect x="3.5" y="4.5" width="17" height="16" rx="2.5" /><path d="M3.5 9.5h17M8 2.5v4M16 2.5v4M8 14h2M8 17h2M14 14h2M14 17h2" /></>, p?.size);
export const IconQuotation = (p) => S(<><path d="M6.5 3h8l4 4v14h-12z" /><path d="M14.5 3v4h4" /><path d="M9 12h6M9 15.5h6M9 8.5h2" /></>, p?.size);
export const IconConversions = (p) => S(<><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.6 2.6L16.5 9" /></>, p?.size);
export const IconReports = (p) => S(<><path d="M4 20V10M11 20V4M18 20v-7" /><path d="M2.5 20h19" strokeWidth={2} /></>, p?.size);
export const IconPayouts = (p) => S(<><rect x="2.5" y="6" width="19" height="13" rx="2.2" /><path d="M2.5 10h19" /><circle cx="17" cy="14" r="1.3" fill="currentColor" stroke="none" /></>, p?.size);
export const IconSettings = (p) => S(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></>, p?.size);
export const IconSearch = (p) => S(<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>, p?.size);
export const IconBell = (p) => S(<><path d="M6 9a6 6 0 0112 0c0 4.5 1.5 6 1.5 6h-15S6 13.5 6 9z" /><path d="M10 19a2 2 0 004 0" /></>, p?.size);
export const IconChevronDown = (p) => S(<path d="M6 9l6 6 6-6" />, p?.size);
export const IconChevronLeft = (p) => S(<path d="M15 18l-6-6 6-6" />, p?.size);
export const IconChevronRight = (p) => S(<path d="M9 18l6-6-6-6" />, p?.size);
export const IconFilter = (p) => S(<path d="M4 5h16M7 12h10M10.5 19h3" />, p?.size);
export const IconMore = (p) => S(<><circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none" /></>, p?.size);
export const IconArrowUp = (p) => S(<path d="M12 19V5M6 11l6-6 6 6" />, p?.size);
export const IconArrowDown = (p) => S(<path d="M12 5v14M18 13l-6 6-6-6" />, p?.size);
export const IconPlus = (p) => S(<path d="M12 5v14M5 12h14" strokeWidth={2.2} />, p?.size);
export const IconEye = (p) => S(<><path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>, p?.size);
export const IconX = (p) => S(<path d="M6 6l12 12M18 6L6 18" strokeWidth={2.2} />, p?.size);
export const IconUpload = (p) => S(<><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3" /></>, p?.size);
export const IconDownload = (p) => S(<><path d="M12 4v12M7 11l5 5 5-5" /><path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3" /></>, p?.size);
export const IconCollapse = (p) => S(<><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M9 4v16" /><path d="M13.5 9l-2 3 2 3" /></>, p?.size);
export const IconClock = (p) => S(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>, p?.size);
export const IconLogout = (p) => S(<><path d="M9 4H6a2 2 0 00-2 2v12a2 2 0 002 2h3" /><path d="M15 8l4 4-4 4M19 12H9" /></>, p?.size);
// The actual WhatsApp glyph (speech bubble + handset) — not a generic phone/call icon, so
// every "Share on WhatsApp" button in the app reads unambiguously as WhatsApp at a glance.
export const IconWhatsApp = (p) => S(<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.654-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.226 1.36.194 1.872.118.571-.085 1.758-.716 2.006-1.408.247-.694.247-1.29.173-1.414-.074-.124-.272-.198-.57-.347M12.05 21.785h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413" fill="currentColor" stroke="none" />, p?.size);
export const IconQrCode = (p) => S(<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20v.01" /></>, p?.size);
export const IconLink = (p) => S(<><path d="M9.5 14.5l5-5" /><path d="M8 16.5l-1.8 1.8a3.5 3.5 0 01-5-5L5 9.5a3.5 3.5 0 015-5" /><path d="M16 7.5l1.8-1.8a3.5 3.5 0 015 5L19 14.5a3.5 3.5 0 01-5 5" /></>, p?.size);
export const IconRefresh = (p) => S(<><path d="M4 12a8 8 0 0114.5-4.5M20 12a8 8 0 01-14.5 4.5" /><path d="M18.5 3v4.5H14M5.5 21v-4.5H10" /></>, p?.size);
export const IconTrash = (p) => S(<><path d="M4 7h16" /><path d="M9 7V4.5a1 1 0 011-1h4a1 1 0 011 1V7" /><path d="M6 7l1 13a1.5 1.5 0 001.5 1.5h7A1.5 1.5 0 0017 20l1-13" /><path d="M10 11v6M14 11v6" /></>, p?.size);
export const IconInfo = (p) => S(<><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5" /><circle cx="12" cy="8" r="0.1" fill="currentColor" stroke="currentColor" strokeWidth="2.4" /></>, p?.size);
export const IconProducts = (p) => S(<><path d="M3.5 7.5l8.5-4 8.5 4-8.5 4-8.5-4z" /><path d="M3.5 7.5v9l8.5 4 8.5-4v-9" /><path d="M12 11.5v9" /></>, p?.size);
export const IconEmployees = (p) => S(<><rect x="4" y="3.5" width="16" height="17" rx="2.5" /><circle cx="12" cy="10" r="2.6" /><path d="M8 17c.6-2.3 2.2-3.5 4-3.5s3.4 1.2 4 3.5" /></>, p?.size);
