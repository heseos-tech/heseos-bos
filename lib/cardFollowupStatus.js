// Pre-sales call outcomes for "sent a WhatsApp card but never opened the page" customers
// (Pre-sales → Cards Not Opened). Plain constants so both the API route and the screens can import it.
export const CARD_STATUSES = [
  { key: 'dead', label: 'Dead', color: '#B42318', bg: 'rgba(180,35,24,.12)' },
  { key: 'call_again', label: 'Call Again', color: '#B7791F', bg: 'rgba(183,121,31,.14)' },
  { key: 'follow_up', label: 'Follow up', color: '#1D6FB8', bg: 'rgba(29,111,184,.12)' },
  { key: 'out_of_location', label: 'Out of Location', color: '#6B7280', bg: 'rgba(107,114,128,.14)' },
  { key: 'success', label: 'Success', color: '#15803D', bg: 'rgba(21,128,61,.13)' },
];
export const CARD_STATUS_KEYS = CARD_STATUSES.map((s) => s.key);
export const cardStatusOf = (key) => CARD_STATUSES.find((s) => s.key === key) || null;
// One record per customer (last 10 digits of the phone) — Door Lock and Smart Home cards to the same
// number share one outcome.
export const cardFollowupKey = (phone) => String(phone || '').replace(/\D/g, '').slice(-10);
