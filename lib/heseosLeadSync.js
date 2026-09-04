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
import { pushHistory, stageOf } from '@/lib/leadStage';

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

// The reverse direction — value -> label — for rendering a stored lead's canonical codes back
// into the same human-readable text a partner/employee would see in the app, used only by
// heseosLeadSummary below.
function invert(map) {
  return Object.fromEntries(Object.entries(map).map(([label, value]) => [value, label]));
}
const PROPERTY_TYPE_LABEL = invert(PROPERTY_TYPE_MAP);
const CONFIGURATION_LABEL = invert(CONFIGURATION_MAP);
const TIMELINE_LABEL = invert(TIMELINE_MAP);
const BUDGET_LABEL = invert(BUDGET_MAP);

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

// Human-readable recap of what we already know about a returning customer's lead — powers
// lib/heseosReturningFlow.js's "welcome back" greeting via the {{leadSummary}} template var (see
// lib/botFlowEngine.js's send()). Computed fresh every time that flow starts (see
// app/api/bot/webhook/route.js) rather than once at chat-creation time, so a customer who left
// the conversation before finishing the questionnaire, or whose lead a partner/sales rep has
// since updated, always sees the CURRENT state — never a stale snapshot. Only ever shows fields
// that are actually set: a lead punched in by a partner with just a name and phone shows a much
// shorter recap than one that went through the full WhatsApp intake, and that's fine.
export function heseosLeadSummary(lead) {
  if (!lead) return '';
  const lines = [];
  if (lead.propertyType) lines.push(`🏠 Property: ${PROPERTY_TYPE_LABEL[lead.propertyType] || lead.propertyType}`);
  if (lead.city) lines.push(`📍 City: ${lead.city}`);
  if (lead.configuration) lines.push(`✨ Package: ${CONFIGURATION_LABEL[lead.configuration] || lead.configuration}`);
  if (lead.budget) lines.push(`💰 Budget: ${BUDGET_LABEL[lead.budget] || lead.budget}`);
  if (lead.timeline) lines.push(`⏳ Timeline: ${TIMELINE_LABEL[lead.timeline] || lead.timeline}`);
  if (lead.demoScheduledAt && lead.demoDate && lead.demoTime) {
    lines.push(`📅 Demo: ${lead.demoDate} at ${lead.demoTime}${lead.salesEngineerId ? '' : ' (awaiting confirmation)'}`);
  }
  return lines.join('\n');
}

// Books a demo straight from a WhatsApp conversation, for a lead that may have come from ANY
// source (Meta, Google, website, partner, employee, or an earlier WhatsApp chat — see
// app/api/bot/webhook/route.js's findFirstLeadByPhone lookup, which is source-agnostic by
// design) — not just leads the bot itself created. Called unconditionally from
// lib/botFlowEngine.js's endHandoff, same "always safe to call" spirit as finalizeHeseosLead
// above: a no-op unless this chat's answers actually hold BOTH a demoDate and a demoTime, which
// only ever happens for the one flow branch that asks for them
// (lib/heseosReturningFlow.js's "Schedule a demo" option).
//
// Mirrors app/api/leads/[id]/route.js's 'scheduleDemo' PATCH type field-for-field — same
// demoScheduledAt/demoDate/demoTime/demoAddress/contactStage shape, and the same "clear any
// earlier outcome" reset — so a demo booked over WhatsApp behaves identically to one a pre-sales
// rep books by hand, including showing up in a sales engineer's "Available Leads" tab
// (components/employee/SalesEngineerPanel.jsx) the moment it's saved: that tab's only
// requirement is demoScheduledAt set + salesEngineerId unset + city match, all satisfied here.
// salesEngineerId is deliberately reset to null even on a re-schedule (a fresh WhatsApp
// conversation booking a NEW date/time over an old one) — a slot whose time just changed needs a
// fresh claim, not to silently stay with whoever claimed the old one.
export async function scheduleHeseosDemo(chat) {
  if (!chat?.leadId) return false;
  const { demoDate, demoTime } = chat.answers || {};
  if (!demoDate || !demoTime) return false;
  try {
    const lead = await dbGetById('leads', chat.leadId);
    if (!lead) return false;
    const now = new Date().toISOString();
    const demoAddress = chat.answers?.demoAddress || lead.demoAddress || '';
    const patch = {
      contactStage: 'qualified',
      demoScheduledAt: now,
      demoScheduledBy: 'whatsapp_bot',
      demoAddress, demoDate, demoTime,
      demoOutcome: null,
      demoOutcomeAt: null,
      demoOutcomeBy: null,
      salesEngineerId: null,
      salesEngineerClaimedAt: null,
    };
    patch.history = pushHistory(lead, {
      event: `Demo Scheduled via WhatsApp — ${demoDate} ${demoTime}`,
      by: 'HESEOS Buddy (WhatsApp)',
      note: demoAddress,
    });
    await dbPatch('leads', chat.leadId, patch);
    return true;
  } catch (err) {
    console.error('scheduleHeseosDemo error:', err);
    return false;
  }
}

