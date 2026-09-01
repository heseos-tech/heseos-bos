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

const MAX_STEPS = 25; // guards against a cyclic flow the tenant accidentally drew with no stop
const HANDOFF_TEXT = "Let me connect you with our team for this — they'll be with you shortly.";

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

async function endHandoff(tenant, chat, closingText) {
  if (closingText) await botReply(tenant, chat, closingText);
  await dbPatch('bot_chats', chat.id, { botOn: false, flowNodeId: null, menuRetries: 0, lead: chat.lead || { status: 'new' } });
}

// Walks forward from `node`, sending messages, until it hits a node that must wait for a reply
// (menu/question) or a dead end (handoff, or a step with nowhere to go). Returns the id of the
// node the chat is now waiting at, or null once the flow has ended for this chat.
async function play(tenant, chat, flow, node) {
  let current = node;
  let steps = 0;
  while (current && steps++ < MAX_STEPS) {
    if (current.type === 'message') {
      await botReply(tenant, chat, current.data?.text || '');
      const edge = outEdge(flow, current.id, 'default');
      current = edge ? findNode(flow, edge.target) : null;
      continue;
    }
    if (current.type === 'menu') {
      await botReply(tenant, chat, menuText(current));
      return current.id;
    }
    if (current.type === 'question') {
      await botReply(tenant, chat, current.data?.text || '');
      return current.id;
    }
    if (current.type === 'handoff') {
      await endHandoff(tenant, chat, current.data?.text || '');
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
      await botReply(tenant, chat, `Sorry, I didn't quite get that.\n${menuText(waiting)}`);
      await dbPatch('bot_chats', chat.id, { menuRetries: retries });
      return;
    }
    const edge = outEdge(flow, waiting.id, picked.id);
    const next = edge ? findNode(flow, edge.target) : null;
    const waitingAt = next ? await play(tenant, chat, flow, next) : null;
    await dbPatch('bot_chats', chat.id, { flowNodeId: waitingAt, menuRetries: 0, selectedOption: picked.label, lead: chat.lead || { status: 'qualified' } });
    return;
  }

  if (waiting.type === 'question') {
    const fieldKey = waiting.data?.fieldKey || 'answer';
    const answers = { ...(chat.answers || {}), [fieldKey]: inboundText };
    const edge = outEdge(flow, waiting.id, 'default');
    const next = edge ? findNode(flow, edge.target) : null;
    const waitingAt = next ? await play(tenant, chat, flow, next) : null;
    await dbPatch('bot_chats', chat.id, { answers, flowNodeId: waitingAt });
    return;
  }

  // Waiting at a node type that shouldn't ever hold a chat (e.g. 'start' or 'handoff') —
  // shouldn't happen, but never loop forever if it somehow does.
  await dbPatch('bot_chats', chat.id, { flowNodeId: null });
}
