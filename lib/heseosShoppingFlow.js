// Heseos's "WhatsApp Shopping" flow — as of v2 (v3 adds the tappable product-card button) this is the WhatsApp -> LANDING PAGE ordering journey
// for the HESEOS Smart Door Lock (lib/heseosDoorLock.js): a customer messages in ("Hi, I need door
// lock", or just "buy"/"catalogue"…), this flow replies ONCE with the product's landing-page link
// (/lock — public/door-lock/index.html), they scroll the page and place the order there, and the
// "order placed" confirmation comes back to them on WhatsApp (lib/heseosNotify.js's
// notifyHeseosOrderPlaced, fired from app/api/shop/door-lock/route.js). Payment is Cash/UPI on
// delivery — see lib/heseosOrders.js.
//
// (An earlier version of this flow was an in-chat catalogue + cart + checkout; that has been removed
// entirely — the landing page is the only ordering path. Same flow id on purpose, so
// app/api/bot/webhook/route.js's keyword override keeps working, and ensureHeseosShoppingFlow below
// upgrades any stored copy of that old version in place.)
//
// The flow is just Start -> one message; it deliberately has NO handoff node, so reaching its end
// neither silences the bot nor creates a lead (an order is not a lead — see lib/botFlowEngine.js's
// endHandoff). Picked for a BRAND-NEW chat's first message the normal way (lib/botFlowEngine.js's
// pickFlow — keyword tier; a QR/referral attribution match still wins first), and ALSO mid-
// conversation on top of whatever flow a chat was already on — see the existing-chat branch in
// app/api/bot/webhook/route.js — so a customer who already talked to the bot and then types
// "door lock"/"buy" still gets the link. The same branch sends a chat that's already on this flow
// back to the normal lead-capture flow when its next message ISN'T one of these keywords.
//
// {{lockLink}}/{{lockPrice}}/{{lockMrp}} are filled in by lib/botFlowEngine.js's templateVars.
import { dbInsert } from '@/lib/db';

export const HESEOS_SHOPPING_FLOW_ID = 'heseos_whatsapp_shopping_v1';
// Bumped whenever buildHeseosShoppingFlow's content changes in a way stored copies should pick up.
const FLOW_VERSION = 7;

// The door-lock product card (photo + price + "Order Now" button -> /lock). This flow's one message,
// and also the "Door Lock" answer in lib/heseosOrganicFlow.js's / lib/heseosReturningFlow.js's menus.
export function buildDoorLockCardNode({ id = 'n_link', x = 340, y = 200 } = {}) {
  return {
    id, type: 'message', x, y,
    data: {
      // Plain-text version — link included. What the Inbox shows, and what a customer whose
      // WhatsApp can't render the button below receives instead.
      text: [
        "Hi! 👋 Thanks for your interest in the *HESEOS Smart Door Lock* — fingerprint, passcode, RFID card and key access, with emergency USB-C power.",
        '',
        '🎉 Festive offer: *₹{{lockPrice}}* (MRP ₹{{lockMrp}}) & *Free Installation*',
        '',
        '✅ Order now, see a *live demo on delivery*, then decide — buy it only if you love it, and pay then (Cash / UPI).',
        '',
        'Place your order here 👇',
        '{{lockLink}}',
        '',
        "We'll confirm your order right here on WhatsApp as soon as it's placed.",
        '',
        '— Team HESEOS',
      ].join('\n'),
      // Product-card version (lib/botFlowEngine.js's data.cta): the lock photo, this body, and one
      // "Order Now" button that opens the landing page.
      cta: {
        url: '{{lockLink}}',
        label: 'Order Now',
        imagePath: '/door-lock/hero.jpg',
        footer: 'Team HESEOS · Demo on delivery',
        text: [
          "Hi! 👋 Thanks for your interest in the *HESEOS Smart Door Lock* — fingerprint, passcode, RFID card and key access, with emergency USB-C power.",
          '',
          '🎉 Festive offer: *₹{{lockPrice}}* (MRP ₹{{lockMrp}}) & *Free Installation*',
          '',
          '✅ Order now, see a *live demo on delivery*, then decide — buy it only if you love it, and pay then (Cash / UPI).',
          '',
          "Tap *Order Now* to place your order — we'll confirm right here on WhatsApp.",
        ].join('\n'),
      },
    },
  };
}

function buildHeseosShoppingFlow(tenantId) {
  const now = new Date().toISOString();

  const nodes = [
    { id: 'start', type: 'start', x: 60, y: 200, data: {} },
    buildDoorLockCardNode(),
  ];

  const edges = [
    { id: 'e_start', source: 'start', sourceHandle: 'default', target: 'n_link' },
  ];

  return {
    id: HESEOS_SHOPPING_FLOW_ID,
    tenantId,
    name: 'WhatsApp Shopping — Door Lock landing page',
    enabled: true,
    version: FLOW_VERSION,
    // Substring-matched (lib/botFlowEngine.js's pickFlow does a plain `.includes()`), lower-cased.
    // "door lock"/"doorlock"/"smart lock"/"digital lock" are the product itself; buy/shopping/
    // catalogue/catalog are the generic shopping words, which now also lead to this page since it is
    // the only thing sold over WhatsApp. A bare "lock" is left out on purpose ("block", "clock",
    // "lockdown"…). "shop"/"products" alone stay out too — too eager ("workshop").
    triggers: {
      keywords: ['door lock', 'doorlock', 'smart lock', 'digital lock', 'fingerprint lock', 'buy', 'shopping', 'catalogue', 'catalog'],
      attribution: [],
      isDefault: false,
    },
    nodes,
    edges,
    createdAt: now,
    updatedAt: now,
  };
}

// Inserts when missing; upgrades a stored copy that predates FLOW_VERSION (the v1 in-chat
// catalogue flow) to the current definition, keeping its own enabled on/off switch — an admin who
// turned this flow OFF stays off. A copy already at the current version is never touched, so edits
// made in Flow Builder after this upgrade are left alone.
export async function ensureHeseosShoppingFlow(tenant, existingFlows) {
  const list = existingFlows || [];
  const current = list.find((f) => f.id === HESEOS_SHOPPING_FLOW_ID);
  if (current && (current.version || 1) >= FLOW_VERSION) return list;
  const flow = buildHeseosShoppingFlow(tenant.id);
  if (current) {
    flow.enabled = current.enabled !== false;
    flow.createdAt = current.createdAt || flow.createdAt;
  }
  await dbInsert('bot_flows', flow.id, flow);
  return current ? list.map((f) => (f.id === HESEOS_SHOPPING_FLOW_ID ? flow : f)) : [...list, flow];
}
