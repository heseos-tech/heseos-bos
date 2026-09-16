// Proactive, business-initiated WhatsApp notifications — distinct from
// lib/botFlowEngine.js's conversational replies, which only ever fire in response to something
// the customer just typed. Most of these fire off the back of something a HUMAN did inside the
// app: a partner/employee adding a lead (app/api/leads/route.js), a sales engineer claiming a
// demo (app/api/leads/[id]/route.js's 'claim' PATCH type), a partner linking their QR sticker
// (app/api/partner/attribution/qr/route.js) — so the customer/partner/employee on the other end
// hears about it right away instead of only finding out when someone happens to call. Most of
// these go to a CUSTOMER; notifyHeseosPartnerQrClaimed is the exception — it messages the
// PARTNER who just onboarded and, when the QR code they claimed was tagged with one, the
// EMPLOYEE who's credited with onboarding them (lib/attribution.js's claimPartnerQrCode).
// notifyHeseosMetaLeadCaptured is a different kind of exception: nobody inside the app did
// anything — it fires straight off the Meta Lead Ads webhook (app/api/leads/meta-webhook/route.js)
// the moment a customer's own Instant Form submission is captured, welcoming them and setting the
// expectation that a person will follow up, since (unlike a partner/employee-entered lead) they
// don't otherwise hear from HESEOS until someone calls.
//
// Always sent from Heseos's own in-house bot tenant's WhatsApp number (lib/attribution.js's
// getHeseosBotTenant) — the same number HESEOS Buddy itself messages from — never a white-label
// tenant's, since every caller here is about Heseos's own shared data regardless of which UI
// (Partner App, Team App, Admin) triggered it.
//
// Deliberately never throws: a notification failing (WhatsApp not configured yet, Meta
// rejecting the send, no phone on file) must never block the action that triggered it — every
// export here just logs and returns quietly on failure.

import { dbGetById, dbInsert, dbPatch, dbList } from '@/lib/db';
import { botSendText, botSendTemplate, botSendDocument, botWaConfigured } from '@/lib/botWhatsapp';
import { getHeseosBotTenant } from '@/lib/attribution';
import { renderToBuffer } from '@react-pdf/renderer';
import QuotationPdfDocument from '@/lib/quotationPdf';
import { buildQuotationShareLink } from '@/lib/quotationShare';
import { HESEOS_RATING_FLOW_ID } from '@/lib/heseosRatingFlow';
import { HESEOS_NO_ANSWER_FLOW_ID } from '@/lib/heseosNoAnswerFlow';

