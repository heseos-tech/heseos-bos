// Proactive, business-initiated WhatsApp notifications — distinct from
// lib/botFlowEngine.js's conversational replies, which only ever fire in response to something
// the customer just typed. These fire off the back of something a HUMAN did inside the app: a
// partner/employee adding a lead (app/api/leads/route.js), a sales engineer claiming a demo
// (app/api/leads/[id]/route.js's 'claim' PATCH type), a partner linking their QR sticker
// (app/api/partner/attribution/qr/route.js) — so the customer/partner/employee on the other end
// hears about it right away instead of only finding out when someone happens to call. Most of
// these go to a CUSTOMER; notifyHeseosPartnerQrClaimed is the exception — it messages the
// PARTNER who just onboarded and, when the QR code they claimed was tagged with one, the
// EMPLOYEE who's credited with onboarding them (lib/attribution.js's claimPartnerQrCode).
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
  const partnerBizName = partner?.businessName || partner?.name || 'your business';
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
