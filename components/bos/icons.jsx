// components/bos/icons.jsx
// Shared inline icon set for the new "HESEOS BOS" platform-homepage sections
// (Hero, TrustedBy, SystemFlow, RolesGrid, PoweringCTA, TrustBar). Hand-rolled
// SVGs, no icon library — same convention as components/partner/icons.jsx.

const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };

export function IconChevronDown({ size = 14 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" {...base}><path d="M6 9l6 6 6-6" /></svg>;
}
export function IconArrowRight({ size = 15 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" {...base} strokeWidth={2.2}><path d="M5 12h14M12 5l7 7-7 7" /></svg>;
}
export function IconArrowUpRight({ size = 15 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" {...base} strokeWidth={2}><path d="M7 17L17 7M8 7h9v9" /></svg>;
}

/* System-flow (Capture / Qualify / Engage / Convert) */
export function IconCapture({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <circle cx="9" cy="8" r="3.4" /><path d="M2.5 20a6.5 6.5 0 0113 0" />
      <path d="M17 8.5a3 3 0 010 5.6M20 20a5.5 5.5 0 00-4-5.3" />
    </svg>
  );
}
export function IconQualify({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <circle cx="10" cy="8" r="3.4" /><path d="M2.5 20a7.5 7.5 0 0115 0" />
      <path d="M16.5 10.2l1.6 1.6 3-3" />
    </svg>
  );
}
export function IconEngage({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
      <circle cx="8.5" cy="14" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="14" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="14" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}
export function IconConvert({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M7 3h8l4 4v14H7z" /><path d="M15 3v4h4" />
      <path d="M10 12h5M10 15.5h5M10 8.5h2" />
    </svg>
  );
}

/* Role cards */
export function IconRolePartners({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <circle cx="8" cy="9" r="3" /><circle cx="17" cy="9" r="2.6" />
      <path d="M1.8 20a6.2 6.2 0 0112.4 0M14 14.3a5.6 5.6 0 016.2 5.7" />
    </svg>
  );
}
export function IconRolePresales({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <circle cx="12" cy="8" r="3.4" /><path d="M4.5 20a7.5 7.5 0 0115 0" />
    </svg>
  );
}
export function IconRoleSales({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" />
      <path d="M3.5 9.5h17M8 2.5v4M16 2.5v4" />
      <path d="M8 14l2 2 4-4.5" />
    </svg>
  );
}
export function IconRoleLeaders({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M4 20V10M11 20V4M18 20v-7" />
      <path d="M2.5 20h19" strokeWidth="2" />
    </svg>
  );
}

/* Trust bar */
export function IconShield({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M12 2.5l8 3.2v6c0 5.4-3.4 8.7-8 9.8-4.6-1.1-8-4.4-8-9.8v-6z" />
      <path d="M8.5 12l2.3 2.3L15.7 9" />
    </svg>
  );
}
export function IconScale({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M4 20V13M10.5 20V8M17 20v-6M4 13l6.5-5L17 11l4-4" />
    </svg>
  );
}
export function IconSpeed({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M13 2L3 14h7l-1 8 11-13h-7z" />
    </svg>
  );
}
export function IconPeople({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <circle cx="9" cy="8" r="3" /><circle cx="17" cy="9.5" r="2.4" />
      <path d="M2 20a7 7 0 0114 0M14.5 14.5a5.2 5.2 0 015.5 5.5" />
    </svg>
  );
}
