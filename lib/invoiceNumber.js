// lib/invoiceNumber.js
// Assigns each order its tax-invoice number + date ONCE, the first time its invoice is generated,
// and stores them on the order (invoiceNo / invoiceDate) so every re-print shows the same number.
//
// Format:  <PRODUCT>-<MMYY>-<SEQ>   e.g.  DL-1026-100  (Door Lock, October 2026, serial 100)
//   PRODUCT  from the order's first item (PRODUCT_PREFIX below; anything else -> 'INV')
//   MMYY     month + year of the invoice date (IST)
//   SEQ      running serial per PRODUCT prefix — it continues across months (it does NOT restart each
//            month), so a number is never repeated. First serial is INVOICE_START_NO (env, default 100).
//
// Counters live in the `settings` table (row id 'invoice_counter_<PREFIX>', { last }). The per-order
// assignment is atomic (dbClaim only writes while the order has no invoiceNo), so double-clicking
// "Generate Invoice" never gives one order two numbers.
import { dbGetById, dbInsert, dbPatch, dbClaim } from '@/lib/db';
import { istDateStr } from '@/lib/date';

// Order item productId -> invoice prefix. Add new products here.
const PRODUCT_PREFIX = {
  'heseos-smart-door-lock': 'DL',
};
const DEFAULT_PREFIX = 'INV';
const FORMAT = /^[A-Z]{2,4}-\d{4}-\d+$/;

function startNo() {
  const n = parseInt(process.env.INVOICE_START_NO || '100', 10);
  return Number.isFinite(n) && n > 0 ? n : 100;
}

export function invoicePrefixForOrder(order) {
  const first = Array.isArray(order.items) ? order.items[0] : null;
  return (first && PRODUCT_PREFIX[first.productId]) || DEFAULT_PREFIX;
}

export async function ensureInvoiceMeta(order) {
  if (order.invoiceNo && FORMAT.test(String(order.invoiceNo))) {
    return { invoiceNo: String(order.invoiceNo), invoiceDate: order.invoiceDate || istDateStr() };
  }
  // (An order numbered under the earlier plain-number scheme, e.g. "528", falls through and is renumbered.)
  const prefix = invoicePrefixForOrder(order);
  const counterId = `invoice_counter_${prefix}`;
  const row = await dbGetById('settings', counterId);
  const next = Math.max(Number(row && row.last) || 0, startNo() - 1) + 1;
  const invoiceDate = istDateStr(); // yyyy-mm-dd (IST)
  const mmyy = `${invoiceDate.slice(5, 7)}${invoiceDate.slice(2, 4)}`;
  const invoiceNo = `${prefix}-${mmyy}-${next}`;
  const patch = { invoiceNo, invoiceDate };

  if (order.invoiceNo) {
    await dbPatch('orders', order.id, patch); // legacy numeric number -> new format
  } else {
    const claim = await dbClaim('orders', order.id, 'invoiceNo', patch);
    if (!claim.ok) {
      // Someone else numbered this order a moment ago — reuse theirs.
      const d = claim.data || {};
      return { invoiceNo: String(d.invoiceNo || invoiceNo), invoiceDate: d.invoiceDate || invoiceDate };
    }
  }
  await dbInsert('settings', counterId, { id: counterId, last: next, updatedAt: new Date().toISOString() });
  return { invoiceNo, invoiceDate };
}
