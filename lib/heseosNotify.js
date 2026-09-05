// Proactive, business-initiated WhatsApp notifications to a CUSTOMER — distinct from
// lib/botFlowEngine.js's conversational replies, which only ever fire in response to something
// the customer just typed. These fire off the back of something a HUMAN did inside the app: a
// partner/employee adding a lead (app/api/leads/route.js), a sales engineer claiming a demo
// (app/api/leads/[id]/route.js's 'claim' PATCH type) — so the customer hears about it right
// away instead of only finding out when someone happens to call.
//
// Always sent from Heseos's own in-house bot tenant's WhatsApp number (lib/attribution.js's
// getHeseosBotTenant) — the same number HESEOS Buddy itself messages from — never a white-label
// tenant's, since every caller here is about Heseos's own shared `leads` table regardless of
// which UI (Partner App, Team App, Admin) triggered it.
//
// Deliberately never throws: a notification failing (WhatsApp not configured yet, Meta
// rejecting the send, no phone on file) must never block the lead-creation or demo-claim action
// that triggered it — every export here just logs and returns quietly on failure.

import { dbGetById, dbInsert, dbPatch, dbList } from '@/lib/db';
import { botSendText, botSendDocument, botWaConfigured } from '@/lib/botWhatsapp';
import { getHeseosBotTenant } from '@/lib/attribution';
import { renderToBuffer } from '@react-pdf/renderer';
import QuotationPdfDocument from '@/lib/quotationPdf';

// Partner/employee-entered numbers are stored as whatever ~10 digits the user typed (see
// lib/leadOrigin.js's normalizePhone); WhatsApp's Cloud API needs a full MSISDN with country
// code. Heseos operates in India, so a bare 10-digit number gets '91' prepended; anything else
// (already has a country code, or came in some other shape) is passed through as-is.
function toWhatsAppMsisdn(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

// Sends one WhatsApp message to a customer from Heseos's own bot number, and — only if this
// phone number already has a bot_chats row (i.e. they've messaged HESEOS Buddy before) — logs
// it into that same thread so components/bot/InboxScreen.jsx shows one continuous conversation.
// Deliberately does NOT create a new bot_chats row when one doesn't exist yet: doing so would
// make app/api/bot/webhook/route.js's "if (!chat)" brand-new-chat branch — which is where the
// existing-lead/returning-flow routing decision happens — think this customer's actual first
// WhatsApp message is a continuation of something, silently skipping that whole check. A
// customer with no prior chat still gets the message; it just won't show in the Inbox until
// they message in themselves.
async function sendHeseosCustomerMessage(phone, body) {
  if (!phone || !body) return { ok: false, error: 'Missing phone or message body' };
  const tenant = await getHeseosBotTenant();
  if (!tenant || !botWaConfigured(tenant)) {
    console.error('sendHeseosCustomerMessage: Heseos bot tenant not configured — notification not sent.');
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
  } catch (err) {
    console.error('sendHeseosCustomerMessage logging error:', err);
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
  return sendHeseosCustomerMessage(lead.phone, body);
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
  return sendHeseosCustomerMessage(lead.phone, body);
}

// Fired when Admin or a Sales Engineer clicks "Send on WhatsApp" on a quotation
// (app/api/leads/[id]/quotation-pdf/send/route.js) — renders that exact revision as a PDF
// (lib/quotationPdf.jsx) and sends it as a WhatsApp document message. Unlike the other
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
  const caption = `Hi ${firstName}! 👋 Here's your quotation from HESEOS — ${revision.amount != null ? `₹${Number(revision.amount).toLocaleString('en-IN')}` : ''}. Let us know if you have any questions! 😊`;

  const res = await botSendDocument(creds, to, { buffer, filename, mimeType: 'application/pdf', caption });
  try {
    const now = new Date().toISOString();
    const id = res.id || `${to}_N${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    await dbInsert('bot_messages', id, {
      id, tenantId: tenant.id, chatId: to, direction: 'out',
      body: `📄 Quotation PDF sent (v${revision.revision})${revision.amount != null ? ` — ₹${Number(revision.amount).toLocaleString('en-IN')}` : ''}`,
      ts: now, status: res.ok ? 'sent' : 'failed', sender: 'bot', error: res.ok ? null : res.error,
    });
    const existingChat = await dbGetById('bot_chats', to);
    if (existingChat) await dbPatch('bot_chats', to, { lastText: `Quotation PDF sent (v${revision.revision})`, lastAt: now });
  } catch (err) {
    console.error('sendHeseosQuotationPdf logging error:', err);
  }
  return res;
}

