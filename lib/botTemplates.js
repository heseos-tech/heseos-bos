// WhatsApp message templates for the Inbox "Template" picker (components/bot/InboxScreen.jsx).
// Templates are the only thing Meta lets a business send once the customer's 24h window has
// closed, so the Inbox needs a way to pick one and send it by hand.
//
// Source of truth is the tenant's own approved templates in Meta (listed with the WhatsApp
// Business Account ID from Bot Configuration). Until that ID is added we fall back to the short
// built-in catalogue below — the templates Heseos's own flows already send — so the button works
// straight away.

const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v20.0';

// Display wording is for the picker preview and the Inbox log only — what the customer receives is
// always Meta's own stored template, rendered from `name` + `params`.
export const HESEOS_TEMPLATE_CATALOG = [
  { name: 'order_dispatched', language: 'en_US', category: 'UTILITY', body: 'Hi {{1}}, your HESEOS order {{2}} has been dispatched and is on its way to you.\n\n— Team HESEOS', hints: ['First name', 'Order ID'] },
  { name: 'order_packed', language: 'en_US', category: 'UTILITY', body: 'Hi {{1}}, your HESEOS order {{2}} has been packed and will be dispatched shortly.\n\n— Team HESEOS', hints: ['First name', 'Order ID'] },
  { name: 'order_confirmed', language: 'en_US', category: 'UTILITY', body: "Hi {{1}}, thank you for confirming your HESEOS order {{2}}! We'll pack it and keep you posted on every step.\n\n— Team HESEOS", hints: ['First name', 'Order ID'] },
  { name: 'order_delivered', language: 'en_US', category: 'UTILITY', body: 'Hi {{1}}, your HESEOS order {{2}} has been delivered. Our team will contact you to schedule the installation.\n\n— Team HESEOS', hints: ['First name', 'Order ID'] },
  { name: 'order_installed', language: 'en_US', category: 'UTILITY', body: 'Hi {{1}}, installation for your HESEOS order {{2}} is complete. Thank you for choosing HESEOS!\n\n— Team HESEOS', hints: ['First name', 'Order ID'] },
  { name: 'order_cancelled', language: 'en_US', category: 'UTILITY', body: "Hi {{1}}, your HESEOS order {{2}} has been cancelled. If you'd like to order again or have any questions, just message us here.\n\n— Team HESEOS", hints: ['First name', 'Order ID'] },
  { name: 'lead_added_notify', language: 'en_US', category: 'UTILITY', body: 'Hi {{1}}! 👋 This is HESEOS. {{2}} has added your details with us for a smart home consultation. Someone from our team will get in touch with you shortly to understand your requirements better. Thank you for choosing HESEOS! 😊', hints: ['First name', 'Added by (e.g. HESEOS Team)'] },
];

// Highest {{n}} in the text (positional variables only).
export function paramCount(body) {
  let max = 0;
  for (const m of String(body || '').matchAll(/\{\{\s*(\d+)\s*\}\}/g)) max = Math.max(max, Number(m[1]));
  return max;
}

export function renderTemplate(body, params = []) {
  return String(body || '').replace(/\{\{\s*(\d+)\s*\}\}/g, (_, n) => String(params[Number(n) - 1] ?? '').trim() || `{{${n}}}`);
}

// Lists the tenant's APPROVED templates from Meta. Returns { ok, templates, error }.
// Each template: { name, language, category, body, params (count), sendable, reason }.
// Only plain-text-body templates can be sent from the Inbox — ones with a document/image header or
// a button that takes a variable need extra parameters this picker doesn't collect.
export async function fetchMetaTemplates(tenant) {
  const waba = String(tenant?.waBusinessAccountId || '').trim();
  const token = tenant?.waAccessToken;
  if (!waba || !token) return { ok: false, templates: [], error: 'no_waba' };
  try {
    const url = `https://graph.facebook.com/${API_VERSION}/${encodeURIComponent(waba)}/message_templates?status=APPROVED&limit=200&fields=name,language,status,category,components`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, templates: [], error: data?.error?.message || `Meta returned ${res.status}` };
    const templates = (data.data || []).map((t) => {
      const comps = t.components || [];
      const bodyC = comps.find((c) => c.type === 'BODY');
      const header = comps.find((c) => c.type === 'HEADER');
      const buttons = comps.find((c) => c.type === 'BUTTONS');
      const body = bodyC?.text || '';
      const named = /\{\{\s*[a-zA-Z_]/.test(body);
      let reason = '';
      if (header && header.format && header.format !== 'TEXT') reason = `Has a ${String(header.format).toLowerCase()} header`;
      else if (header?.text && /\{\{/.test(header.text)) reason = 'Header takes a variable';
      else if ((buttons?.buttons || []).some((b) => /\{\{/.test(b.url || ''))) reason = 'A button takes a variable';
      else if (named) reason = 'Uses named variables';
      return { name: t.name, language: t.language, category: t.category, body, params: paramCount(body), sendable: !reason && !!body, reason };
    });
    templates.sort((a, b) => a.name.localeCompare(b.name));
    return { ok: true, templates };
  } catch (e) {
    return { ok: false, templates: [], error: String((e && e.message) || e) };
  }
}
