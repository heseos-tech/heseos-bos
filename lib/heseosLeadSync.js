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
import { dbGetById, dbList, dbPatch } from '@/lib/db';
import { createLeadFromWhatsApp } from '@/lib/waInbound';
import { findFirstLeadByPhone, describeLeadOrigin } from '@/lib/leadOrigin';
import { autoAssignByCity } from '@/lib/leadAssign';
import { pushHistory } from '@/lib/leadStage';

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

// Bridges one WhatsApp chat into the real, shared `leads` table — moved here (from
// app/api/bot/webhook/route.js, where this used to be called the moment a brand-new chat's
// FIRST message arrived) so it can now be called from two different moments depending on the
// tenant: immediately, for a linkToHeseosLeads tenant with no Flow Builder flow running (see the
// webhook's chat-creation branch — unchanged pipeline-visibility behaviour), or deferred, via
// finalizeHeseosLead below, for any tenant whose flow actually reaches a handoff node.
//
// First-touch attribution — "our system only considers who gave the lead first." A brand-new
// WhatsApp chat still becomes its own lead here either way (pipeline visibility for a genuinely
// new enquiry), but if this phone number already has an earlier lead from ANY channel (Partner
// App, Team App, or a previous WhatsApp attribution), the partner/QR/referral credit this
// message would otherwise carry gets suppressed — same rule and same helper as app/api/leads's
// own duplicate check (lib/leadOrigin.js's findFirstLeadByPhone), just applied on the WhatsApp
// side so a customer re-scanning a DIFFERENT partner's QR code later can't shift payout credit
// away from whoever actually brought them in first.
export async function createHeseosLead(tenant, { phone, name, link }) {
  const existingLeads = await dbList('leads');
  const firstLead = findFirstLeadByPhone(phone, existingLeads);
  const duplicateNote = firstLead
    ? `Not credited — ${describeLeadOrigin(firstLead, { leads: existingLeads })}, so payout credit stays with the original referrer.`
    : null;

  if (link && !firstLead) {
    return createLeadFromWhatsApp({
      phone, name,
      source: link.kind,
      note: `Heseos Bot via ${link.kind} (${link.label || link.id})`,
      partnerId: link.partnerId || null,
      attributionLinkId: link.id,
      attributionKind: link.kind,
      referredByLeadId: link.customerLeadId || null,
    });
  }
  return createLeadFromWhatsApp({
    phone, name,
    source: link ? link.kind : 'whatsapp_bot',
    note: link ? `Heseos Bot via ${link.kind} (${link.label || link.id})` : `Heseos Bot (${tenant.businessName || tenant.id})`,
    duplicateNote,
  });
}

// Called from lib/botFlowEngine.js's endHandoff — the ONE moment a flow-driven Heseos/
// linkToHeseosLeads chat is allowed to become a real lead. Deliberately NOT called at chat
// creation any more (see the webhook's chat-creation branch): a customer who only ever says
// "hi", or who is asked "would you like a smart home?" and answers "Not right now" (a dead-end
// message node, never a handoff — see lib/heseosDefaultFlow.js), never reaches this function at
// all, so never becomes a lead. Idempotent (a chat that already has a leadId is returned as-is,
// never double-created) and a no-op for every tenant that isn't bridged into Heseos's shared
// leads table, so lib/botFlowEngine.js can call this unconditionally on every handoff, same
// spirit as syncLeadField above.
export async function finalizeHeseosLead(tenant, chat) {
  if (chat.leadId) return chat.leadId;
  if (tenant.botKind !== 'heseos' && tenant.linkToHeseosLeads !== true) return null;

  const link = chat.attributionLinkId ? await dbGetById('attribution_links', chat.attributionLinkId).catch(() => null) : null;
  const lead = await createHeseosLead(tenant, { phone: chat.phone, name: chat.answers?.name || chat.name, link });

  // Whatever this flow actually collected (name/city/propertyType/configuration/budget/timeline
  // — see HESEOS_LEAD_FIELDS) gets written on in one go here, on top of whatever syncLeadField
  // already wrote turn-by-turn while the chat had no leadId yet to write to (which was none of
  // it, since syncLeadField no-ops without a leadId) — so a lead created this way arrives fully
  // filled in from its very first row, not built up field-by-field after the fact.
  const patch = {};
  for (const key of HESEOS_LEAD_FIELDS) {
    const raw = chat.answers?.[key];
    if (raw === undefined) continue;
    const value = canonicalizeLeadValue(key, raw);
    if (value) patch[key] = value;
  }

  // Same city-based auto-assignment every other lead source already gets (Partner App/Team App
  // via app/api/leads, Meta/Google Ads via their webhooks, the website form) — see
  // lib/leadAssign.js's autoAssignByCity. A WhatsApp lead couldn't get this at CREATION time the
  // way those do, because createHeseosLead runs before the flow has asked the customer their
  // city; this is the one moment it's known. Only ever runs once (finalizeHeseosLead itself is
  // never called twice for the same lead — see the chat.leadId short-circuit above), and only
  // when a match exists — no match still leaves it unassigned for an admin to pick up by hand,
  // same as every other source.
  if (patch.city) {
    try {
      const { assignedTo, salesEngineerId } = await autoAssignByCity(patch.city);
      if (assignedTo) {
        patch.assignedTo = assignedTo;
        patch.salesEngineerId = salesEngineerId;
        patch.history = pushHistory(lead, { event: 'Auto-assigned by city', by: 'system', note: `${patch.city} · pre-sales matched` });
      }
    } catch (err) {
      console.error('finalizeHeseosLead auto-assign error:', err);
    }
  }

  if (Object.keys(patch).length) {
    try { await dbPatch('leads', lead.id, patch); }
    catch (err) { console.error('finalizeHeseosLead field-sync error:', err); }
  }

  return lead.id;
}
