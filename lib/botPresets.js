// Heseos Bot platform — industry presets for the self-service signup wizard & Bot
// Configuration screen. Each preset seeds sensible defaults (welcome message, quick-menu,
// the "journey" phrase used in copy) so a new tenant's bot reads naturally on day one without
// them having to write conversational copy from scratch — they can still edit every field
// afterwards in Bot Configuration. Modelled on how MARG's own bot talks to home-loan
// customers, generalised across industries.

export const INDUSTRIES = [
  {
    key: 'home_automation',
    label: 'Smart Home / Home Automation',
    journeyPhrase: 'smart home journey',
    menuOptions: [
      { label: 'Check Products', icon: '\ud83d\udca1' },
      { label: 'Get a Quote', icon: '\ud83e\uddfe' },
      { label: 'Book a Demo', icon: '\ud83d\udcc5' },
      { label: 'Track My Order', icon: '\ud83d\udce6' },
    ],
    sampleWelcome: "Namaste \ud83d\ude4f I'm *{{botName}}* \u2014 your companion on your smart home journey.\n\nFrom picking the right switches to booking a free home demo, I'm here to guide you every step of the way.\n\nSo tell me\u2026 \ud83d\udc47",
  },
  {
    key: 'housing_finance',
    label: 'Housing Finance / NBFC',
    journeyPhrase: 'home-buying journey',
    menuOptions: [
      { label: 'Check Eligibility', icon: '\ud83d\udcca' },
      { label: 'EMI Calculator', icon: '\ud83e\uddee' },
      { label: 'Document Guide', icon: '\ud83d\udcc4' },
      { label: 'Application Status', icon: '\u23f1' },
    ],
    sampleWelcome: "Namaste \ud83d\ude4f I'm *{{botName}}* \u2014 your companion on your home-buying journey.\n\nFrom understanding your finances to choosing the right home loan, I'm here to guide you every step of the way.\n\nSo tell me\u2026 \ud83d\udc47",
  },
  {
    key: 'real_estate',
    label: 'Real Estate',
    journeyPhrase: 'property search',
    menuOptions: [
      { label: 'Browse Properties', icon: '\ud83c\udfe2' },
      { label: 'Schedule a Visit', icon: '\ud83d\udcc5' },
      { label: 'Price & Offers', icon: '\ud83c\udff7\ufe0f' },
      { label: 'Talk to an Agent', icon: '\ud83e\uddd1\u200d\ud83d\udcbc' },
    ],
    sampleWelcome: "Namaste \ud83d\ude4f I'm *{{botName}}* \u2014 your companion on your property search.\n\nFrom shortlisting the right home to booking a site visit, I'm here to guide you every step of the way.\n\nSo tell me\u2026 \ud83d\udc47",
  },
  {
    key: 'retail',
    label: 'Retail / E-commerce',
    journeyPhrase: 'shopping experience',
    menuOptions: [
      { label: 'Browse Catalogue', icon: '\ud83d\udecd\ufe0f' },
      { label: 'Track My Order', icon: '\ud83d\udce6' },
      { label: 'Offers & Discounts', icon: '\ud83c\udff7\ufe0f' },
      { label: 'Talk to Support', icon: '\ud83c\udfa7' },
    ],
    sampleWelcome: "Namaste \ud83d\ude4f I'm *{{botName}}* \u2014 your companion on your shopping journey with {{business}}.\n\nFrom finding the right product to tracking your order, I'm here to guide you every step of the way.\n\nSo tell me\u2026 \ud83d\udc47",
  },
  {
    key: 'healthcare',
    label: 'Healthcare / Clinic',
    journeyPhrase: 'care journey',
    menuOptions: [
      { label: 'Book Appointment', icon: '\ud83d\udcc5' },
      { label: 'Our Doctors', icon: '\ud83e\ude7a' },
      { label: 'Reports & Records', icon: '\ud83d\udcc4' },
      { label: 'Talk to Reception', icon: '\ud83d\udcde' },
    ],
    sampleWelcome: "Namaste \ud83d\ude4f I'm *{{botName}}* \u2014 your companion for appointments and care at {{business}}.\n\nFrom booking a visit to finding the right doctor, I'm here to guide you every step of the way.\n\nSo tell me\u2026 \ud83d\udc47",
  },
  {
    key: 'education',
    label: 'Education / Coaching',
    journeyPhrase: 'admissions journey',
    menuOptions: [
      { label: 'Courses Offered', icon: '\ud83d\udcda' },
      { label: 'Fee & Scholarships', icon: '\ud83c\udf93' },
      { label: 'Book a Counselling Call', icon: '\ud83d\udcde' },
      { label: 'Admission Status', icon: '\u23f1' },
    ],
    sampleWelcome: "Namaste \ud83d\ude4f I'm *{{botName}}* \u2014 your companion on your admissions journey with {{business}}.\n\nFrom picking the right course to tracking your application, I'm here to guide you every step of the way.\n\nSo tell me\u2026 \ud83d\udc47",
  },
  {
    key: 'other',
    label: 'Other',
    journeyPhrase: 'journey with us',
    menuOptions: [
      { label: 'Our Services', icon: '\u2728' },
      { label: 'Get a Quote', icon: '\ud83e\uddfe' },
      { label: 'Book a Call', icon: '\ud83d\udcde' },
      { label: 'Talk to Support', icon: '\ud83c\udfa7' },
    ],
    sampleWelcome: "Namaste \ud83d\ude4f I'm *{{botName}}* \u2014 your companion on your journey with {{business}}.\n\nWhatever you need, I'm here to guide you every step of the way.\n\nSo tell me\u2026 \ud83d\udc47",
  },
];

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: '\u0939\u093f\u0902\u0926\u0940 (Hindi)' },
  { code: 'mr', label: '\u092e\u0930\u093e\u0920\u0940 (Marathi)' },
  { code: 'ta', label: '\u0ba4\u0bae\u0bbf\u0bb4\u0bcd (Tamil)' },
  { code: 'gu', label: '\u0a97\u0ac1\u0a9c\u0ab0\u0abe\u0aa4\u0ac0 (Gujarati)' },
];

export function industryByKey(key) {
  return INDUSTRIES.find((i) => i.key === key) || INDUSTRIES[INDUSTRIES.length - 1];
}

// `extra` adds arbitrary further {{key}} replacements on top of the two built-ins below — used
// by lib/botFlowEngine.js to splice in {{referrerNote}} and any {{fieldKey}} already collected
// into chat.answers, so a flow's own message text can reference earlier answers. Any {{...}}
// left unmatched (a typo, or a key that hasn't been answered yet) is stripped rather than sent
// to the customer verbatim; a leftover blank {{referrerNote}} on an organic chat commonly leaves
// a blank line behind, so a cleanup pass collapses runs of 3+ newlines and trims each line's
// trailing whitespace.
export function fillTemplate(tpl, tenant, extra = {}) {
  let out = String(tpl || '')
    .replaceAll('{{botName}}', tenant.botName || 'Mitra')
    .replaceAll('{{business}}', tenant.businessName || 'us');
  for (const [key, value] of Object.entries(extra || {})) {
    out = out.replaceAll(`{{${key}}}`, value == null ? '' : String(value));
  }
  out = out.replace(/\{\{[a-zA-Z0-9_]+\}\}/g, '');
  out = out
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return out;
}
