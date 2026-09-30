// Heseos's "WhatsApp Shopping" flow — browse the products admin has opted into WhatsApp
// Shopping (ProductsPage.jsx's toggle), build a cart, and check out with a name + delivery
// address. Payment is Cash/UPI on delivery, confirmed manually from Admin -> Orders — see
// lib/heseosOrders.js's own header comment for why no gateway is wired up in this version.
//
// Only ever picked for a BRAND-NEW chat's very first message (see lib/botFlowEngine.js's
// pickFlow — the keyword tier only ever runs at chat-creation time, same as every other
// keyword-triggered flow on this platform would) that mentions shopping/buying/the catalogue
// AND isn't itself a QR/referral scan (an attribution match always wins first — a partner's QR
// code still means "let's capture this as a proper enquiry", not "skip straight to checkout").
// A chat already mid-conversation on another flow (e.g. the lead-capture questionnaire) typing
// "I want to buy" later on does NOT re-route here — same "a chat stays on whichever flow it
// started" rule every other flow already lives under (see app/api/bot/webhook/route.js).
//
// Same self-healing seed pattern as the other lib/heseos*Flow.js files.
import { dbInsert } from '@/lib/db';

export const HESEOS_SHOPPING_FLOW_ID = 'heseos_whatsapp_shopping_v1';

function buildHeseosShoppingFlow(tenantId) {
  const now = new Date().toISOString();

  const nodes = [
    { id: 'start', type: 'start', x: 60, y: 200, data: {} },
    {
      // See lib/botFlowEngine.js's own "CATALOG NODE" section for exactly how this node type
      // behaves — it's the one part of this flow that isn't just static text.
      id: 'n_catalog', type: 'catalog', x: 340, y: 200,
      data: {
        text: "Hi! 👋 Welcome to HESEOS Shopping. Here's what we've got — tap a product to add it to your cart, then tap *View Cart & Checkout* whenever you're ready.",
      },
    },
    {
      id: 'n_ask_name', type: 'question', x: 620, y: 120,
      data: { text: "Great! What name should we put this order under?", fieldKey: 'orderName' },
    },
    {
      id: 'n_ask_address', type: 'question', x: 900, y: 120,
      data: { text: "And what's the full delivery address? (please include city & pincode)", fieldKey: 'orderAddress' },
    },
    {
      id: 'n_done', type: 'handoff', x: 1180, y: 120,
      data: {
        text: "Thank you! 🎉 Your order is placed — our team will call to confirm delivery. Payment is collected via Cash or UPI at the time of delivery.\n\n— Team HESEOS",
      },
    },
  ];

  const edges = [
    { id: 'e_start', source: 'start', sourceHandle: 'default', target: 'n_catalog' },
    // The catalog node's own 'checkout' handle — NOT its 'default' one, which it never actually
    // uses (see lib/botFlowEngine.js: a catalog node either re-sends itself while browsing, or
    // follows this specific handle once the customer taps "View Cart & Checkout" with a
    // non-empty cart).
    { id: 'e_checkout', source: 'n_catalog', sourceHandle: 'checkout', target: 'n_ask_name' },
    { id: 'e_name', source: 'n_ask_name', sourceHandle: 'default', target: 'n_ask_address' },
    { id: 'e_address', source: 'n_ask_address', sourceHandle: 'default', target: 'n_done' },
  ];

  return {
    id: HESEOS_SHOPPING_FLOW_ID,
    tenantId,
    name: 'WhatsApp Shopping',
    enabled: true,
    // Deliberately narrow, substring-matched keywords (lib/botFlowEngine.js's pickFlow does a
    // plain `.includes()`) — "buy" and "catalogue/catalog" are exactly what the feature was
    // asked to trigger on. "shop"/"products" alone are left out on purpose: too eager a
    // substring match ("workshop", "what products do you have for a smart home" — a real
    // consultative enquiry that should still go through normal lead capture, not straight to a
    // buy-now catalogue).
    triggers: { keywords: ['buy', 'shopping', 'catalogue', 'catalog'], attribution: [], isDefault: false },
    nodes,
    edges,
    createdAt: now,
    updatedAt: now,
  };
}

// Same "only ever inserts when missing, never overwrites a tenant's own edits" contract as
// lib/heseosRatingFlow.js/lib/heseosNoAnswerFlow.js.
export async function ensureHeseosShoppingFlow(tenant, existingFlows) {
  if ((existingFlows || []).some((f) => f.id === HESEOS_SHOPPING_FLOW_ID)) return existingFlows;
  const flow = buildHeseosShoppingFlow(tenant.id);
  await dbInsert('bot_flows', flow.id, flow);
  return [...(existingFlows || []), flow];
}
