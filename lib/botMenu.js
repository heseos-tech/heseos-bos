// Shared "send a menu as WhatsApp's native tappable UI" helper — used by both
// lib/botEngine.js (the fixed language-picker/quick-menu flow driven by Bot Configuration) and
// lib/botFlowEngine.js (a tenant's own Flow Builder 'menu' nodes), so every bot conversation on
// the platform gets real buttons instead of "reply with a number 1️⃣/2️⃣/3️⃣" wherever WhatsApp's
// own interactive-message limits allow it.
//
// WhatsApp Cloud API limits this respects: reply buttons — max 3, each id up to 256 chars and
// title up to 20 chars, `body.text` required; list messages — max 10 rows total (this platform
// only ever needs one section), each row title up to 24 chars with an optional description up
// to 72 chars, plus the ever-visible "open this list" button label (up to 20 chars). Beyond 10
// options WhatsApp has no interactive option left at all, so this falls back to the platform's
// original plain-text "reply with a number" rendering — see numberedMenuText below, which also
// doubles as the archival/Inbox-transcript text for every menu regardless of how it was
// actually sent (see lib/botReply.js), so an admin reading the Inbox still sees every option
// spelled out even though the customer saw tappable buttons.
import { botReply } from '@/lib/botReply';

const MAX_BUTTONS = 3;
const MAX_LIST_ROWS = 10;
const LIST_OPENER_LABEL = 'Choose an option';

// Used whenever a menu node's own prompt text is blank (the question was already asked by a
// preceding message node) — WhatsApp requires a non-empty interactive body.
export const DEFAULT_MENU_PROMPT = 'Please choose an option below 👇';

function truncate(str, max) {
  const s = String(str ?? '').trim();
  if (!s) return s;
  return s.length <= max ? s : `${s.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

// The original "1️⃣ Label" rendering, kept as the plain-text fallback (>10 options) and as the
// always-readable archival copy stored in bot_messages/shown in the Inbox transcript.
export function numberedMenuText(items) {
  return (items || []).map((it, i) => `${i + 1}️⃣ ${it.label}`).join('\n');
}

// Sends one menu prompt as reply buttons (<=3 options) or a list message (4-10 options),
// falling back to plain numbered text beyond that cap.
//
// `items`: [{ id, label }] — `id` comes back verbatim on the customer's tap (see
// lib/botWhatsapp.js's parseWebhookByPhone's button_reply.id/list_reply.id), so callers should
// match replies against it directly rather than re-parsing typed text or a truncated title.
// `headText`/`archivalText` must already be fully resolved (e.g. fillTemplate'd) by the caller.
// `prefix`, if given, is prepended to both — used for the "Sorry, I didn't quite get that."
// retry, mirroring the platform's original plain-text retry wording.
export async function sendInteractiveMenu(tenant, chat, { headText, archivalText, items, prefix }) {
  const head = prefix ? `${prefix} ${headText || DEFAULT_MENU_PROMPT}` : (headText || DEFAULT_MENU_PROMPT);
  const archival = prefix ? `${prefix}\n${archivalText || ''}` : (archivalText || head);
  const n = (items || []).length;
  if (n && n <= MAX_BUTTONS) {
    const buttons = items.map((it) => ({ id: String(it.id), title: truncate(it.label, 20) }));
    return botReply(tenant, chat, archival, { sendText: head, buttons });
  }
  if (n && n <= MAX_LIST_ROWS) {
    const rows = items.map((it) => ({ id: String(it.id), title: truncate(it.label, 24) }));
    return botReply(tenant, chat, archival, { sendText: head, list: { buttonLabel: LIST_OPENER_LABEL, rows } });
  }
  return botReply(tenant, chat, archival);
}