// Partner/employee-entered numbers are stored as whatever ~10 digits the user typed (see
// lib/leadOrigin.js's normalizePhone); WhatsApp's Cloud API needs a full MSISDN with country
// code. Heseos operates in India, so a bare 10-digit number gets '91' prepended; anything else
// (already has a country code, or came in some other shape) is passed through as-is.
function toWhatsAppMsisdn(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

// Creates a bot_chats row for a phone number this bot is messaging FIRST (a partner, an
// employee, a brand-new lead who's never texted HESEOS Buddy) so the conversation shows up in
// components/bot/InboxScreen.jsx's Inbox list right away, instead of the proactive message being
// logged into bot_messages but invisible to anyone watching the Inbox until that person happens
// to reply. firstMessageAt is deliberately left null (unlike a real inbound message's chat row —
// see app/api/bot/webhook/route.js) — that's the marker the webhook handler checks
// ("if (!chat || !chat.firstMessageAt)") to still recognize this person's actual first WhatsApp
// reply as a genuine first-ever message, running the full new-chat welcome/flow-picking logic
// exactly as if this placeholder row never existed, rather than treating them as an existing chat
// with nothing assigned. Safe to call unconditionally — dbInsert upserts, so this never clobbers
// a real conversation that already exists.
async function ensureBotChatForOutbound(tenant, to, lastText, lastAt) {
  await dbInsert('bot_chats', to, {
    id: to, tenantId: tenant.id, phone: to, name: to,
    lastText, lastAt, unread: 0, status: 'open', assignedTo: null,
    botOn: true, lead: null, stage: null, menuRetries: 0, answerRetries: 0, city: '',
    attributionKind: null, attributionLinkId: null,
    flowNodeId: null, answers: {}, activeFlowId: null, autoHandoff: false,
    firstMessageAt: null, createdAt: lastAt,
  });
}

// Sends one WhatsApp message from Heseos's own bot number to ANY phone (a customer, a partner,
// or an employee — the recipient's identity is the caller's business, not this function's), and
// logs it into that phone's bot_chats thread so components/bot/InboxScreen.jsx shows it —
// creating that thread via ensureBotChatForOutbound above if this is the first time this bot has
// ever messaged this number, so it's never silently invisible in the Inbox.
async function sendHeseosWhatsAppMessage(phone, body) {
  if (!phone || !body) return { ok: false, error: 'Missing phone or message body' };
  const tenant = await getHeseosBotTenant();
  if (!tenant || !botWaConfigured(tenant)) {
    console.error('sendHeseosWhatsAppMessage: Heseos bot tenant not configured — notification not sent.');
    return { ok: false, error: 'WhatsApp not configured' };
  }
  const to = toWhatsAppMsisdn(phone);
  const creds = { phoneNumberId: tenant.waPhoneNumberId, token: tenant.waAccessToken };
  const res = await botSendText(creds, to, body);
  try {
    const now = new Date().toISOString();
    const id = res.id || `${to}_N${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    await dbInsert('bot_messages', id, {
      id, tenantId: tenant.id, chatId: to, direction: 'out', body, ts: now,
      status: res.ok ? 'sent' : 'failed', sender: 'bot', error: res.ok ? null : res.error,
    });
    const existingChat = await dbGetById('bot_chats', to);
    if (existingChat) await dbPatch('bot_chats', to, { lastText: body, lastAt: now });
    else await ensureBotChatForOutbound(tenant, to, body, now);
  } catch (err) {
    console.error('sendHeseosWhatsAppMessage logging error:', err);
  }
  return res;
}

// Same delivery/logging contract as sendHeseosWhatsAppMessage above, but sends an APPROVED
// WhatsApp message TEMPLATE instead of free text. Every notification in this file is
// business-initiated (nobody here necessarily messaged HESEOS Buddy first), so free text is
// only reliable within Meta's 24h customer-service window — a template is what lets these go
// out to a partner/lead/employee who's never messaged in at all. `logBody` is the same friendly,
// fully-rendered text the old free-text version sent — what actually goes out over WhatsApp is
// the approved template + params, but the Inbox (components/bot/InboxScreen.jsx) still needs
// readable text to display for this thread, so logBody is what gets written to bot_messages.
async function sendHeseosTemplateMessage(phone, { name, language = 'en_US', params = [] }, logBody) {
  if (!phone) return { ok: false, error: 'Missing phone number' };
  const tenant = await getHeseosBotTenant();
  if (!tenant || !botWaConfigured(tenant)) {
    console.error('sendHeseosTemplateMessage: Heseos bot tenant not configured — notification not sent.');
    return { ok: false, error: 'WhatsApp not configured' };
  }
  const to = toWhatsAppMsisdn(phone);
  const creds = { phoneNumberId: tenant.waPhoneNumberId, token: tenant.waAccessToken };
  const res = await botSendTemplate(creds, to, { name, language, params });
  try {
    const now = new Date().toISOString();
    const id = res.id || `${to}_N${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    await dbInsert('bot_messages', id, {
      id, tenantId: tenant.id, chatId: to, direction: 'out', body: logBody, ts: now,
      status: res.ok ? 'sent' : 'failed', sender: 'bot', error: res.ok ? null : res.error,
    });
    const existingChat = await dbGetById('bot_chats', to);
    if (existingChat) await dbPatch('bot_chats', to, { lastText: logBody, lastAt: now });
    else await ensureBotChatForOutbound(tenant, to, logBody, now);
  } catch (err) {
    console.error('sendHeseosTemplateMessage logging error:', err);
  }
  return res;
}

// Routes a lead's WhatsApp chat into lib/heseosRatingFlow.js so their NEXT reply is captured as
// a 1-5 rating instead of being treated as a normal message — call this right after the
// combined "closing message + rating ask" template above has actually sent (never before: the
// chat row this patches is the one sendHeseosTemplateMessage/ensureBotChatForOutbound just
// created or touched, keyed by the same normalized MSISDN). `role` is 'preSales' or
// 'salesEngineer' — see lib/heseosLeadSync.js's submitHeseosRating, which reads it back off
// chat.answers once the customer finishes the flow. Never throws; a failure here just means
// this one customer doesn't get asked, not that the notification/action that triggered it fails.
async function activateHeseosRatingFlow(lead, role, employeeName) {
  if (!lead?.phone) return;
  try {
    const to = toWhatsAppMsisdn(lead.phone);
    const existingChat = await dbGetById('bot_chats', to);
    const answers = { ...(existingChat?.answers || {}), ratingRole: role, ratingEmployeeName: employeeName || 'our team' };
    await dbPatch('bot_chats', to, {
      activeFlowId: HESEOS_RATING_FLOW_ID,
      flowNodeId: null,
      leadId: lead.id,
      answers,
      botOn: true,
      autoHandoff: false,
      menuRetries: 0,
      answerRetries: 0,
    });
  } catch (err) {
    console.error('activateHeseosRatingFlow error:', err);
  }
}

// Same routing trick as activateHeseosRatingFlow above, for lib/heseosNoAnswerFlow.js instead —
// call right after notifyHeseosNoAnswerNudge's template has actually sent, so the chat row this
// patches (keyed by the same normalized MSISDN) already exists. No role/employeeName to carry
// here (see that flow's own header comment for why it asks nothing about which person).
async function activateHeseosNoAnswerFlow(lead) {
  if (!lead?.phone) return;
  try {
    const to = toWhatsAppMsisdn(lead.phone);
    await dbPatch('bot_chats', to, {
      activeFlowId: HESEOS_NO_ANSWER_FLOW_ID,
      flowNodeId: null,
      leadId: lead.id,
      botOn: true,
      autoHandoff: false,
      menuRetries: 0,
      answerRetries: 0,
    });
  } catch (err) {
    console.error('activateHeseosNoAnswerFlow error:', err);
  }
}

// Fired when a partner or employee adds a new lead (app/api/leads/route.js) — tells the customer
// who registered them, in a "Name, Heseos Partner/Team Member" shape a person can recognize, and
// that our team will follow up. `addedByLabel` is built by the caller (who already knows whether
// this was a partner or an employee, and has their name) — kept generic here on purpose so this
// function doesn't need its own partner/employee lookups. Never fired for Meta/Google/website
// leads (the customer already knows they submitted those themselves) or WhatsApp-sourced leads
// (HESEOS Buddy's own conversation already establishes contact).
export async function notifyHeseosLeadAdded(lead, addedByLabel) {
  if (!lead?.phone || !addedByLabel) return { ok: false, error: 'Missing lead phone or addedByLabel' };
  const firstName = lead.name ? String(lead.name).trim().split(/\s+/)[0] : 'there';
  const body = [
    `Hi ${firstName}! 👋 This is HESEOS.`,
    '',
    `${addedByLabel} has added your details with us for a smart home consultation.`,
    '',
    'Someone from our team will get in touch with you shortly to understand your requirements better. Thank you for choosing HESEOS! 😊',
  ].join('\n');
  return sendHeseosTemplateMessage(
    lead.phone,
    { name: 'lead_added_notify', params: [firstName, addedByLabel] },
    body
  );
}

// Fired the moment a Meta Instant Form submission is captured into `leads`
// (app/api/leads/meta-webhook/route.js, right after the dbInsert) — the customer just submitted
// a lead form on Facebook/Instagram themselves, so unlike notifyHeseosLeadAdded above (which
// tells a customer that a PARTNER/EMPLOYEE typed their details in on their behalf) this is a
// genuine first contact: they don't yet know HESEOS actually received it, so this confirms the
// submission landed and sets the expectation that a real person — not a bot — follows up.
// Deliberately narrow to Meta for now, matching what was asked for; Google Ads / website form
// leads (app/api/leads/google-ads-webhook, app/api/leads/route.js) don't get this.
//
// Uses the 'meta_lead_welcome' WhatsApp template (Utility category, en_US, one {{1}} variable
// for the customer's first name) — approved in Meta Business Manager. The first submitted wording
// ("Thank you for your interest in HESEOS smart home solutions") read as promotional to Meta's
// classifier and got flagged for Marketing, same thing that happened to
// 'newpartner_onboarding_welcome' (see notifyHeseosPartnerQrClaimed's comment); the plainer
// rewrite below is what actually got approved. The `body` text must match the approved
// template's wording exactly, including "We have" rather than "We've" — Meta rejects the send
// outright if the text sent doesn't match what was approved, not just if the template doesn't
// exist.
export async function notifyHeseosMetaLeadCaptured(lead) {
  if (!lead?.phone) return { ok: false, error: 'Lead has no phone number' };
  const firstName = lead.name ? String(lead.name).trim().split(/\s+/)[0] : 'there';
  const body = [
    `Hi ${firstName}! 👋 We have received your enquiry with HESEOS.`,
    '',
    'One of our customer experience representatives will contact you shortly.',
    '',
    '— Team HESEOS',
  ].join('\n');
  return sendHeseosTemplateMessage(
    lead.phone,
    { name: 'meta_lead_welcome', params: [firstName] },
    body
  );
}

// Fired the moment a sales engineer claims an open demo (app/api/leads/[id]/route.js's 'claim'
// PATCH type) — tells the customer who's coming and reconfirms the date/time/address so there's
// no confusion on the day.
export async function notifyHeseosDemoClaimed(lead, engineer) {
  if (!lead?.phone) return { ok: false, error: 'Lead has no phone number' };
  const firstName = lead.name ? String(lead.name).trim().split(/\s+/)[0] : 'there';
  const engineerName = engineer?.name || 'one of our engineers';
  const body = [
    `Hi ${firstName}! 👋 Great news —`,
    `${engineerName} from HESEOS has been assigned as your sales engineer for your upcoming smart home demo. 🎉`,
    '',
    `📅 Date: ${lead.demoDate || 'TBC'}`,
    `⏰ Time: ${lead.demoTime || 'TBC'}`,
    `📍 Address: ${lead.demoAddress || 'TBC'}`,
    '',
    `${engineerName} will reach out to confirm and guide you further. Looking forward to seeing you! 😊`,
    '— Team HESEOS',
  ].join('\n');
  return sendHeseosTemplateMessage(
    lead.phone,
    {
      name: 'demo_engineer_assigned',
      params: [firstName, engineerName, lead.demoDate || 'TBC', lead.demoTime || 'TBC', lead.demoAddress || 'TBC'],
    },
    body
  );
}

// Fired when pre-sales successfully books a demo (app/api/leads/[id]/route.js's 'scheduleDemo'
// PATCH type) — a plain confirmation of the slot BEFORE any sales engineer has claimed it (who's
// actually coming isn't known yet — see notifyHeseosDemoClaimed above, which fires that part
// once someone does), plus the pre-sales stage's own rating ask, since pre-sales' job on this
// lead is done the moment a demo is booked.
//
// Needs a new Meta template — submit as Utility, en_US, params in this order: {{1}} first name,
// {{2}} date, {{3}} time, {{4}} pre-sales exec's first name. Suggested text (Meta rejects
// anything that reads as promotional — see notifyHeseosMetaLeadCaptured's own history with this):
//   "Hi {{1}}, your HESEOS smart home demo is scheduled for {{2}} at {{3}}. Our team will
//   confirm the visiting engineer shortly.
//
//   Before that — how would you rate your experience with {{4}} so far? Reply with a number
//   from 1 to 5.
//
//   — Team HESEOS"
export async function notifyHeseosDemoScheduled(lead, presalesEmployee) {
  if (!lead?.phone) return { ok: false, error: 'Lead has no phone number' };
  const firstName = lead.name ? String(lead.name).trim().split(/\s+/)[0] : 'there';
  const presalesName = presalesEmployee?.name || 'our team';
  const body = [
    `Hi ${firstName}! 👋 Your HESEOS smart home demo is scheduled.`,
    '',
    `📅 Date: ${lead.demoDate || 'TBC'}`,
    `⏰ Time: ${lead.demoTime || 'TBC'}`,
    '',
    "We'll confirm which engineer is visiting shortly.",
    '',
    `Before that — how would you rate your experience with ${presalesName} so far? Reply with a number from 1 to 5 ⭐`,
    '— Team HESEOS',
  ].join('\n');
  const res = await sendHeseosTemplateMessage(
    lead.phone,
    { name: 'demo_scheduled_rating', params: [firstName, lead.demoDate || 'TBC', lead.demoTime || 'TBC', presalesName] },
    body
  );
  if (res.ok) await activateHeseosRatingFlow(lead, 'preSales', presalesName);
  return res;
}

// Fired when pre-sales logs a lead as Not Interested (app/api/leads/[id]/route.js's 'contact'
// PATCH type) — a plain, Utility-safe goodbye plus the pre-sales stage's rating ask, since this
// is also where the pre-sales stage of the journey ends for this lead.
//
// Needs a new Meta template — Utility, en_US, params: {{1}} first name, {{2}} pre-sales exec's
// first name. Suggested text:
//   "Hi {{1}}, thank you for speaking with our team about HESEOS smart home solutions. We've
//   noted that this isn't the right time for you — no problem at all.
//
//   Before you go, how would you rate your experience with {{2}}? Reply with a number from 1
//   to 5.
//
//   Whenever you're ready to explore a smarter home, we'll be here.
//   — Team HESEOS"
export async function notifyHeseosContactRejected(lead, presalesEmployee) {
  if (!lead?.phone) return { ok: false, error: 'Lead has no phone number' };
  const firstName = lead.name ? String(lead.name).trim().split(/\s+/)[0] : 'there';
  const presalesName = presalesEmployee?.name || 'our team';
  const body = [
    `Hi ${firstName}! 👋 Thank you for speaking with our team about HESEOS smart home solutions.`,
    "We've noted that this isn't the right time for you — no problem at all.",
    '',
    `Before you go, how would you rate your experience with ${presalesName}? Reply with a number from 1 to 5 ⭐`,
    '',
    "Whenever you're ready to explore a smarter home, we'll be here. 💚",
    '— Team HESEOS',
  ].join('\n');
  const res = await sendHeseosTemplateMessage(
    lead.phone,
    { name: 'presales_rejected_rating', params: [firstName, presalesName] },
    body
  );
  if (res.ok) await activateHeseosRatingFlow(lead, 'preSales', presalesName);
  return res;
}

// Fired when pre-sales logs a Follow-up Later outcome with a follow-up date/time
// (app/api/leads/[id]/route.js's 'contact' PATCH type) — NOT a terminal outcome (the lead stays
// in pre-sales' queue), so unlike the two functions above this asks nothing and starts no rating
// flow, it's purely a "we heard you, here's when we'll call back" confirmation.
//
// Needs a new Meta template — Utility, en_US, params: {{1}} first name, {{2}} follow-up date,
// {{3}} follow-up time. Suggested text:
//   "Hi {{1}}, thanks for your patience! We'll get back to you on {{2}} around {{3}}. If
//   anything changes before then, just message us here anytime.
//   — Team HESEOS"
export async function notifyHeseosFollowUpConfirmed(lead, followUpAt) {
  if (!lead?.phone) return { ok: false, error: 'Lead has no phone number' };
  const firstName = lead.name ? String(lead.name).trim().split(/\s+/)[0] : 'there';
  const d = followUpAt ? new Date(followUpAt) : null;
  const dateLabel = d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'soon';
  const timeLabel = d && !Number.isNaN(d.getTime()) ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';
  const body = [
    `Hi ${firstName}! 👋 Thanks for your patience!`,
    '',
    `We'll get back to you on ${dateLabel}${timeLabel ? ` around ${timeLabel}` : ''}.`,
    '',
    'If anything changes before then, just message us here anytime. 😊',
    '— Team HESEOS',
  ].join('\n');
  return sendHeseosTemplateMessage(
    lead.phone,
    { name: 'presales_followup_confirmed', params: [firstName, dateLabel, timeLabel || 'TBC'] },
    body
  );
}

// Fired for any RESCHEDULE-kind demoOutcome (out_of_station, future_demo, engineer_no_contact —
// see lib/leadStage.js's DEMO_OUTCOME_KIND) from app/api/leads/[id]/route.js's 'demoOutcome'
// PATCH type. Two shapes depending on whether the sales engineer already had a new date/time to
// offer in the same action (the existing PATCH type already supports this — see its own
// comment): a firm re-confirmation if so, or an "we'll be in touch to find a new time" holding
// message if not. No rating ask here — this isn't a terminal outcome for the sales engineer.
//
// Needs a new Meta template — Utility, en_US, params: {{1}} first name, {{2}} either the new
// date/time or a placeholder. Suggested text (two variants — submit whichever fits your
// wording; a single template with an optional-looking {{2}} is simplest):
//   With a new slot: "Hi {{1}}, no problem — your HESEOS demo has been rescheduled. New slot:
//   {{2}}. See you then! — Team HESEOS"
//   Without one yet: "Hi {{1}}, no problem — let's find another time for your HESEOS demo. Our
//   team will reach out shortly to confirm a new slot. — Team HESEOS"
export async function notifyHeseosDemoReschedule(lead) {
  if (!lead?.phone) return { ok: false, error: 'Lead has no phone number' };
  const firstName = lead.name ? String(lead.name).trim().split(/\s+/)[0] : 'there';
  const hasNewSlot = !!(lead.demoDate && lead.demoTime);
  const slotLabel = hasNewSlot ? `${lead.demoDate} at ${lead.demoTime}` : 'TBC';
  const body = hasNewSlot
    ? [`Hi ${firstName}! 👋 No problem — your HESEOS demo has been rescheduled.`, '', `📅 New slot: ${slotLabel}`, '', 'See you then! 😊', '— Team HESEOS'].join('\n')
    : [`Hi ${firstName}! 👋 No problem — let's find another time for your HESEOS demo.`, '', "Our team will reach out shortly to confirm a new slot.", '— Team HESEOS'].join('\n');
  return sendHeseosTemplateMessage(
    lead.phone,
    { name: 'demo_reschedule_notify', params: [firstName, slotLabel] },
    body
  );
}

// Fired when a sales engineer logs 'rejected_before_demo' (app/api/leads/[id]/route.js's
// 'demoOutcome' PATCH type) — the customer backed out before the visit even happened. Plain
// goodbye, deliberately NO rating ask (see lib/leadStage.js's comment on why: no demo actually
// took place, so there's nothing concrete for the engineer to be rated on).
//
// Needs a new Meta template — Utility, en_US, params: {{1}} first name. Suggested text:
//   "Hi {{1}}, understood — we've cancelled the demo for now. If you'd like to explore smart
//   home solutions in the future, just message us anytime.
//   — Team HESEOS"
export async function notifyHeseosDemoRejectedBeforeDemo(lead) {
  if (!lead?.phone) return { ok: false, error: 'Lead has no phone number' };
  const firstName = lead.name ? String(lead.name).trim().split(/\s+/)[0] : 'there';
  const body = [
    `Hi ${firstName}! 👋 Understood — we've cancelled the demo for now.`,
    '',
    "If you'd like to explore smart home solutions in the future, just message us anytime. 💚",
    '— Team HESEOS',
  ].join('\n');
  return sendHeseosTemplateMessage(
    lead.phone,
    { name: 'demo_rejected_before_notify', params: [firstName] },
    body
  );
}

// Fired when a sales engineer marks a lead Converted (app/api/leads/[id]/route.js's
// 'demoOutcome' PATCH type, demoOutcome: 'converted') — this is also the moment a quotation that
// had gone out is implicitly ACCEPTED (see that PATCH handler setting quotationStatus itself;
// this function only ever sends the message + starts the rating). Congratulates them and asks
// for the sales engineer's rating, since the engineer's stage of the journey ends here.
//
// Needs a new Meta template — submit as Utility even though it's a happy outcome; keep the
// wording plain and factual, not celebratory ("Congratulations!" reads as promotional to Meta's
// classifier — see notifyHeseosMetaLeadCaptured's own rejection history for exactly this
// mistake). Params: {{1}} first name, {{2}} sales engineer's first name. Suggested text:
//   "Hi {{1}}, thank you for choosing HESEOS for your smart home setup. Our team will be in
//   touch about the next steps shortly.
//
//   Before that — how would you rate your experience with {{2}}? Reply with a number from 1
//   to 5.
//   — Team HESEOS"
export async function notifyHeseosDemoConvertedRating(lead, engineer) {
  if (!lead?.phone) return { ok: false, error: 'Lead has no phone number' };
  const firstName = lead.name ? String(lead.name).trim().split(/\s+/)[0] : 'there';
  const engineerName = engineer?.name || 'our team';
  const body = [
    `Hi ${firstName}! 👋 Thank you for choosing HESEOS for your smart home setup.`,
    '',
    "Our team will be in touch about the next steps shortly.",
    '',
    `Before that — how would you rate your experience with ${engineerName}? Reply with a number from 1 to 5 ⭐`,
    '— Team HESEOS',
  ].join('\n');
  const res = await sendHeseosTemplateMessage(
    lead.phone,
    { name: 'demo_converted_rating', params: [firstName, engineerName] },
    body
  );
  if (res.ok) await activateHeseosRatingFlow(lead, 'salesEngineer', engineerName);
  return res;
}

// Fired when a sales engineer marks 'not_interested_after_demo' (app/api/leads/[id]/route.js's
// 'demoOutcome' PATCH type) — this is also the moment a quotation that had gone out is
// implicitly REJECTED (same PATCH handler sets quotationStatus itself). Plain, Utility-safe
// goodbye plus the sales-engineer rating ask, since the engineer's stage of the journey ends
// here too.
//
// Needs a new Meta template — Utility, en_US, params: {{1}} first name, {{2}} sales engineer's
// first name. Suggested text:
//   "Hi {{1}}, thank you for considering HESEOS for your smart home needs. We understand this
//   isn't the right time — no worries at all.
//
//   Before you go, how would you rate your experience with {{2}}? Reply with a number from 1
//   to 5.
//
//   Whenever you're ready, we'll be here.
//   — Team HESEOS"
export async function notifyHeseosDemoRejectedRating(lead, engineer) {
  if (!lead?.phone) return { ok: false, error: 'Lead has no phone number' };
  const firstName = lead.name ? String(lead.name).trim().split(/\s+/)[0] : 'there';
  const engineerName = engineer?.name || 'our team';
  const body = [
    `Hi ${firstName}! 👋 Thank you for considering HESEOS for your smart home needs.`,
    "We understand this isn't the right time — no worries at all.",
    '',
    `Before you go, how would you rate your experience with ${engineerName}? Reply with a number from 1 to 5 ⭐`,
    '',
    "Whenever you're ready, we'll be here. 💚",
    '— Team HESEOS',
  ].join('\n');
  const res = await sendHeseosTemplateMessage(
    lead.phone,
    { name: 'demo_rejected_after_rating', params: [firstName, engineerName] },
    body
  );
  if (res.ok) await activateHeseosRatingFlow(lead, 'salesEngineer', engineerName);
  return res;
}

// Fired when Admin or a Sales Engineer clicks "Send on WhatsApp" on a quotation
// (app/api/leads/[id]/quotation-pdf/send/route.js) — renders that exact revision as a PDF
// (lib/quotationPdf.jsx) and sends it as a WhatsApp document message, with a friendly caption
// that also carries a "quotation link" (lib/quotationShare.js's buildQuotationShareLink) — a
// public, no-login page (app/quotation/[token]/page.jsx) the customer can reopen anytime, from
// any device, without having to dig the PDF back out of their WhatsApp media. The link is left
// out of the caption entirely (rather than sent broken) when PUBLIC_BASE_URL isn't set in this
// environment yet — the PDF attachment alone still goes out either way. Unlike the other
// notifications in this file, this one is triggered by an explicit human action, not a side
// effect of a lead/demo write, so app/api/leads/[id]/quotation-pdf/send/route.js is the one
// place that actually awaits and surfaces the result to whoever clicked the button, rather than
// firing-and-forgetting it.
export async function sendHeseosQuotationPdf(lead, revision) {
  if (!lead?.phone) return { ok: false, error: 'Lead has no phone number' };
  if (!revision) return { ok: false, error: 'No quotation revision to send' };
  const tenant = await getHeseosBotTenant();
  if (!tenant || !botWaConfigured(tenant)) {
    return { ok: false, error: 'WhatsApp is not configured for the Heseos bot yet — set it up in Bot Configuration first.' };
  }

  const products = await dbList('products').catch(() => []);

  let buffer;
  try {
    buffer = await renderToBuffer(QuotationPdfDocument({ lead, revision, products }));
  } catch (e) {
    console.error('sendHeseosQuotationPdf: PDF render failed:', e);
    return { ok: false, error: 'Could not generate the quotation PDF' };
  }

  const to = toWhatsAppMsisdn(lead.phone);
  const creds = { phoneNumberId: tenant.waPhoneNumberId, token: tenant.waAccessToken };
  const safeName = String(lead.name || 'quotation').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const filename = `quotation-${safeName}-v${revision.revision}.pdf`;
  const firstName = lead.name ? String(lead.name).trim().split(/\s+/)[0] : 'there';
  const amountLabel = revision.amount != null ? `₹${Number(revision.amount).toLocaleString('en-IN')}` : null;

  let shareLink = null;
  try {
    shareLink = buildQuotationShareLink(lead.id, revision.revision);
  } catch (e) {
    console.error('sendHeseosQuotationPdf: could not build share link:', e);
  }

  const captionLines = [
    `Hi ${firstName}! 👋 Your smart home quotation from HESEOS is ready${amountLabel ? ` — ${amountLabel}` : ''}. 🎉`,
    '',
    "We've attached the PDF above for you.",
  ];
  if (shareLink) {
    captionLines.push(`You can also view it anytime here: ${shareLink}`);
  }
  captionLines.push('', 'Let us know if you have any questions — happy to help! 😊');
  const caption = captionLines.join('\n');

  const res = await botSendDocument(creds, to, { buffer, filename, mimeType: 'application/pdf', caption });
  try {
    const now = new Date().toISOString();
    const id = res.id || `${to}_N${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    await dbInsert('bot_messages', id, {
      id, tenantId: tenant.id, chatId: to, direction: 'out',
      body: `📄 Quotation PDF sent (v${revision.revision})${amountLabel ? ` — ${amountLabel}` : ''}`,
      ts: now, status: res.ok ? 'sent' : 'failed', sender: 'bot', error: res.ok ? null : res.error,
    });
    const existingChat = await dbGetById('bot_chats', to);
    const quotationLastText = `Quotation PDF sent (v${revision.revision})`;
    if (existingChat) await dbPatch('bot_chats', to, { lastText: quotationLastText, lastAt: now });
    else await ensureBotChatForOutbound(tenant, to, quotationLastText, now);
  } catch (err) {
    console.error('sendHeseosQuotationPdf logging error:', err);
  }
  return res;
}

// Fired when a partner successfully links a pre-printed QR sticker to their account
// (app/api/partner/attribution/qr/route.js) — the moment "onboarding" is genuinely complete on
// both sides, since it's the first time we actually know which employee handed them that
// sticker (if the code was tagged with one at generation time — see
// createBlankPartnerQrCodes/GrowthPage's "Create Partner QR Codes"). The caller only invokes
// this when claimPartnerQrCode just set partner.onboardedByEmployeeId for the first time (same
// first-touch condition that function already applies), so this never re-fires "Welcome!" on a
// partner's second/third QR code, and an employee is never thanked for onboarding a partner
// someone else already gets credit for.
//
// Two independent sends: the partner gets a friendly welcome naming the employee ("<Name>, a
// HESEOS team member, onboarded you"); that same employee gets a thank-you naming the partner's
// business ("Thank you for onboarding <Business> as a HESEOS Partner!"). Either side's phone
// number can be missing or the send can fail without affecting the other — same
// never-throws-and-never-blocks-the-actual-write contract as every export in this file.
export async function notifyHeseosPartnerQrClaimed(partner, employeeId) {
  const employee = employeeId ? await dbGetById('employees', employeeId) : null;
  const partnerBizName = partner?.shopName || partner?.businessName || partner?.name || 'your business';
  const partnerFirstName = partner?.name ? String(partner.name).trim().split(/\s+/)[0] : 'there';

  let partnerResult = { ok: false, error: 'Partner has no phone number' };
  if (partner?.phone) {
    const partnerBody = [
      `Hi ${partnerFirstName}! 👋 Welcome to the HESEOS Partner Network! 🎉`,
      '',
      employee?.name
        ? `${employee.name}, a HESEOS team member, has onboarded you as an official HESEOS Partner.`
        : "You're now an official HESEOS Partner.",
      '',
      'Start punching leads from the Partner App and earn on every conversion. Excited to grow together! 😊',
      '— Team HESEOS',
    ].join('\n');
    // Template history: 'partner_onboarding_welcome' never got Meta approval;
    // 'newpartner_onboarding_welcome' got stuck as Marketing category (celebratory/incentive
    // wording tripped Meta's classifier); 'partner_onboarding_message' is the plain, factual
    // rewrite submitted as Utility — "Hi {{1}}, your HESEOS Partner account has been activated
    // by {{2}}. You can now submit leads through the Partner App or share your QR code with
    // customers." Same two-variable shape as before: {{1}} partner's first name, {{2}} the
    // onboarding employee's first name (or a plain fallback) — no suffix text needed since the
    // template body already states "has been activated by {{2}}".
    partnerResult = await sendHeseosTemplateMessage(
      partner.phone,
      {
        name: 'partner_onboarding_message',
        params: [partnerFirstName, employee?.name ? String(employee.name).trim().split(/\s+/)[0] : 'Someone'],
      },
      partnerBody
    );
  }

  let employeeResult = null;
  if (employee?.phone) {
    const employeeFirstName = employee.name ? String(employee.name).trim().split(/\s+/)[0] : 'there';
    const employeeBody = [
      `Hi ${employeeFirstName}! 👋`,
      '',
      `Thank you for onboarding ${partnerBizName} as a HESEOS Partner! 🎉`,
      '',
      "They've linked their QR code and are all set to start referring leads — great work!",
      '— Team HESEOS',
    ].join('\n');
    employeeResult = await sendHeseosTemplateMessage(
      employee.phone,
      { name: 'employee_partner_onboarded', params: [employeeFirstName, partnerBizName] },
      employeeBody
    );
  }

  return { partner: partnerResult, employee: employeeResult };
}

// Fired the moment a customer's QR-code scan turns into a genuinely NEW, credited lead — see
// lib/heseosLeadSync.js's finalizeHeseosLead, the one caller, right after createHeseosLead sets
// lead.partnerId. Lets the partner know their QR code just worked in real time, instead of only
// finding out later when they happen to check the Partner App. Deliberately scoped to an actual
// QR-code SCAN (the caller only invokes this for link.kind === 'qr_partner') — sharing a
// referral LINK (referral_partner) is a different action and gets no notification here.
// lead.partnerId being set at all already guarantees this is the first-ever lead for that phone
// number (see createHeseosLead's own "Not credited" duplicate-phone branch), so this can never
// double-notify a partner off the same customer's later messages.
export async function notifyHeseosPartnerQrLeadCreated(partner, lead) {
  if (!partner?.phone) return { ok: false, error: 'Partner has no phone number' };
  const partnerFirstName = partner.name ? String(partner.name).trim().split(/\s+/)[0] : 'there';
  const leadFirstName = lead?.name ? String(lead.name).trim().split(/\s+/)[0] : 'A customer';
  const body = [
    `Hi ${partnerFirstName}! 👋`,
    '',
    `${leadFirstName} just scanned your QR code and enquired about a smart home setup. We've noted their details and our team will reach out to them shortly.`,
    '',
    '— Team HESEOS',
  ].join('\n');
  return sendHeseosTemplateMessage(
    partner.phone,
    { name: 'qr_lead_scanned_partner_notify', params: [partnerFirstName, leadFirstName] },
    body
  );
}

// Fired by app/api/cron/lead-reminders/route.js when a lead has sat in contactStage
// 'call_not_picked' for a while with nobody having reached them — the automated counterpart to
// pre-sales' own manual re-call attempts, so a lead doesn't just go cold sitting unworked in a
// queue. The customer-facing wording is identical on every attempt (1-3, capped by the cron
// route, which is also what logs the attempt number onto the lead's history — this function
// only ever sends the message) — a WhatsApp template's approved text is fixed, so there's no
// separate "final attempt" variant to pick between here. Starts lib/heseosNoAnswerFlow.js right
// after sending so the customer's next reply (if any) is captured as "still interested" /
// "not right now" instead of falling through to whatever flow/menu they'd otherwise land on.
//
// Needs a new Meta template — Utility, en_US, params: {{1}} first name. Suggested text:
//   "Hi {{1}}, we tried reaching you about your HESEOS smart home enquiry but couldn't connect.
//   Are you still interested? Just reply here and our team will get back to you.
//   — Team HESEOS"
export async function notifyHeseosNoAnswerNudge(lead) {
  if (!lead?.phone) return { ok: false, error: 'Lead has no phone number' };
  const firstName = lead.name ? String(lead.name).trim().split(/\s+/)[0] : 'there';
  const body = [
    `Hi ${firstName}! 👋 We tried reaching you about your HESEOS smart home enquiry but couldn't connect.`,
    '',
    'Are you still interested? Just reply here and our team will get back to you. 😊',
    '— Team HESEOS',
  ].join('\n');
  const res = await sendHeseosTemplateMessage(
    lead.phone,
    { name: 'no_answer_nudge', params: [firstName] },
    body
  );
  if (res.ok) await activateHeseosNoAnswerFlow(lead);
  return res;
}

// Fired by app/api/cron/lead-reminders/route.js 24h and 2h before a booked demo
// (lead.demoScheduledAt set, no demoOutcome logged yet) — a plain reminder so the customer
// doesn't forget the visit; no rating ask, no flow activation (this isn't a stage-closing
// moment, just a courtesy nudge). `which` is 'h24' or 'h2', purely to pick the wording/template
// — the cron route tracks demoReminder24hSentAt/demoReminder2hSentAt on the lead itself so each
// only ever fires once per booked slot (both get cleared any time the demo is (re)scheduled —
// see app/api/leads/[id]/route.js's 'scheduleDemo' branch and the reschedule branch of
// 'demoOutcome').
//
// Needs two new Meta templates — both Utility, en_US, params: {{1}} first name, {{2}} date,
// {{3}} time. Suggested text:
//   24h ('demo_reminder_24h'): "Hi {{1}}, just a reminder — your HESEOS smart home demo is
//   scheduled for tomorrow, {{2}} at {{3}}. Looking forward to it! — Team HESEOS"
//   2h ('demo_reminder_2h'): "Hi {{1}}, your HESEOS smart home demo is coming up today at
//   {{3}} ({{2}}). See you soon! — Team HESEOS"
export async function notifyHeseosDemoReminder(lead, which) {
  if (!lead?.phone) return { ok: false, error: 'Lead has no phone number' };
  const firstName = lead.name ? String(lead.name).trim().split(/\s+/)[0] : 'there';
  const isH24 = which === 'h24';
  const body = isH24
    ? [`Hi ${firstName}! 👋 Just a reminder — your HESEOS smart home demo is scheduled for tomorrow, ${lead.demoDate || 'TBC'} at ${lead.demoTime || 'TBC'}.`, '', 'Looking forward to it! 😊', '— Team HESEOS'].join('\n')
    : [`Hi ${firstName}! 👋 Your HESEOS smart home demo is coming up today at ${lead.demoTime || 'TBC'} (${lead.demoDate || 'TBC'}).`, '', 'See you soon! 😊', '— Team HESEOS'].join('\n');
  return sendHeseosTemplateMessage(
    lead.phone,
    { name: isH24 ? 'demo_reminder_24h' : 'demo_reminder_2h', params: [firstName, lead.demoDate || 'TBC', lead.demoTime || 'TBC'] },
    body
  );
}
