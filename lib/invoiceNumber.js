// lib/invoiceNumber.js
// Assigns each order its tax-invoice number + date ONCE, the first time its invoice is generated,
// and stores them on the order (invoiceNo / invoiceDate) so every re-print shows the same number.
//
// Numbers are sequential, kept in the `settings` table (row id 'invoice_counter', { last }). The
// first number is INVOICE_START_NO (env, default 528) — the myBillBook invoices ran up to 527, so
// numbering continues from there. If myBillBook is still being used for other sales in parallel,
// set INVOICE_START_NO higher (or stop using one of the two) or numbers will clash.
//
// The per-order assignment is atomic (dbClaim only writes while the order has no invoiceNo), so
// double-clicking "Generate Invoice" never gives one order two numbers.
import { dbGetById, dbInsert, dbClaim } from '@/lib/db';
import { istDateStr } from '@/lib/date';

const COUNTER_ID = 'invoice_counter';

function startNo() {
  const n = parseInt(process.env.INVOICE_START_NO || '528', 10);
  return Number.isFinite(n) && n > 0 ? n : 528;
}

export async function ensureInvoiceMeta(order) {
  if (order.invoiceNo) return { invoiceNo: String(order.invoiceNo), invoiceDate: order.invoiceDate || istDateStr() };

  const row = await dbGetById('settings', COUNTER_ID);
  const last = Math.max(Number(row && row.last) || 0, startNo() - 1);
  const next = last + 1;
  const invoiceDate = istDateStr();

  const claim = await dbClaim('orders', order.id, 'invoiceNo', { invoiceNo: String(next), invoiceDate });
  if (!claim.ok) {
    // Someone else numbered this order a moment ago — reuse theirs.
    const d = claim.data || {};
    return { invoiceNo: String(d.invoiceNo || next), invoiceDate: d.invoiceDate || invoiceDate };
  }
  await dbInsert('settings', COUNTER_ID, { id: COUNTER_ID, last: next, updatedAt: new Date().toISOString() });
  return { invoiceNo: String(next), invoiceDate };
}
