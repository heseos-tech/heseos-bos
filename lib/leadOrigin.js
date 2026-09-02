// Lead-origin description — lib/leadOrigin.js
//
// Powers the duplicate-lead check on the Partner App's and Team App's "Add Lead" wizards (see
// app/api/leads/lookup/route.js, components/partner/LeadWizard.jsx, components/team/LeadWizard.jsx):
// when a partner or employee types a phone number that's already in the system, we tell them
// WHO already brought this lead in, so they don't waste a trip re-pitching a customer someone
// else (or the customer themselves) already reached.
//
// describeLeadOrigin() takes one lead row plus lookup tables and returns a short, human sentence.
// Mirrors the same precedence components/admin/LeadsPage.jsx's attributionInfo() uses for the
// admin table's "Partner" column, extended to cover every attributionKind (including
// referral_customer and qr_location, which attributionInfo() doesn't need to spell out) and every
// remaining lead source, since here we're explaining the origin to someone OUTSIDE the admin
// panel who can't just look at the row.
//
// Deliberately returns only a sentence — never the lead id, phone, or any other field — see
// app/api/leads/lookup/route.js's header comment for why.

import { LEAD_SOURCES } from '@/lib/formOptions';

export function describeLeadOrigin(lead, { partners = [], employees = [], leads = [], links = [] } = {}) {
  const partnerName = (id) => partners.find((p) => p.id === id)?.businessName || 'one of our partners';
  const employeeName = (id) => employees.find((e) => e.id === id)?.name || 'a team member';
  const linkLabel = (id) => links.find((l) => l.id === id)?.label || 'a location';

  if (lead.attributionKind === 'qr_partner' && lead.partnerId) {
    return `it was scanned via ${partnerName(lead.partnerId)}'s QR code earlier`;
  }
  if (lead.attributionKind === 'referral_partner' && lead.partnerId) {
    return `it came in via ${partnerName(lead.partnerId)}'s referral link earlier`;
  }
  if (lead.attributionKind === 'referral_customer') {
    const referrer = lead.referredByLeadId ? leads.find((l) => l.id === lead.referredByLeadId) : null;
    return referrer ? `${referrer.name} referred them earlier` : 'an existing customer referred them earlier';
  }
  if (lead.attributionKind === 'qr_location') {
    return `it was scanned via the '${linkLabel(lead.attributionLinkId)}' QR code earlier`;
  }
  if (lead.partnerId) {
    return `it was already added by partner ${partnerName(lead.partnerId)}`;
  }
  if (lead.addedByEmployeeId) {
    return `it was already added by our team member ${employeeName(lead.addedByEmployeeId)}`;
  }
  if (lead.source === 'whatsapp_bot') {
    return 'the customer messaged us directly on WhatsApp earlier';
  }
  const label = LEAD_SOURCES[lead.source];
  return label ? `it's already in our system (added via ${label})` : "it's already in our system";
}

// Digits-only, last-10 normalization — the one shared rule for matching a phone number across
// every lead source. Partner/employee-entered numbers are stored as whatever ~10 digits the
// user typed; WhatsApp-sourced leads store the full MSISDN with country code (e.g.
// '919876543210', no '+'). Comparing the last 10 digits of both sides handles that mismatch
// without needing to know which format any given lead used.
export function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.slice(-10);
}
