// Heseos-only bridge from a Flow Builder conversation's collected answers to the real `leads`
// table row — deliberately kept OUT of lib/botFlowEngine.js's generic question/menu handling so
// every other tenant's Flow Builder stays a plain "collect free-text answers" tool with no
// Heseos vocabulary baked in. Only ever called for a chat that already has a leadId, which only
// ever happens for Heseos's own in-house tenant (botKind === 'heseos' — see
// app/api/bot/webhook/route.js and lib/attribution.js's getHeseosBotTenant); white-label tenants
// never reach this file's syncLeadField at all, so nothing here needs its own tenant check.
//
// The label -> value maps below mirror exactly what a partner sees/picks in the Partner App's
// "Add Lead" wizard (components/partner/LeadWizard.jsx, values from lib/formOptions.js and
// lib/partnerMock.js) so a lead captured by the bot looks identical, field-for-field, to one a
// partner punched in by hand.

import { TIMELINE, BUDGET_BY_PROPERTY } from '@/lib/formOptions';
import { WIZARD_PROPERTY_TYPE, CONFIGURATION } from '@/lib/partnerMock';
import { dbPatch } from '@/lib/db';

function labelMap(options) {
  return Object.fromEntries((options || []).map((o) => [o.l, o.v]));
}

const PROPERTY_TYPE_MAP = labelMap(WIZARD_PROPERTY_TYPE);
const CONFIGURATION_MAP = labelMap(CONFIGURATION);
const TIMELINE_MAP = labelMap(TIMELINE);
// Flat label -> value map across all four property types' budget tiers. Safe as a single flat
// map only because every tier label across all property types is unique (checked by hand
// against lib/formOptions.js's BUDGET_BY_PROPERTY — no two property types share a label like
// "₹40k – ₹60k" for different values); if that ever changes, budget canonicalization would need
// to become property-type-aware like the flow's branching menus already are.
const BUDGET_MAP = labelMap(Object.values(BUDGET_BY_PROPERTY).flat());

// Fields the bot's Heseos lead-capture flow is allowed to write back to a lead. A menu/question
// node's fieldKey only syncs when it's in this set — anything else (a custom field a tenant
// invents for their own flow) is saved to chat.answers same as always, but never reaches the
// leads table.
export const HESEOS_LEAD_FIELDS = new Set(['name', 'city', 'propertyType', 'budget', 'configuration', 'timeline']);

// Turns whatever the customer typed/picked into the same enum codes the rest of the app stores
// (e.g. "2 BHK Apartment" -> "2bhk"). Free-text fields (name, city) pass through trimmed as-is.
// An unrecognised value (a typo, a menu label that changed) falls back to the raw text rather
// than being dropped, so the lead still shows *something* for a sales rep to work with.
export function canonicalizeLeadValue(fieldKey, rawValue) {
  const raw = String(rawValue || '').trim();
  if (!raw) return '';
  switch (fieldKey) {
    case 'propertyType': return PROPERTY_TYPE_MAP[raw] || raw;
    case 'configuration': return CONFIGURATION_MAP[raw] || raw;
    case 'budget': return BUDGET_MAP[raw] || raw;
    case 'timeline': return TIMELINE_MAP[raw] || raw;
    default: return raw;
  }
}

// Writes one canonicalized field onto the chat's linked lead. No-ops silently (never throws) for
// any chat without a leadId — i.e. every white-label chat, always — and for any fieldKey outside
// HESEOS_LEAD_FIELDS, so callers can call this unconditionally from the generic flow engine.
export async function syncLeadField(chat, fieldKey, rawValue) {
  if (!chat?.leadId) return;
  if (!HESEOS_LEAD_FIELDS.has(fieldKey)) return;
  const value = canonicalizeLeadValue(fieldKey, rawValue);
  if (!value) return;
  try {
    await dbPatch('leads', chat.leadId, { [fieldKey]: value });
  } catch (err) {
    console.error('syncLeadField error:', err);
  }
}
