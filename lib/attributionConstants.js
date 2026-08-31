// Pure constants/helpers for the QR-code / referral-link model — split out of lib/attribution.js
// specifically so CLIENT components (e.g. components/admin/GrowthPage.jsx) can import labels
// like ATTR_KIND_LABEL without dragging lib/db.js (fs/path/@neondatabase/serverless — all
// Node-only) into the browser bundle. lib/attribution.js re-exports everything here, so every
// SERVER-side importer keeps working unchanged; only client components need to import from
// this file directly instead.

export const ATTR_KINDS = ['qr_partner', 'qr_location', 'referral_partner', 'referral_customer'];

export const ATTR_KIND_LABEL = {
  qr_partner: 'QR Code — Partner',
  qr_location: 'QR Code — Location',
  referral_partner: 'Referral Link — Partner',
  referral_customer: 'Referral Link — Customer',
};

export function isQrKind(kind) { return kind === 'qr_partner' || kind === 'qr_location'; }
export function isPartnerKind(kind) { return kind === 'qr_partner' || kind === 'referral_partner'; }
