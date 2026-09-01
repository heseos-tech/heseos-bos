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
export const IconTasks = (p) => S(<><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 12.3l2.3 2.3L16 9.3" /></>, p?.size);
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
export const IconWhatsApp = (p) => S(<path d="M7 3l1.5 4.5-2 2a10 10 0 004.5 4.5l2-2L17.5 13.5V17a1 1 0 01-1 1C10 18 4 12 4 6.5A1 1 0 015 5.5H7z" fill="currentColor" stroke="none" />, p?.size);
export const IconQrCode = (p) => S(<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20v.01" /></>, p?.size);
export const IconLink = (p) => S(<><path d="M9.5 14.5l5-5" /><path d="M8 16.5l-1.8 1.8a3.5 3.5 0 01-5-5L5 9.5a3.5 3.5 0 015-5" /><path d="M16 7.5l1.8-1.8a3.5 3.5 0 015 5L19 14.5a3.5 3.5 0 01-5 5" /></>, p?.size);
export const IconRefresh = (p) => S(<><path d="M4 12a8 8 0 0114.5-4.5M20 12a8 8 0 01-14.5 4.5" /><path d="M18.5 3v4.5H14M5.5 21v-4.5H10" /></>, p?.size);
