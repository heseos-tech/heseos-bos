// The tenant-built visual "Flow Builder" engine — a self-service alternative to
// lib/botEngine.js's fixed welcome/menu flow. Interprets whatever graph of nodes + edges the
// tenant has drawn in components/bot/FlowBuilderScreen.jsx (saved via app/api/bot/flow), fully
// data-driven like everything else on this platform — no per-tenant code here either. A tenant
// only moves onto this engine once their bot_flows row has enabled: true and a Start node
// actually leads somewhere; until then app/api/bot/webhook keeps using the simpler,
// Bot-Configuration-driven lib/botEngine.js, so nobody's live bot changes behaviour just because
// they opened the builder.
//
// Node types the builder can produce: 'start' (the one fixed entry point — not itself a step),
// 'message' (send text, then keep going), 'menu' (send text + numbered options, wait for a
// reply, branch by which option was picked — same numbering scheme as lib/botEngine.js's fixed
// menu), 'question' (send text, wait for any reply, save it onto chat.answers[fieldKey], then
// keep going), 'handoff' (optional closing text, then go quiet and hand off to the tenant's own
// team — mirrors lib/botEngine.js's stage: 'handled', so components/bot/InboxScreen.jsx's
// "Bot on/off" pill and "Needs Agent" tab work identically either way).
import { dbPatch } from '@/lib/db';
import { botReply } from '@/lib/botReply';
import { fillTemplate } from '@/lib/botPresets';
import { syncLeadField, finalizeHeseosLead, scheduleHeseosDemo, evaluateLeadRedirect, appendHeseosLeadHistory } from '@/lib/heseosLeadSync';

const MAX_STEPS = 25; // guards against a cyclic flow the tenant accidentally drew with no stop
const HANDOFF_TEXT = "Let me connect you with our team for this — they'll be with you shortly.";

