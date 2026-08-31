// Shared option lists for the Heseos lead capture form — taken directly from the Meta
// Instant Forms Heseos already runs (see "Let's Build Your Smart Space" / "Upgrade your
// Home with Smart Home Automation"), so the website form, the Meta Lead Ads webhook, and
// the partner-app "add a lead" form all speak the same field vocabulary.

// What the customer is looking for — product interest (multi-select, form variant 2).
export const PRODUCT_INTEREST = [
  { v: 'touch_panel_switches', l: 'Touch Panel Switches' },
  { v: 'smart_door_locks',     l: 'Smart Door Locks' },
  { v: 'smart_lights',         l: 'Smart Lights' },
  { v: 'smart_curtains',       l: 'Smart Curtains' },
  { v: 'video_door_phone',     l: 'Video Door Phone' },
  { v: 'scene_controller',     l: 'Smart Scene Controller Panels' },
  { v: 'full_package',         l: 'Home Automation Package' },
  { v: 'not_sure',             l: 'Not Sure — Need Assistance' },
];

// Scope — partial vs. whole-home (form variant 1).
export const AUTOMATION_SCOPE = [
  { v: 'partial',  l: 'Partial Home Automation' },
  { v: 'complete', l: 'Complete Home Automation' },
];

// Method — retrofit behind existing switches vs. a touch panel system.
export const AUTOMATION_TYPE = [
  { v: 'retrofit',     l: 'Behind Switch Module (Retrofit)' },
  { v: 'touch_panel',  l: 'Touch Panel' },
];

export const PROPERTY_TYPE = [
  { v: '1bhk',       l: '1BHK' },
  { v: '2bhk',       l: '2BHK' },
  { v: '3bhk_plus',  l: '3BHK & Above' },
  { v: 'commercial', l: 'Office / Commercial' },
];

// Budget tiers are conditional on property type — exactly as in the Meta form.
export const BUDGET_BY_PROPERTY = {
  '1bhk': [
    { v: '20k_40k', l: '₹20k – ₹40k' },
    { v: '40k_60k', l: '₹40k – ₹60k' },
    { v: '60k_plus', l: '₹60k & Above' },
  ],
  '2bhk': [
    { v: '40k_60k', l: '₹40k – ₹60k' },
    { v: '60k_90k', l: '₹60k – ₹90k' },
    { v: '90k_plus', l: '₹90k & Above' },
  ],
  '3bhk_plus': [
    { v: '50k_70k', l: '₹50k – ₹70k' },
    { v: '70k_1L', l: '₹70k – ₹1 Lakh' },
    { v: '1L_plus', l: '₹1 Lakh & Above' },
  ],
  commercial: [
    { v: '50k_90k', l: '₹50k – ₹90k' },
    { v: '90k_1_5L', l: '₹90k – ₹1.5 Lakh' },
    { v: '2L_plus', l: '₹2 Lakh & Above' },
  ],
};

export const TIMELINE = [
  { v: 'within_15d', l: 'Within 15 Days' },
  { v: 'within_30d', l: 'Within 30 Days' },
  { v: 'within_45d', l: 'Within 45 Days' },
  { v: 'beyond_45d', l: '45 Days & Beyond' },
];

export const PERSONA_TYPE = [
  { v: 'end_client',        l: 'End Client' },
  { v: 'builder',            l: 'Builder' },
  { v: 'architect',          l: 'Architect' },
  { v: 'interior_designer',  l: 'Interior Designer' },
];

// Distribution-partner categories shown on the admin Partners page. `v` is what's stored on
// the partner record's `type` field (kept as-is for backward compatibility with earlier
// partners created as plain 'shop'/'electrician'/etc.) — PARTNER_CATEGORY_LABEL falls back to
// a title-cased version of any legacy/unknown value so nothing breaks.
export const PARTNER_CATEGORY = [
  { v: 'electrical_shop',    l: 'Electrical Shop' },
  { v: 'switch_dealer',      l: 'Switch Dealer' },
  { v: 'interior_designer',  l: 'Interior Designer' },
  { v: 'builder',            l: 'Builder' },
  { v: 'architect',          l: 'Architect' },
];
export const PARTNER_CATEGORY_LABEL = Object.fromEntries(PARTNER_CATEGORY.map((p) => [p.v, p.l]));
export function partnerCategoryLabel(type) {
  if (PARTNER_CATEGORY_LABEL[type]) return PARTNER_CATEGORY_LABEL[type];
  if (!type) return 'Partner';
  return String(type).replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

// Employee roles — kept here (not in lib/auth.js) because that file imports next/headers and
// can't be pulled into client components; this is the client-safe home for the role list.
export const EMPLOYEE_ROLES = ['presales', 'sales_engineer', 'admin'];

// Lead intake channel — every source ultimately writes to the same `leads` table.
// 'website' (embedded homepage form) and 'whatsapp_qr' (the legacy single-number shop-QR +
// Team Inbox system) have both been retired — every site CTA now hands off straight to
// WhatsApp (see app/get-started/route.js) and the WhatsApp side runs entirely through the
// multi-tenant Bot Console. Kept out of this map on purpose so neither can be created again;
// any old lead already tagged with one of those two just falls back to showing its raw source
// string (see the `|| l.source` fallback everywhere this map is read).
export const LEAD_SOURCES = {
  website_api: 'Website (API)',
  meta_lead_form: 'Meta Instant Form',
  google_ads_lead_form: 'Google Ads Lead Form',
  partner_app: 'Partner App',
  manual_entry: 'Manually Added',
  whatsapp_bot: 'WhatsApp Bot',
  // Attributed via a lib/attribution.js code (see app/go/[code]) — QR codes and referral links,
  // each routed to Heseos's own WhatsApp bot tenant so the resulting chat becomes a lead here.
  qr_partner: 'QR Code (Partner)',
  qr_location: 'QR Code (Location)',
  referral_partner: 'Referral Link (Partner)',
  referral_customer: 'Referral Link (Customer)',
};

export function budgetOptionsFor(propertyType) {
  return BUDGET_BY_PROPERTY[propertyType] || [];
}
