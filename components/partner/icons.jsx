// Minimal hand-rolled line icons — keeps the Partner app dependency-free (no icon package).
// Every icon takes {size=20, ...props} and forwards extra props (className, style) to the svg.

const base = (size) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
});

export const IconHome = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1v-9" /></svg>
);
export const IconLeads = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><rect x="4" y="4.5" width="16" height="15" rx="2.2" /><path d="M8 9.5h8M8 13h8M8 16.5h5" /></svg>
);
export const IconPlus = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconGift = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><rect x="3.5" y="9.5" width="17" height="11" rx="1.6" /><path d="M3.5 13.5h17" /><path d="M12 9.5v11" /><path d="M12 9.5c-1.6 0-4.5-.6-4.5-3A2 2 0 0 1 9.5 4.5C11.5 4.5 12 7.5 12 9.5Z" /><path d="M12 9.5c1.6 0 4.5-.6 4.5-3a2 2 0 0 0-2-2c-2 0-2.5 3-2.5 5Z" /></svg>
);
export const IconUser = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><circle cx="12" cy="8.2" r="3.3" /><path d="M5 20c0-3.6 3.1-6.2 7-6.2s7 2.6 7 6.2" /></svg>
);
export const IconBell = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4.2 1.3 5.6 1.9 6.3.3.3.1.9-.4.9H5c-.5 0-.7-.6-.4-.9.6-.7 1.9-2.1 1.9-6.3Z" /><path d="M10 19.5a2 2 0 0 0 4 0" /></svg>
);
export const IconPhone = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><path d="M6 3.5h3l1.6 4.3-2 1.8a11 11 0 0 0 5.8 5.8l1.8-2 4.3 1.6v3a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 4.5 5.1 1.5 1.5 0 0 1 6 3.5Z" /></svg>
);
export const IconLock = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><rect x="5" y="10.5" width="14" height="9.5" rx="2" /><path d="M8 10.5V7.8a4 4 0 1 1 8 0v2.7" /></svg>
);
export const IconEye = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.7" /></svg>
);
export const IconEyeOff = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><path d="M3.5 3.5l17 17" /><path d="M10.6 5.7A10 10 0 0 1 21.5 12S18 18.5 12 18.5c-1.2 0-2.3-.2-3.3-.6" /><path d="M6.3 6.9C4.2 8.3 2.5 12 2.5 12s1.7 3.7 5.2 5.5" /><path d="M9.6 9.9a2.7 2.7 0 0 0 3.8 3.8" /></svg>
);
export const IconUserPlus = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><circle cx="10" cy="8.2" r="3.3" /><path d="M3.5 20c0-3.6 2.9-6.2 6.5-6.2s6.5 2.6 6.5 6.2" /><path d="M18.5 8v5M16 10.5h5" /></svg>
);
export const IconMapPin = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><path d="M12 21s7-6.4 7-11.5a7 7 0 1 0-14 0C5 14.6 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.4" /></svg>
);
export const IconBuilding = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><rect x="5" y="3.5" width="10" height="17" rx="1" /><rect x="15" y="9" width="4.5" height="11.5" rx="1" /><path d="M8 7.5h1M11 7.5h1M8 11h1M11 11h1M8 14.5h1M11 14.5h1" /></svg>
);
export const IconLayers = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><path d="M12 3.5 20.5 8 12 12.5 3.5 8 12 3.5Z" /><path d="M3.5 12 12 16.5 20.5 12" /><path d="M3.5 16 12 20.5 20.5 16" /></svg>
);
export const IconWallet = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h11a2 2 0 0 1 2 2V8h-13a2 2 0 0 1-2-2Z" opacity="0" /><rect x="3.5" y="6.5" width="17" height="12.5" rx="2.2" /><path d="M15 12.5h3.5" /></svg>
);
export const IconCalendar = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><rect x="4" y="5.5" width="16" height="15" rx="2" /><path d="M4 9.5h16M8 3.5v3M16 3.5v3" /></svg>
);
export const IconSource = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /></svg>
);
export const IconNote = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><path d="M6 3.5h9l4.5 4.5V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5A1 1 0 0 1 6 3.5Z" /><path d="M14.5 3.5V8H19" /><path d="M8 12.5h8M8 16h6" /></svg>
);
export const IconCheck = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><path d="M20 6.5 9.5 17 4 11.5" /></svg>
);
export const IconChevronDown = ({ size = 18, ...p }) => (
  <svg {...base(size)} {...p}><path d="m6 9 6 6 6-6" /></svg>
);
export const IconChevronRight = ({ size = 18, ...p }) => (
  <svg {...base(size)} {...p}><path d="m9 6 6 6-6 6" /></svg>
);
export const IconArrowLeft = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
);
export const IconCopy = ({ size = 18, ...p }) => (
  <svg {...base(size)} {...p}><rect x="8.5" y="8.5" width="11" height="11" rx="2" /><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" /></svg>
);
export const IconShare = ({ size = 18, ...p }) => (
  <svg {...base(size)} {...p}><circle cx="18" cy="6" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6" /></svg>
);
export const IconLogout = ({ size = 18, ...p }) => (
  <svg {...base(size)} {...p}><path d="M9 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3" /><path d="M16 16l4-4-4-4" /><path d="M20 12H9" /></svg>
);
export const IconShield = ({ size = 18, ...p }) => (
  <svg {...base(size)} {...p}><path d="M12 3.5 19 6.3v5.4c0 4.6-3 7.9-7 9.3-4-1.4-7-4.7-7-9.3V6.3L12 3.5Z" /><path d="m9 12 2 2 4-4" /></svg>
);
export const IconBank = ({ size = 18, ...p }) => (
  <svg {...base(size)} {...p}><path d="M4 9.5 12 4l8 5.5" /><path d="M5.5 9.5v9M9.5 9.5v9M14.5 9.5v9M18.5 9.5v9" /><path d="M3.5 18.5h17M3.5 9.5h17" /></svg>
);
export const IconHistory = ({ size = 18, ...p }) => (
  <svg {...base(size)} {...p}><path d="M4 12a8 8 0 1 0 2.6-5.9" /><path d="M3.5 4.5v4h4" /><path d="M12 8v4.5l3 2" /></svg>
);
export const IconHelp = ({ size = 18, ...p }) => (
  <svg {...base(size)} {...p}><circle cx="12" cy="12" r="9" /><path d="M9.3 9.2a2.7 2.7 0 1 1 3.9 2.4c-.8.5-1.2 1-1.2 2" /><path d="M12 16.7v.1" /></svg>
);
export const IconFile = ({ size = 18, ...p }) => (
  <svg {...base(size)} {...p}><path d="M6 3.5h8l5 5V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5A1 1 0 0 1 6 3.5Z" /><path d="M14 3.5V8h5" /></svg>
);
export const IconSpark = ({ size = 20, ...p }) => (
  <svg {...base(size)} {...p}><path d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M18 18l-3-3M18 6l-3 3M6 18l3-3" /></svg>
);
export const IconTag = ({ size = 18, ...p }) => (
  <svg {...base(size)} {...p}><path d="M11.5 3.5H6A2.5 2.5 0 0 0 3.5 6v5.5a1.5 1.5 0 0 0 .44 1.06l9 9a1.5 1.5 0 0 0 2.12 0l6.44-6.44a1.5 1.5 0 0 0 0-2.12l-9-9a1.5 1.5 0 0 0-1.06-.44Z" /><circle cx="8.3" cy="8.3" r="1.3" /></svg>
);

export const LogoGoogle = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24"><path fill="#4285F4" d="M23.5 12.3c0-.8-.07-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z" /><path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24Z" /><path fill="#FBBC05" d="M5.4 14.4A7.2 7.2 0 0 1 5 12c0-.8.14-1.6.4-2.4V6.5h-4A12 12 0 0 0 0 12c0 1.9.46 3.8 1.4 5.5l4-3.1Z" /><path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.5l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z" /></svg>
);
export const LogoWhatsApp = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#25D366"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Z" /><path fill="#fff" d="M17 14.4c-.3-.1-1.6-.8-1.8-.9-.3-.1-.4-.1-.6.1-.2.3-.7.9-.8 1-.2.2-.3.2-.5.1-1.4-.7-2.3-1.2-3.2-2.8-.3-.4.2-.4.7-1.3.1-.2 0-.4 0-.5C10.6 10 10.1 8.7 10 8.2c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.3.3-1 .9-1 2.3s1 2.7 1.2 2.9c.1.2 2 3.1 4.9 4.3 2 .8 2.6.6 3.1.6.6 0 1.7-.7 2-1.4.2-.6.2-1.2.2-1.3-.1-.1-.3-.2-.6-.3Z" /></svg>
);
