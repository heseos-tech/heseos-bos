// Who is this WhatsApp customer, as far as HESEOS is concerned? Two independent facts decide what
// HESEOS Buddy says to someone who messages in (app/api/bot/webhook/route.js):
//   - an OPEN LEAD  — an enquiry still being worked (not Converted / Rejected — lib/leadStage.js),
//                     from ANY source: QR, referral, partner, Meta, the landing page…
//   - an ORDER      — anything on the `orders` table for their number (the door-lock landing page).
// Neither -> the "what are you looking for?" welcome (lib/heseosOrganicFlow.js).
// Either / both -> the "welcome back" flow (lib/heseosReturningFlow.js), whose greeting and menu are
// built from the fields returned here: lead-only customers see their enquiry recap, order-only
// customers see their order, customers with both see both.
//
// Everything is recomputed fresh on each message while a chat is on the welcome-back flow, so an
// order that was dispatched an hour ago shows as Dispatched, never as the status it had at chat start.
import { dbList } from '@/lib/db';
import { normalizePhone, findFirstLeadByPhone } from '@/lib/leadOrigin';
import { isLeadClosed } from '@/lib/leadStage';
import { heseosLeadSummary, heseosLeadOriginNote } from '@/lib/heseosLeadSync';

// What a customer reads for each order status (keys = lib/heseosOrders.js's ORDER_STATUSES).
const ORDER_STATUS_COPY = {
  placed: '🕒 Placed — our team will call you shortly to confirm',
  confirmed: '✅ Confirmed — it will be packed next',
  packed: '📦 Packed — it will be dispatched shortly',
  shipped: '🚚 Dispatched — on its way to you',
  delivered: '🎁 Delivered — our team will contact you to schedule the installation',
  installed: '🏠 Installation done — enjoy your smart home!',
  cancelled: '❌ Cancelled',
};

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

// This phone's orders, newest first. Order phones are stored with the country code ("919960673737"),
// lead phones without — normalizePhone compares the last 10 digits, same as lib/leadOrigin.js.
export function ordersForPhone(phone, orders) {
  const target = normalizePhone(phone);
  if (target.length !== 10) return [];
  return (orders || [])
    .filter((o) => normalizePhone(o.phone) === target)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function orderBlock(o) {
  const items = (o.items || []).map((i) => `${i.name}${Number(i.qty) > 1 ? ` × ${i.qty}` : ''}`).join(', ') || 'Your order';
  // Cash/UPI is collected on delivery: before then it is "pay on delivery"; once delivered and still
  // unpaid it is simply pending; a cancelled order has no payment line worth showing.
  const beforeDelivery = ['placed', 'confirmed', 'packed', 'shipped'].includes(o.status);
  const payment = o.paymentStatus === 'paid' ? 'Paid ✅'
    : o.paymentStatus === 'refunded' ? 'Refunded'
    : o.paymentStatus === 'awaiting' ? 'Online payment not completed'
    : beforeDelivery ? 'Pay by Cash / UPI on delivery' : o.status === 'cancelled' ? '' : 'Payment pending';
  const lines = [
    `🧾 *${o.id}* — ${items}`,
    `📍 Status: ${ORDER_STATUS_COPY[o.status] || o.status}`,
    `💰 Total: ${inr(o.subtotal)}${payment ? ` · ${payment}` : ''}`,
  ];
  return lines.join('\n');
}

const GREET = "Hi again! 👋 I'm *HESEOS Buddy* from HESEOS.";

// `leads` / `orders` may be passed in when the caller already loaded them; otherwise they're read.
// Returns { hasLead, hasOrder, openLead, orders, fields } — `fields` is what the webhook patches
// onto the bot_chats row (they feed lib/botFlowEngine.js's templateVars and menu `showIf` options).
export async function heseosCustomerContext(phone, { leads, orders } = {}) {
  const [allLeads, allOrders] = await Promise.all([leads || dbList('leads'), orders || dbList('orders')]);
  const first = findFirstLeadByPhone(phone, allLeads);
  const openLead = first && !isLeadClosed(first) ? first : null;
  const mine = ordersForPhone(phone, allOrders);
  const hasLead = !!openLead;
  const hasOrder = mine.length > 0;

  const leadSummary = hasLead ? heseosLeadSummary(openLead) : '';
  const leadOriginNote = hasLead ? await heseosLeadOriginNote(openLead) : '';

  // "Latest order" block for the greeting, plus a short count of any earlier ones.
  const latest = mine[0];
  const earlier = mine.length > 1 ? `\n(+${mine.length - 1} earlier order${mine.length > 2 ? 's' : ''} — tap *Check order status* to see all)` : '';
  const orderGreetBlock = hasOrder ? `${orderBlock(latest)}${earlier}` : '';

  const parts = [GREET];
  if (hasLead) {
    parts.push(`You're already in our system — ${leadOriginNote || 'we have your enquiry on file'}. Here's what we have on file for you:\n${leadSummary || '📝 Your enquiry is with our team'}`);
  }
  if (hasOrder) {
    parts.push(hasLead ? `You've also ordered with us — your latest order:\n${orderGreetBlock}` : `Thanks for ordering with us! Here's your latest order:\n${orderGreetBlock}`);
  }
  const returningIntro = parts.join('\n\n');

  // The "Check order status" answer — every recent order (up to 3), plain and current.
  const orderStatusText = hasOrder
    ? [`Here's where your order${mine.length > 1 ? 's stand' : ' stands'}:`, ...mine.slice(0, 3).map(orderBlock)].join('\n\n') + (mine.length > 3 ? `\n\n(…and ${mine.length - 3} older order${mine.length - 3 > 1 ? 's' : ''})` : '')
    : '';

  return {
    hasLead,
    hasOrder,
    openLead,
    orders: mine,
    fields: { hasLead, hasOrder, leadSummary, leadOriginNote, orderStatusText, returningIntro },
  };
}
