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

// Turns Meta's error object into the most specific single line we can show a non-technical
// tenant. `error.message` alone is often a generic bucket ("Authorization Error",
// "Authentication Error" — the SAME message for very different underlying problems: an expired
// token vs. a token that's valid but lacks messaging permission vs. a recipient number that
// isn't on a test number's allowed-recipients list, etc.), which is exactly what made a failed
// send in components/bot/InboxScreen.jsx impossible to actually diagnose from the badge alone.
// error_user_msg / error_data.details carry Meta's own more specific explanation when one
// exists; the numeric code/subcode is appended so it can be looked up in Meta's error reference
// or handed to support, without needing to go dig it out of raw webhook logs.
function describeMetaError(err) {
  if (!err) return 'not delivered';
  const detail = err.error_user_msg || err.error_data?.details || null;
  const headline = [err.message, detail && detail !== err.message ? detail : null].filter(Boolean).join(' — ') || 'not delivered';
  const codeBits = [err.code, err.error_subcode].filter((v) => v != null).join('/');
  return codeBits ? `${headline} (code ${codeBits})` : headline;
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
    if (!res.ok) console.error(`WhatsApp send failed for ${phoneNumberId} -> ${to}:`, JSON.stringify(data?.error || data));
    return { ok: res.ok, id: data?.messages?.[0]?.id || null, error: res.ok ? null : describeMetaError(data?.error) };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

// Send a document (e.g. a quotation PDF) on behalf of one tenant. Two Cloud API calls, same as
// Meta's own docs: (1) upload the file's bytes to get a short-lived media id, (2) send a
// message referencing that id. Only valid inside WhatsApp's 24h customer-service window, same
// caveat as botSendText.
export async function botSendDocument(creds, to, { buffer, filename, mimeType = 'application/pdf', caption = '' }) {
  const { phoneNumberId, token } = creds || {};
  if (!phoneNumberId || !token) return { ok: false, error: 'This bot is not connected to WhatsApp yet — add a Phone Number ID and Access Token in Bot Configuration.' };
  try {
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('file', new Blob([buffer], { type: mimeType }), filename);
    const uploadRes = await fetch(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const uploadData = await uploadRes.json().catch(() => ({}));
    if (!uploadRes.ok || !uploadData.id) {
      console.error(`WhatsApp media upload failed for ${phoneNumberId}:`, JSON.stringify(uploadData?.error || uploadData));
      return { ok: false, error: describeMetaError(uploadData?.error) };
    }

    const sendRes = await fetch(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'document',
        document: { id: uploadData.id, filename, ...(caption ? { caption } : {}) },
      }),
    });
    const sendData = await sendRes.json().catch(() => ({}));
    if (!sendRes.ok) console.error(`WhatsApp document send failed for ${phoneNumberId} -> ${to}:`, JSON.stringify(sendData?.error || sendData));
    return { ok: sendRes.ok, id: sendData?.messages?.[0]?.id || null, error: sendRes.ok ? null : describeMetaError(sendData?.error) };
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