// Fetches the lead a chat is linked to (or null if it isn't linked to one yet — every
// white-label chat, always). Small shared helper for the two functions below, and safe to call
// unconditionally.
export async function fetchLinkedLead(chat) {
  if (!chat?.leadId) return null;
  try {
    return await dbGetById('leads', chat.leadId);
  } catch (err) {
    console.error('fetchLinkedLead error:', err);
    return null;
  }
}

// Named conditions a Flow Builder menu option can check against this chat's linked lead before
// deciding which edge to follow — see lib/botFlowEngine.js's menu handling (an option's
// altIf/altHandle/altAnswers). Kept here, not in the generic engine, for the same reason
// syncLeadField/finalizeHeseosLead are: the engine itself should never need to know what "Demo
// Scheduled" means, only that SOME named condition either matched or didn't.
const LEAD_CONDITIONS = {
  // A demo is booked and still pending an outcome — not one that already happened (converted or
  // logged dead), which stageOf already accounts for. This is deliberately narrower than just
  // checking demoScheduledAt, since that field is never cleared once a demo has run its course.
  demoScheduledPending: (lead) => !!lead && stageOf(lead) === 'Demo Scheduled',
};

// Evaluates one menu option's optional data-aware redirect against the lead this chat is linked
// to. Returns null when the option has no redirect configured, the chat has no linked lead, or
// the named condition doesn't match — in every one of those cases the engine just follows the
// option's own edge as normal. When it DOES match, returns the alternate edge handle to follow
// plus a small set of the lead's own current field values (named by the option's altAnswers) to
// drop into chat.answers first, so the alternate branch's message/question text can reference
// them via the exact same {{fieldKey}} template mechanism as any normally-collected answer (see
// lib/heseosReturningFlow.js's "already has a demo" branch, which shows back {{demoDate}} /
// {{demoTime}} / {{demoAddress}} pulled straight off the existing lead this way).
export async function evaluateLeadRedirect(chat, option) {
  if (!option?.altHandle || !option?.altIf) return null;
  const check = LEAD_CONDITIONS[option.altIf];
  if (!check || !chat?.leadId) return null;
  const lead = await fetchLinkedLead(chat);
  if (!check(lead)) return null;
  const extraAnswers = {};
  for (const key of option.altAnswers || []) extraAnswers[key] = lead?.[key];
  return { handle: option.altHandle, extraAnswers };
}

// Appends a canned, static note to the linked lead's audit trail when a handoff node carries one
// (data.leadHistoryEvent — see lib/botFlowEngine.js's endHandoff and play()). Generic in the
// same spirit as everything else in this file: the engine just passes through whatever string
// the flow's own node data holds, with no idea what it means — used today for a returning
// customer's "yes, change the date" / "no, that still works" replies in
// lib/heseosReturningFlow.js, so whoever's assigned to the lead sees the request without the bot
// itself trying to re-negotiate a new slot. A no-op for any chat without a leadId.
export async function appendHeseosLeadHistory(chat, event) {
  if (!chat?.leadId || !event) return false;
  try {
    const lead = await dbGetById('leads', chat.leadId);
    if (!lead) return false;
    await dbPatch('leads', chat.leadId, {
      history: pushHistory(lead, { event, by: 'HESEOS Buddy (WhatsApp)' }),
    });
    return true;
  } catch (err) {
    console.error('appendHeseosLeadHistory error:', err);
    return false;
  }
}
