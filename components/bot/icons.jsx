// Minimal hand-rolled line icons for the Heseos Bot console — kept self-contained (not shared
// with components/partner/icons.jsx or components/admin/icons.jsx) since this is a standalone
// product with its own visual language. Same {size=20, ...props} shape as partner/icons.jsx.

const base = (size) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
});

export const IconInbox = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><path d="M3.5 12h5l1.5 3h4l1.5-3h5" /><rect x="3.5" y="6" width="17" height="14" rx="2" /></svg>
);
export const IconUsers = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><circle cx="8.5" cy="8" r="3" /><path d="M2.5 20a6 6 0 0112 0" /><path d="M15 8.2a2.6 2.6 0 010 5M17.5 20a5 5 0 00-3.7-4.8" /></svg>
);
export const IconLeads = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20a6.5 6.5 0 0113 0" /><path d="M16.5 9a2.6 2.6 0 010 5M19 20a5 5 0 00-3.7-4.8" /></svg>
);
export const IconShare = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><circle cx="18" cy="5.5" r="2.3" /><circle cx="6" cy="12" r="2.3" /><circle cx="18" cy="18.5" r="2.3" /><path d="M8.1 10.8l7.8-4.4M8.1 13.2l7.8 4.4" /></svg>
);
export const IconSettings = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>
);
export const IconSearch = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
);
export const IconBell = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4.2 1.3 5.6 1.9 6.3.3.3.1.9-.4.9H5c-.5 0-.7-.6-.4-.9.6-.7 1.9-2.1 1.9-6.3Z" /><path d="M10 19.5a2 2 0 0 0 4 0" /></svg>
);
export const IconHelp = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><circle cx="12" cy="12" r="9.5" /><path d="M9.3 9.2a2.7 2.7 0 015.2.9c0 1.8-2.5 2.1-2.5 3.9" /><circle cx="12" cy="17.2" r="0.15" fill="currentColor" stroke="currentColor" strokeWidth={2.4} /></svg>
);
export const IconLogout = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><path d="M9 4H6a2 2 0 00-2 2v12a2 2 0 002 2h3" /><path d="M15 8l4 4-4 4M19 12H9" /></svg>
);
export const IconSend = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><path d="M4 20l17-8L4 4l0 6.5L15.5 12 4 13.5Z" /></svg>
);
export const IconEye = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>
);
export const IconEyeOff = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><path d="M3 3l18 18" /><path d="M10.6 5.2A10.7 10.7 0 0112 5c6.2 0 10 7 10 7a17.7 17.7 0 01-3.5 4.3M6.5 6.6A17.5 17.5 0 002 12s3.8 7 10 7a10.3 10.3 0 004-.8" /><path d="M9.9 9.9a3 3 0 004.2 4.2" /></svg>
);
export const IconLock = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><rect x="5" y="10.5" width="14" height="9.5" rx="2" /><path d="M8 10.5V7.5a4 4 0 018 0v3" /></svg>
);
export const IconUser = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><circle cx="12" cy="8.2" r="3.3" /><path d="M5 20c0-3.6 3.1-6.2 7-6.2s7 2.6 7 6.2" /></svg>
);
export const IconMail = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="M3.5 6.5l8.5 6.5 8.5-6.5" /></svg>
);
export const IconPhone = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><path d="M6 3.5h3l1.6 4.3-2 1.8a11 11 0 0 0 5.8 5.8l1.8-2 4.3 1.6v3a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 4.5 5.1 1.5 1.5 0 0 1 6 3.5Z" /></svg>
);
export const IconCheck = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><path d="M4 12.5l5.5 5.5L20 6.5" /></svg>
);
export const IconChevronDown = ({ size = 18, ...p }) => (
  <svg {...base(size)} {...p}><path d="M6 9l6 6 6-6" /></svg>
);
export const IconArrowLeft = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
);
export const IconPlus = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconGlobe = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" /></svg>
);
export const IconBuilding = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><rect x="4" y="3" width="10" height="18" rx="1.5" /><path d="M14 9h6v12h-6" /><path d="M7.5 7h3M7.5 10.5h3M7.5 14h3M7.5 17.5h3" /></svg>
);
export const IconWhatsApp = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p} fill="currentColor" stroke="none"><path d="M7 3l1.5 4.5-2 2a10 10 0 004.5 4.5l2-2L17.5 13.5V17a1 1 0 01-1 1C10 18 4 12 4 6.5A1 1 0 015 5.5H7z" /></svg>
);
export const IconClock = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg>
);
export const IconMapPin = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><path d="M12 21s7-6.3 7-11.5A7 7 0 105 9.5C5 14.7 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.3" /></svg>
);
export const IconEdit = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><path d="M4 20l1-4.5L15.5 5 19 8.5 8.5 19 4 20Z" /><path d="M13 7l4 4" /></svg>
);
export const IconFlow = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><circle cx="5" cy="6" r="2.3" /><circle cx="5" cy="18" r="2.3" /><circle cx="18" cy="12" r="2.3" /><path d="M7.3 6h4.2a3 3 0 013 3v0M7.3 18h4.2a3 3 0 003-3v0" /></svg>
);
export const IconMessageNode = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><path d="M4 5.5h16v10.5H9.5L5.5 19v-3H4Z" /><path d="M8 9.5h8M8 12.5h5" /></svg>
);
export const IconMenuNode = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><circle cx="5" cy="6" r="1.3" fill="currentColor" stroke="none" /><circle cx="5" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="5" cy="18" r="1.3" fill="currentColor" stroke="none" /><path d="M9.5 6h10M9.5 12h10M9.5 18h10" /></svg>
);
export const IconHandoffNode = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><path d="M4 18a5 5 0 0110 0" /><circle cx="9" cy="8" r="3" /><path d="M15 4.5a4.5 4.5 0 010 9M15 21v-2.3a2.7 2.7 0 00-2.7-2.7h-1" /></svg>
);
export const IconX = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const IconMinus = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><path d="M5 12h14" /></svg>
);
export const IconTrash = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><path d="M4 7h16M9 7V4.5h6V7M6 7l1 13.5h10L18 7" /><path d="M10 11v6M14 11v6" /></svg>
);
export const IconCopy = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><rect x="9" y="9" width="11" height="11" rx="1.5" /><path d="M15 5.5V5a1.5 1.5 0 00-1.5-1.5h-8A1.5 1.5 0 004 5v8A1.5 1.5 0 005.5 15H6" /></svg>
);
