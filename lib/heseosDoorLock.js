// The ONE product sold on the WhatsApp -> landing-page ordering journey (public/door-lock/index.html,
// served at /lock): a customer messages HESEOS Buddy on WhatsApp ("Hi, I need door lock"), the bot
// replies with a link to that landing page, they place the order on the page, and an "order placed"
// confirmation comes back to them on WhatsApp. See app/api/shop/door-lock/route.js (order intake),
// lib/heseosShoppingFlow.js (the bot flow that sends the link) and lib/heseosNotify.js's
// notifyHeseosOrderPlaced (the confirmation message).
//
// Price lives here — and ONLY here — as a fixed amount (not a catalogue product): the landing page
// reads it from GET /api/shop/door-lock at load time and the order route always re-prices the order
// from these constants, never from anything the browser sends. To change the festive price, edit
// `price` below.
export const DOOR_LOCK = {
  productId: 'heseos-smart-door-lock',
  name: 'HESEOS Smart Door Lock',
  mrp: 19999, // crossed-out list price (INR, per lock)
  price: 6499, // current festive offer price (INR, per lock) — what the customer actually pays
  maxQty: 10,
};

// Digits-only phone WITHOUT the country code when it's an Indian mobile (the form's 10-digit
// shape); '' when it can't be one.
export function indianMobile(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : '';
}

// The full https:// landing-page link for one WhatsApp chat — ?p= only PRE-FILLS the phone field on
// the page (the customer can still change it), it grants nothing. '' if PUBLIC_BASE_URL isn't set
// in this environment yet, so a flow never texts someone a dead, base-less link.
export function doorLockLink(phone) {
  const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
  if (!base) return '';
  const mobile = indianMobile(phone);
  return `${base}/lock${mobile ? `?p=${mobile}` : ''}`;
}
