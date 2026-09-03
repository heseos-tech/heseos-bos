// Heseos Bot platform — per-tenant WhatsApp Cloud API helper. lib/whatsapp.js reads one
// account's credentials from env vars because Heseos's own Team Inbox only ever talks to one
// WhatsApp number; this file is its multi-tenant sibling — every function takes `{ phoneNumberId,
// token }` as an argument instead, because every Bot Console tenant pastes their own Meta
// Phone Number ID + permanent Access Token into Bot Configuration (self-service, no code
// change or redeploy needed to bring a new bot live — see app/api/bot/config/route.js).
// lib/whatsapp.js is left completely untouched by this file.

const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v20.0';

export function botWaConfigured(tenant) {
  return !!(tenant && tenant.waPhoneNumberId && tenant.waAccessToken);
}

// Actually checks a Phone Number ID + Access Token pair against Meta, instead of the "both
// fields are non-empty" heuristic Bot Configuration's Connected badge used to rely on — that
// showed green for any typed-in garbage, which is exactly why a tenant could type nonsense into
// both fields and see "Connected." A side-effect-free GET on the phone number resource confirms
// the token actually authenticates AND has access to that specific number — a valid token for a
// different number, an expired/revoked token, or a made-up phoneNumberId all fail this the same
// way garbage does, unlike the old check.
export async function verifyBotCredentials({ phoneNumberId, token }) {
  if (!phoneNumberId || !token) return { ok: false, error: 'Missing Phone Number ID or Access Token.' };
  try {
    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${encodeURIComponent(phoneNumberId)}?fields=id,display_phone_number,verified_name`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.error?.message || `Meta rejected this (HTTP ${res.status}).` };
    return { ok: true, displayPhoneNumber: data.display_phone_number || null, verifiedName: data.verified_name || null };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

// Send a plain text message on behalf of one tenant. Only valid inside WhatsApp's 24h
// customer-service window — true here by construction, since the bot only ever replies to a
// customer who just messaged in (see lib/botEngine.js).
export async function botSendText(creds, to, body) {
  const { phoneNumberId, token } = creds || {};
  if (!phoneNumberId || !token) return { ok: false, error: 'This bot is not connected to WhatsApp yet — add a Phone Number ID and Access Token in Bot Configuration.' };
  try {
    const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { preview_url: false, body } }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, id: data?.messages?.[0]?.id || null, error: res.ok ? null : (data?.error?.message || 'not delivered') };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

// Flatten a Meta webhook payload into one group per WhatsApp phone_number_id, since every
// tenant's own Meta App posts to this SAME shared webhook URL (app/api/bot/webhook) — the
// payload's metadata.phone_number_id is what tells us which tenant a message belongs to.
// (lib/whatsapp.js's parseWebhook() flattens everything into one list instead, which is fine
// for a single-number setup but would blur tenant boundaries here.)
export function parseWebhookByPhone(payload) {
  const groups = new Map();
  try {
    for (const entry of payload.entry || []) {
      for (const ch of entry.changes || []) {
        const v = ch.value || {};
        const phoneNumberId = v.metadata?.phone_number_id || null;
        if (!phoneNumberId) continue;
        if (!groups.has(phoneNumberId)) groups.set(phoneNumberId, { phoneNumberId, messages: [], statuses: [] });
        const g = groups.get(phoneNumberId);
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
          g.messages.push({
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
          g.statuses.push({ id: s.id, status: s.status, ts: s.timestamp ? new Date(Number(s.timestamp) * 1000).toISOString() : new Date().toISOString() });
        }
      }
    }
  } catch { /* be forgiving — never throw on a malformed payload */ }
  return [...groups.values()];
}
