// Thin wrapper around the Meta WhatsApp Cloud API. Ported from MARG's lib/whatsapp.js and
// trimmed to what Heseos's Team Inbox needs (no multi-brand/white-label routing — Heseos has
// one WhatsApp number). Config comes from env:
//   WHATSAPP_TOKEN         — permanent access token
//   WHATSAPP_PHONE_ID      — the WhatsApp Business phone number ID
//   WHATSAPP_VERIFY_TOKEN  — arbitrary string you also enter in the Meta webhook config
//   WHATSAPP_API_VERSION   — optional, defaults to v20.0
const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v20.0';
const PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const TOKEN = process.env.WHATSAPP_TOKEN;

export function waConfigured() {
  return !!(PHONE_ID && TOKEN);
}

// Send a plain text message. Only allowed inside the 24h customer-service window (i.e. the
// customer messaged first, recently); business-initiated messages outside it need sendTemplate.
export async function sendText(to, body) {
  if (!waConfigured()) return { ok: false, error: 'WhatsApp not configured (set WHATSAPP_TOKEN + WHATSAPP_PHONE_ID).' };
  try {
    const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${PHONE_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { preview_url: false, body } }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, id: data?.messages?.[0]?.id || null, error: res.ok ? null : (data?.error?.message || 'not delivered') };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

// Send an approved template — required for the first business-initiated message outside the
// 24h window (e.g. re-opening a cold WhatsApp QR lead). `components` builds header/body vars.
export async function sendTemplate(to, name, lang = 'en', components = []) {
  if (!waConfigured()) return { ok: false, error: 'WhatsApp not configured' };
  try {
    const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${PHONE_ID}/messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'template', template: { name, language: { code: lang }, ...(components.length ? { components } : {}) } }),
    });
    const data = await res.json().catch(() => ({}));
    const err = data?.error;
    return { ok: res.ok, id: data?.messages?.[0]?.id || null, error: res.ok ? null : (err?.message || 'not delivered') };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

// Send a message with up to 3 tappable reply buttons — e.g. "Book my free demo" / "Not now".
export async function sendInteractiveButtons(to, body, buttons) {
  if (!waConfigured()) return { ok: false, error: 'WhatsApp not configured' };
  try {
    const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${PHONE_ID}/messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp', to, type: 'interactive',
        interactive: { type: 'button', body: { text: String(body).slice(0, 1024) }, action: { buttons: (buttons || []).slice(0, 3).map((b) => ({ type: 'reply', reply: { id: b.id, title: String(b.title).slice(0, 20) } })) } },
      }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, id: data?.messages?.[0]?.id || null, error: res.ok ? null : (data?.error?.message || 'not delivered') };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

// Flatten a Meta webhook payload into a simple list of inbound messages + delivery statuses.
export function parseWebhook(payload) {
  const messages = [];
  const statuses = [];
  try {
    for (const entry of payload.entry || []) {
      for (const ch of entry.changes || []) {
        const v = ch.value || {};
        const contacts = v.contacts || [];
        const nameFor = (waId) => contacts.find((c) => c.wa_id === waId)?.profile?.name || null;
        for (const m of v.messages || []) {
          let text = '', replyId = '';
          if (m.type === 'text') text = m.text?.body || '';
          else if (m.type === 'button') { text = m.button?.text || m.button?.payload || ''; replyId = m.button?.payload || ''; }
          else if (m.type === 'interactive') {
            const it = m.interactive || {};
            text = it.button_reply?.title || it.list_reply?.title || '';
            replyId = it.button_reply?.id || it.list_reply?.id || '';
          } else text = m[m.type]?.caption || `[${m.type}]`;
          messages.push({
            id: m.id,
            from: m.from,
            name: nameFor(m.from),
            type: m.type,
            text,
            replyId,
            ts: m.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString() : new Date().toISOString(),
          });
        }
        for (const s of v.statuses || []) {
          statuses.push({ id: s.id, status: s.status, ts: s.timestamp ? new Date(Number(s.timestamp) * 1000).toISOString() : new Date().toISOString() });
        }
      }
    }
  } catch { /* be forgiving — never throw on a malformed payload */ }
  return { messages, statuses };
}