// Optional lightweight input validation for 'question' nodes (data.validate) — a generic escape
// hatch the engine understands without any per-tenant vocabulary, same spirit as fieldKey. Today
// only lib/heseosReturningFlow.js's demo-scheduling questions use it, but any tenant's flow can
// opt a question node into one of these by name. parse() returns the value to store in
// chat.answers, already normalized to whatever format the rest of the app expects for that field
// (e.g. YYYY-MM-DD / 24-hour HH:MM — see app/api/leads/[id]/route.js's 'scheduleDemo' PATCH type
// and the <input type="date"|"time"> fields that write it), or null if the raw reply doesn't
// match at all, in which case the caller re-asks using `hint`.
const QUESTION_VALIDATORS = {
  date_ddmmyyyy: {
    hint: 'Please reply with the date as DD-MM-YYYY, e.g. 25-09-2026.',
    parse(raw) {
      const m = String(raw || '').trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
      if (!m) return null;
      const [, dd, mm, yyyy] = m;
      const d = Number(dd), mo = Number(mm), y = Number(yyyy);
      const date = new Date(y, mo - 1, d);
      if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (date < today) return null;
      return `${yyyy}-${mm}-${dd}`;
    },
  },
  time_12h: {
    hint: 'Please reply with the time as HH:MM AM/PM, e.g. 03:30 PM.',
    parse(raw) {
      const m = String(raw || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (!m) return null;
      let [, hh, mi, ap] = m;
      let h = Number(hh);
      const min = Number(mi);
      if (h < 1 || h > 12 || min > 59) return null;
      ap = ap.toUpperCase();
      if (ap === 'AM') { if (h === 12) h = 0; } else if (h !== 12) { h += 12; }
      return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    },
  },
};

// Every outbound line from a flow goes through fillTemplate first — {{botName}}/{{business}}
// as always, plus {{referrerNote}} (set once at chat creation for Heseos's own tenant only —
// see app/api/bot/webhook/route.js, blank for every other tenant) and {{fieldKey}} for anything
// already sitting in chat.answers, so a later node's text can reference an earlier answer (e.g.
// "Thanks {{name}}!"). Callers must pass a `chat` whose `.answers` already reflects the answer
// just collected this turn, not the one loaded from the database at the start of it.
function send(tenant, chat, text) {
  return botReply(tenant, chat, fillTemplate(text, tenant, {
    referrerNote: chat.referrerNote || '',
    leadSummary: chat.leadSummary || '',
    ...(chat.answers || {}),
  }));
}

// A tenant can now build several flows (see components/bot/FlowListScreen.jsx) — each with its
// own trigger conditions — instead of just one. Picks which flow a brand-new chat should enter,
// in a fixed, deterministic order of specificity: an attribution match (this chat came from a
// QR scan or a referral link — see app/api/bot/webhook's resolveAttributionLink) beats a keyword
// match in the customer's first message, which beats the one flow (if any) a tenant has marked
// as their fallback/default. Only enabled flows with a Start node that actually leads somewhere
// are considered; ties within the same tier go to whichever flow was configured first, so the
// result is stable and predictable rather than depending on database row order. Returns null
// when nothing matches — the webhook then falls straight back to lib/botEngine.js, exactly as
// if Flow Builder didn't exist for that chat.
export function pickFlow(flows, { attributionKind, text } = {}) {
  const candidates = (flows || [])
    .filter((f) => f && f.enabled && (f.nodes || []).some((n) => n.type === 'start'))
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

  const kindBucket = attributionKind
    ? (String(attributionKind).startsWith('qr_') ? 'qr' : String(attributionKind).startsWith('referral_') ? 'referral' : null)
    : null;
  if (kindBucket) {
    const byAttribution = candidates.find((f) => (f.triggers?.attribution || []).includes(kindBucket));
    if (byAttribution) return byAttribution;
  }

  const lower = String(text || '').trim().toLowerCase();
  if (lower) {
    const byKeyword = candidates.find((f) => (f.triggers?.keywords || []).some((k) => k && lower.includes(String(k).toLowerCase())));
    if (byKeyword) return byKeyword;
  }

  return candidates.find((f) => f.triggers?.isDefault) || null;
}

function findNode(flow, id) {
  return (flow.nodes || []).find((n) => n.id === id) || null;
}
function outEdge(flow, nodeId, handle) {
  return (flow.edges || []).find((e) => e.source === nodeId && (e.sourceHandle || 'default') === handle) || null;
}
function startNode(flow) {
  return (flow.nodes || []).find((n) => n.type === 'start') || null;
}

function matchMenuOption(options, raw) {
  const text = String(raw || '').trim().toLowerCase();
  if (!text) return null;
  const num = parseInt(text, 10);
  if (num && options[num - 1]) return options[num - 1];
  return options.find((o) => {
    const label = String(o.label || '').toLowerCase();
    return label === text || (label && (text.includes(label) || label.includes(text)));
  }) || null;
}

function menuText(node) {
  const options = node.data?.options || [];
  const lines = options.map((o, i) => `${i + 1}️⃣ ${o.label || `Option ${i + 1}`}`);
  const head = node.data?.text || '';
  return [head, lines.join('\n')].filter(Boolean).join('\n');
}

async function endHandoff(tenant, chat, closingText, historyEvent) {
  if (closingText) await send(tenant, chat, closingText);
  // The ONE moment a flow-driven Heseos (or linkToHeseosLeads) chat is allowed to become a real
  // lead — see lib/heseosLeadSync.js's finalizeHeseosLead for why this is deliberately deferred
  // all the way to here rather than happening the moment the chat started. A no-op (returns
  // null) for every other tenant, and idempotent if this chat already has a leadId, so it's
  // always safe to call unconditionally on every handoff, reached via any flow.
  const leadId = await finalizeHeseosLead(tenant, chat).catch((err) => {
    console.error('finalizeHeseosLead error:', err);
    return null;
  });
  const chatWithLead = leadId ? { ...chat, leadId } : chat;
  // Same "safe to call on every handoff" spirit as finalizeHeseosLead above — a no-op unless
  // this chat's answers actually hold a demoDate AND demoTime, which only ever happens for the
  // one flow branch that asks for them (lib/heseosReturningFlow.js's "Schedule a demo" option).
  await scheduleHeseosDemo(chatWithLead).catch((err) => {
    console.error('scheduleHeseosDemo error:', err);
    return false;
  });
  // A handoff node can optionally carry a canned note to log onto the linked lead the moment
  // it's reached (data.leadHistoryEvent) — used by lib/heseosReturningFlow.js's "already has a
  // demo booked, want to change it?" branch so whoever's assigned to the lead sees the request
  // without the bot itself trying to renegotiate a new slot. See
  // lib/heseosLeadSync.js's appendHeseosLeadHistory.
  if (historyEvent) {
    await appendHeseosLeadHistory(chatWithLead, historyEvent).catch((err) => {
      console.error('appendHeseosLeadHistory error:', err);
    });
  }
  // demoDate/demoTime/demoAddress only ever mean anything for the ONE handoff that just
  // consumed them (above) — strip them from what gets persisted so a later, unrelated handoff on
  // this same chat (e.g. "check my enquiry status" reached after an earlier demo-scheduling
  // conversation) can never accidentally re-trigger scheduling off stale leftover answers.
  const { demoDate, demoTime, demoAddress, ...restAnswers } = chat.answers || {};
  await dbPatch('bot_chats', chat.id, {
    botOn: false, flowNodeId: null, menuRetries: 0, answerRetries: 0,
    lead: chat.lead || { status: 'new' },
    answers: restAnswers,
    ...(leadId ? { leadId } : {}),
    // Marks this as the bot silencing ITSELF after a flow completed naturally, as opposed to a
    // human deliberately taking over via the Inbox's Bot on/off toggle (which explicitly clears
    // this flag either direction — see app/api/bot/chats/[id]/route.js). Only when this flag is
    // still true is it safe for the webhook to wake the bot back up on the customer's next
    // message — see app/api/bot/webhook/route.js's existing-chat branch.
    autoHandoff: true,
  });
}

// Walks forward from `node`, sending messages, until it hits a node that must wait for a reply
// (menu/question) or a dead end (handoff, or a step with nowhere to go). Returns the id of the
// node the chat is now waiting at, or null once the flow has ended for this chat.
async function play(tenant, chat, flow, node) {
  let current = node;
  let steps = 0;
  while (current && steps++ < MAX_STEPS) {
    if (current.type === 'message') {
      await send(tenant, chat, current.data?.text || '');
      const edge = outEdge(flow, current.id, 'default');
      current = edge ? findNode(flow, edge.target) : null;
      continue;
    }
    if (current.type === 'menu') {
      await send(tenant, chat, menuText(current));
      return current.id;
    }
    if (current.type === 'question') {
      await send(tenant, chat, current.data?.text || '');
      return current.id;
    }
    if (current.type === 'handoff') {
      await endHandoff(tenant, chat, current.data?.text || '', current.data?.leadHistoryEvent || null);
      return null;
    }
    // Anything else (a stray 'start' reached mid-flow, or an unrecognised node type) — follow
    // its default edge if it has one, otherwise stop rather than loop.
    const edge = outEdge(flow, current.id, 'default');
    current = edge ? findNode(flow, edge.target) : null;
  }
  if (steps >= MAX_STEPS) {
    console.error(`Flow for tenant ${tenant.id} hit its step guard — likely a loop with no menu/question/handoff to stop at.`);
    await endHandoff(tenant, chat, HANDOFF_TEXT);
  } else {
    // Ran off the end of the graph (a step with no outgoing connection) — stop quietly so the
    // next inbound message doesn't replay anything; a human can pick the chat up from the Inbox.
    await dbPatch('bot_chats', chat.id, { flowNodeId: null });
  }
  return null;
}

export async function runFlowTurn(tenant, flow, chat, inboundText) {
  if (!chat.flowNodeId) {
    const start = startNode(flow);
    if (!start) return; // nothing drawn yet
    const edge = outEdge(flow, start.id, 'default');
    const next = edge ? findNode(flow, edge.target) : null;
    const waitingAt = next ? await play(tenant, chat, flow, next) : null;
    await dbPatch('bot_chats', chat.id, { flowNodeId: waitingAt, stage: 'flow' });
    return;
  }

  const waiting = findNode(flow, chat.flowNodeId);
  if (!waiting) { await dbPatch('bot_chats', chat.id, { flowNodeId: null }); return; }

  if (waiting.type === 'menu') {
    const options = waiting.data?.options || [];
    const picked = matchMenuOption(options, inboundText);
    if (!picked) {
      const retries = (chat.menuRetries || 0) + 1;
      if (retries >= 2) { await endHandoff(tenant, chat, HANDOFF_TEXT); return; }
      await send(tenant, chat, `Sorry, I didn't quite get that.\n${menuText(waiting)}`);
      await dbPatch('bot_chats', chat.id, { menuRetries: retries });
      return;
    }
    // Optional, mirrors question nodes: a menu can save the picked option's label onto
    // chat.answers[fieldKey] too (e.g. "Property Type" -> answers.propertyType), so a flow can
    // build a whole structured intake out of menus alone, not just free-text questions. Heseos's
    // own lead-capture flow uses this to sync straight into the linked lead — see
    // lib/heseosLeadSync.js's syncLeadField, a no-op for every other (white-label) tenant.
    const fieldKey = waiting.data?.fieldKey || null;
    let answers = fieldKey ? { ...(chat.answers || {}), [fieldKey]: picked.label } : (chat.answers || {});
    let nextChat = { ...chat, answers };
    if (fieldKey) await syncLeadField(nextChat, fieldKey, picked.label);

    // Optional data-aware redirect (option.altIf/altHandle/altAnswers) — lets a picked option
    // send the customer down a different branch depending on the CURRENT state of the lead this
    // chat is linked to (e.g. "does this lead already have a demo booked?"), pulling a few of
    // that lead's own fields into chat.answers first so the alternate branch's text can show
    // them back via the usual {{fieldKey}} mechanism. See lib/heseosLeadSync.js's
    // evaluateLeadRedirect — the engine itself never needs to know what any of this means.
    let handle = picked.id;
    const redirect = await evaluateLeadRedirect(chat, picked).catch((err) => {
      console.error('evaluateLeadRedirect error:', err);
      return null;
    });
    if (redirect) {
      handle = redirect.handle;
      answers = { ...answers, ...redirect.extraAnswers };
      nextChat = { ...nextChat, answers };
    }

    const edge = outEdge(flow, waiting.id, handle);
    const next = edge ? findNode(flow, edge.target) : null;
    const waitingAt = next ? await play(tenant, nextChat, flow, next) : null;
    await dbPatch('bot_chats', chat.id, { flowNodeId: waitingAt, menuRetries: 0, selectedOption: picked.label, answers, lead: chat.lead || { status: 'qualified' } });
    return;
  }

  if (waiting.type === 'question') {
    const fieldKey = waiting.data?.fieldKey || 'answer';
    // Optional validate kind (see QUESTION_VALIDATORS above) — an invalid reply re-asks instead
    // of saving garbage, mirroring the menu branch's own "didn't quite get that" retry-then-
    // handoff pattern just above, but tracked on its own counter (answerRetries) since a chat
    // could in principle be mid-menu-retry and mid-question-retry at different points in time.
    const validator = waiting.data?.validate ? QUESTION_VALIDATORS[waiting.data.validate] : null;
    let value = inboundText;
    if (validator) {
      const parsed = validator.parse(inboundText);
      if (parsed === null) {
        const retries = (chat.answerRetries || 0) + 1;
        if (retries >= 2) { await endHandoff(tenant, chat, HANDOFF_TEXT); return; }
        await send(tenant, chat, `Hmm, that doesn't look right. ${validator.hint}`);
        await dbPatch('bot_chats', chat.id, { answerRetries: retries });
        return;
      }
      value = parsed;
    }
    const answers = { ...(chat.answers || {}), [fieldKey]: value };
    const nextChat = { ...chat, answers };
    await syncLeadField(nextChat, fieldKey, value);
    const edge = outEdge(flow, waiting.id, 'default');
    const next = edge ? findNode(flow, edge.target) : null;
    const waitingAt = next ? await play(tenant, nextChat, flow, next) : null;
    await dbPatch('bot_chats', chat.id, { answers, flowNodeId: waitingAt, answerRetries: 0 });
    return;
  }

  // Waiting at a node type that shouldn't ever hold a chat (e.g. 'start' or 'handoff') —
  // shouldn't happen, but never loop forever if it somehow does.
  await dbPatch('bot_chats', chat.id, { flowNodeId: null });
}
