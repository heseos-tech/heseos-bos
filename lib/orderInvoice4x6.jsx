// lib/orderInvoice4x6.jsx
// The customer GST TAX INVOICE for an order, laid out on a 4 x 6 inch page (288 x 432 pt) —
// a one-for-one copy of the myBillBook invoice the business used before orders were invoiced from
// here (same blocks, same order, same wording): TAX INVOICE / ORIGINAL, company block + logo,
// Invoice No / Date, BILL TO / SHIP TO, items table with a pinned "Freight, Installation &
// Logistics" row, TOTAL / RECEIVED AMOUNT, HSN-wise tax summary (CGST+SGST within Maharashtra,
// IGST otherwise), amount in words, bank details, terms & conditions and the authorised-signatory
// stamp.
//
// Used by app/api/admin/orders/[id]/pdf/route.js (?type=invoice). Pure-JS via @react-pdf/renderer
// like lib/orderPdf.jsx (no headless browser). Invoice number/date are assigned once per order by
// lib/invoiceNumber.js and passed in — this file does no I/O except reading the logo/stamp/font
// files from /public.
//
// GST: order prices (lib/heseosOrders.js) are GST-INCLUSIVE at 18%, so the invoice splits each
// line: taxable = lineTotal / 1.18, tax = lineTotal - taxable. "RATE" is the per-unit taxable
// rate, exactly as the myBillBook sample shows (4,236.44 + 762.56 tax = 4,999).
import { Document, Page, View, Text, Image, StyleSheet, Font } from '@react-pdf/renderer';
import fs from 'fs';
import path from 'path';

// ── Edit these to change what prints on every invoice ──────────────────────────────────────
export const INVOICE_COMPANY = {
  legalName: 'Heseos Technology Private Limited',
  // Printed exactly as it appears on the myBillBook invoice (including its spelling).
  address: 'S NO 39, INDRAMANI HOU SOCIETY, INDRAMNAI HOSUING SOCIETY, Pune, Pune, Maharashtra, 411014, Pune, Maharashtra, 411014',
  gstin: '27AAGCH7563L1Z0',
  mobile: '8855074496',
  pan: 'AAGCH7563L',
  email: 'support@heseos.com',
  website: 'www.heseos.com',
  homeState: 'Maharashtra', // sales inside this state get CGST + SGST, everywhere else IGST
};
export const INVOICE_BANK = {
  name: 'HESEOS TECHNOLOGY PRIVATE LIMITED',
  ifsc: 'SBIN0009062',
  account: '41978927652',
  bank: 'State Bank of India ,HADAPSAR',
};
export const INVOICE_TERMS = [
  'No returns or exchanges on sold goods.',
  'The product carries a 2-year warranty against manufacturing defects only. There is no coverage for burning or any other damage after handover/installation.',
  'The warranty does not cover normal wear and tear of the product, or any case where accessories are found missing.',
  'Products are uninsured, the customer bears responsibility for any claim.',
  'Do not accept or open the material box if found open or tampered with, any shortage or damage claim will not be considered.',
  'Materials are checked and in working condition, no replacements for damage found at the store/client site.',
  'Materials are inspected for dents/scratches and are deemed approved upon client sign-off.',
];
const GST_RATE = 18; // % — prices are GST-inclusive
const HSN_CODE = process.env.INVOICE_HSN || '-';

// Per-product printed name + description (keyed by order item productId).
const PRODUCT_COPY = {
  'heseos-smart-door-lock': {
    name: 'Heseos Smart Digital Door Lock',
    description:
      'Smart door lock with fingerprint (2000+ users), multiple passcodes, RFID card, mechanical key access. SS304 stainless steel body, powered by 4 alkaline batteries,with emergency USB-C power backup.',
  },
};

const ORANGE = '#C25A00';
const PEACH = '#F8E3D1';
const LINE = '#222222';
const GREY = '#555555';
const BW = 0.5;

const RUPEE_FAMILY = 'HeseosInvoiceRupee';
const RUPEE_FAMILY_BOLD = 'HeseosInvoiceRupeeBold';
function registerRupeeFont() {
  try {
    const regular = path.join(process.cwd(), 'public', 'fonts', 'DejaVuSans.ttf');
    const bold = path.join(process.cwd(), 'public', 'fonts', 'DejaVuSans-Bold.ttf');
    if (!fs.existsSync(regular) || !fs.existsSync(bold)) return false;
    Font.register({ family: RUPEE_FAMILY, src: regular });
    Font.register({ family: RUPEE_FAMILY_BOLD, src: bold });
    return true;
  } catch {
    return false;
  }
}
// Never break words mid-word with a hyphen ("Balab-haupeth") — on a 4-inch page the default looks sloppy.
try { Font.registerHyphenationCallback((w) => [w]); } catch {}
const RUPEE_OK = registerRupeeFont();
const CUR = RUPEE_OK ? '₹' : 'Rs.';

function dataUri(rel, mime) {
  try {
    const buf = fs.readFileSync(path.join(process.cwd(), 'public', rel));
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

// ── formatting helpers ────────────────────────────────────────────────────────────────────
const SMART = { '‘': "'", '’': "'", '“': '"', '”': '"', '–': '-', '—': '-', '…': '...', '•': '-', '·': '-', ' ': ' ' };
function safeText(v) {
  let out = '';
  for (const ch of String(v ?? '')) {
    if (SMART[ch]) { out += SMART[ch]; continue; }
    const c = ch.codePointAt(0);
    if (c >= 0x20 && c <= 0xff) out += ch;
  }
  return out;
}
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
// Indian digit grouping; whole numbers print without decimals, otherwise exactly 2 (4,236.44).
function money(n) {
  const v = r2(n);
  return v.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
function below100(n) { return n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : ''); }
function below1000(n) {
  const h = Math.floor(n / 100), rest = n % 100;
  return [h ? ONES[h] + ' Hundred' : '', rest ? below100(rest) : ''].filter(Boolean).join(' ');
}
function wordsInt(n) {
  if (n === 0) return 'Zero';
  const parts = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thou = Math.floor(n / 1000); n %= 1000;
  if (crore) parts.push(below1000(crore) + ' Crore');
  if (lakh) parts.push(below100(lakh) + ' Lakh');
  if (thou) parts.push(below100(thou) + ' Thousand');
  if (n) parts.push(below1000(n));
  return parts.join(' ');
}
export function amountInWords(amount) {
  const v = r2(amount);
  const rupees = Math.floor(v);
  const paise = Math.round((v - rupees) * 100);
  return `${wordsInt(rupees)} Rupees${paise ? ` and ${wordsInt(paise)} Paise` : ''}`;
}

// Build the printable lines + GST totals from an order. Exported so it can be unit-checked.
export function computeInvoice(order) {
  const state = String(order.state || '').trim();
  const intra = !state || state.toLowerCase() === INVOICE_COMPANY.homeState.toLowerCase();
  const items = (Array.isArray(order.items) ? order.items : []).map((it) => {
    const qty = Math.max(1, Number(it.qty) || 1);
    const lineTotal = r2(it.lineTotal != null ? it.lineTotal : (Number(it.price) || 0) * qty);
    const taxable = r2(lineTotal / (1 + GST_RATE / 100));
    const tax = r2(lineTotal - taxable);
    const copy = PRODUCT_COPY[it.productId] || {};
    return {
      name: copy.name || it.name || 'Item',
      description: copy.description || it.description || '',
      qty,
      rate: r2(taxable / qty),
      taxable,
      tax,
      lineTotal,
    };
  });
  const sum = (k) => r2(items.reduce((s, i) => s + i[k], 0));
  const taxable = sum('taxable');
  const tax = sum('tax');
  const total = items.length ? sum('lineTotal') : r2(order.subtotal || 0);
  const cgst = intra ? r2(tax / 2) : 0;
  return {
    items, intra, taxable, tax, total,
    cgst, sgst: intra ? r2(tax - cgst) : 0, igst: intra ? 0 : tax,
    qty: items.reduce((s, i) => s + i.qty, 0),
    received: order.paymentStatus === 'paid' ? total : 0,
  };
}

const FS = 4.9; // body font size (pt)
const S = StyleSheet.create({
  page: { padding: 8, paddingTop: 7, fontFamily: 'Helvetica', fontSize: FS, color: '#111', lineHeight: 1.25, flexDirection: 'column' },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  title: { fontSize: 7, fontFamily: 'Helvetica-Bold', marginRight: 5 },
  chip: { borderWidth: 0.6, borderColor: '#8a8a99', borderRadius: 1.5, paddingHorizontal: 3, paddingVertical: 1 },
  chipText: { fontSize: 5.2, color: '#6c6c7c', letterSpacing: 0.3 },

  box: { borderWidth: BW, borderColor: LINE, flexDirection: 'column' },
  main: { flexGrow: 1 },
  row: { flexDirection: 'row' },
  hdr: { flexDirection: 'row' },
  hdrLeft: { width: '55.7%', flexDirection: 'row', padding: 5, borderRightWidth: BW, borderRightColor: LINE },
  logo: { width: 40, height: 40, marginRight: 5, marginTop: 8 },
  coName: { fontSize: 7.2, fontFamily: 'Helvetica-Bold', color: ORANGE, marginBottom: 2, lineHeight: 1.2 },
  bold: { fontFamily: 'Helvetica-Bold' },
  hdrRight: { width: '44.3%', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start', paddingTop: 36 },
  metaCol: { alignItems: 'center' },

  parties: { flexDirection: 'row', borderTopWidth: BW, borderTopColor: LINE },
  party: { width: '50%', padding: 4 },
  partyL: { borderRightWidth: BW, borderRightColor: LINE },
  partyName: { fontFamily: 'Helvetica-Bold', fontSize: 5.2, marginVertical: 2 },
  addrRow: { flexDirection: 'row', marginTop: 1 },
  addrLbl: { width: 22 },
  addrTxt: { flex: 1 },

  th: { flexDirection: 'row', backgroundColor: PEACH, borderTopWidth: BW, borderTopColor: LINE },
  thCell: { paddingVertical: 3.5, paddingHorizontal: 2, borderRightWidth: BW, borderRightColor: LINE, justifyContent: 'center' },
  thText: { fontSize: FS, textAlign: 'center', color: '#222' },
  cell: { paddingVertical: 2.5, paddingHorizontal: 3, borderRightWidth: BW, borderRightColor: LINE },
  noBorder: { borderRightWidth: 0 },
  c: { textAlign: 'center' },
  right: { textAlign: 'right' },
  desc: { fontSize: 4.1, color: GREY, marginTop: 1.5, lineHeight: 1.25 },
  pct: { fontSize: 4.1, color: GREY, textAlign: 'center' },
  fill: { flexGrow: 1, flexDirection: 'row' },
  totalRow: { flexDirection: 'row', backgroundColor: PEACH, borderTopWidth: BW, borderTopColor: LINE },
  recvRow: { flexDirection: 'row', borderTopWidth: BW, borderTopColor: LINE },

  hsnBox: { marginTop: 3, borderWidth: BW, borderColor: LINE, flexDirection: 'column' },
  hsnHead: { flexDirection: 'row', backgroundColor: PEACH },
  hsnSub: { flexDirection: 'row', borderTopWidth: BW, borderTopColor: LINE },
  hCell: { borderRightWidth: BW, borderRightColor: LINE, justifyContent: 'center', alignItems: 'center', paddingVertical: 1.5 },
  hVal: { textAlign: 'center', paddingVertical: 1.5, paddingHorizontal: 2, borderRightWidth: BW, borderRightColor: LINE },
  hValR: { textAlign: 'right', paddingVertical: 1.5, paddingHorizontal: 3, borderRightWidth: BW, borderRightColor: LINE },

  lower: { marginTop: 3, borderWidth: BW, borderColor: LINE, flexDirection: 'column' },
  words: { padding: 4, borderBottomWidth: BW, borderBottomColor: LINE },
  footer: { flexDirection: 'row' },
  fBank: { width: '27%', padding: 4, borderRightWidth: BW, borderRightColor: LINE },
  fTerms: { width: '46%', padding: 4, borderRightWidth: BW, borderRightColor: LINE },
  fSign: { width: '27%', padding: 4, alignItems: 'center', justifyContent: 'center' },
  h2: { fontSize: 5.4, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  bankRow: { flexDirection: 'row', marginTop: 2 },
  bankLbl: { width: 31 },
  bankVal: { flex: 1 },
  term: { fontSize: 4.1, lineHeight: 1.18 },
  stamp: { width: 34, height: 34, marginBottom: 3 },
});

// ₹ amounts need the DejaVu font (Helvetica has no rupee glyph).
function Rs({ value, bold, style }) {
  const f = RUPEE_OK ? { fontFamily: bold ? RUPEE_FAMILY_BOLD : RUPEE_FAMILY } : null;
  return <Text style={[style, f, bold && !RUPEE_OK ? S.bold : null]}>{CUR} {money(value)}</Text>;
}

export function OrderInvoice4x6Document({ order, invoiceNo, invoiceDate }) {
  const inv = computeInvoice(order);
  const logo = dataUri('brand/invoice-logo.png', 'image/png');
  const stamp = dataUri('brand/invoice-stamp.jpg', 'image/jpeg');
  const mobile = String(order.phone || '').replace(/\D/g, '').slice(-10);
  const co = INVOICE_COMPANY;
  const name = safeText(order.customerName || '');
  const address = safeText(order.deliveryAddress || '');
  const state = safeText(order.state || co.homeState);
  const W = { sno: '7%', item: '48%', qty: '8%', rate: '11.5%', tax: '13.5%', amt: '12%' };
  const dateStr = invoiceDate ? String(invoiceDate).split('-').reverse().join('/') : '';

  const Party = ({ title, left, extra }) => (
    <View style={[S.party, left ? S.partyL : null]}>
      <Text>{title}</Text>
      <Text style={S.partyName}>{name}</Text>
      <View style={S.addrRow}>
        <Text style={S.addrLbl}>Address:</Text>
        <Text style={S.addrTxt}>{address}</Text>
      </View>
      {extra ? (
        <>
          <Text style={{ marginTop: 3 }}>Place of Supply:  {state}</Text>
          <Text style={{ marginTop: 2 }}>Mobile:  {mobile}</Text>
        </>
      ) : null}
    </View>
  );

  // HSN summary column flex values (same total for CGST+SGST and IGST so the table width reads alike).
  const groups = inv.intra
    ? [{ label: 'CGST', amt: inv.cgst }, { label: 'SGST', amt: inv.sgst }]
    : [{ label: 'IGST', amt: inv.igst }];
  const gFlex = inv.intra ? 1.9 : 3.8;
  const ratePct = inv.intra ? GST_RATE / 2 : GST_RATE;

  return (
    <Document title={`Invoice ${invoiceNo || order.id}`} author={co.legalName}>
      <Page size={[288, 432]} style={S.page}>
        <View style={S.titleRow}>
          <Text style={S.title}>TAX INVOICE</Text>
          <View style={S.chip}><Text style={S.chipText}>ORIGINAL</Text></View>
        </View>

        <View style={[S.box, S.main]}>
          {/* company + invoice meta */}
          <View style={S.hdr}>
            <View style={S.hdrLeft}>
              {logo ? <Image src={logo} style={S.logo} /> : null}
              <View style={{ flex: 1 }}>
                <Text style={S.coName}>{co.legalName}</Text>
                <Text>{co.address}</Text>
                <View style={[S.row, { marginTop: 2 }]}>
                  <View style={{ width: '52%' }}>
                    <Text><Text style={S.bold}>GSTIN:</Text></Text>
                    <Text>{co.gstin}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text><Text style={S.bold}>Mobile:</Text></Text>
                    <Text>{co.mobile}</Text>
                  </View>
                </View>
                <Text style={{ marginTop: 1 }}><Text style={S.bold}>PAN Number: </Text>{co.pan}</Text>
                <Text><Text style={S.bold}>Email: </Text>{co.email}</Text>
                <Text><Text style={S.bold}>Website: </Text> {co.website}</Text>
              </View>
            </View>
            <View style={S.hdrRight}>
              <View style={S.metaCol}><Text style={S.bold}>Invoice No.</Text><Text style={{ marginTop: 2 }}>{invoiceNo}</Text></View>
              <View style={S.metaCol}><Text style={S.bold}>Invoice Date</Text><Text style={{ marginTop: 2 }}>{dateStr}</Text></View>
            </View>
          </View>

          {/* bill to / ship to */}
          <View style={S.parties}>
            <Party title="BILL TO" left extra />
            <Party title="SHIP TO" />
          </View>

          {/* items table head */}
          <View style={S.th}>
            <View style={[S.thCell, { width: W.sno }]}><Text style={S.thText}>S.NO.</Text></View>
            <View style={[S.thCell, { width: W.item }]}><Text style={S.thText}>ITEMS</Text></View>
            <View style={[S.thCell, { width: W.qty }]}><Text style={S.thText}>QTY.</Text></View>
            <View style={[S.thCell, { width: W.rate }]}><Text style={S.thText}>RATE</Text></View>
            <View style={[S.thCell, { width: W.tax }]}><Text style={S.thText}>TAX</Text></View>
            <View style={[S.thCell, S.noBorder, { width: W.amt }]}><Text style={S.thText}>AMOUNT</Text></View>
          </View>

          {/* item rows */}
          {inv.items.map((it, i) => (
            <View key={i} style={S.row} wrap={false}>
              <View style={[S.cell, { width: W.sno }]}><Text style={S.c}>{i + 1}</Text></View>
              <View style={[S.cell, { width: W.item }]}>
                <Text>{safeText(it.name)}</Text>
                {it.description ? <Text style={S.desc}>{safeText(it.description)}</Text> : null}
              </View>
              <View style={[S.cell, { width: W.qty }]}><Text style={S.c}>{it.qty} PCS</Text></View>
              <View style={[S.cell, { width: W.rate }]}><Text style={S.c}>{money(it.rate)}</Text></View>
              <View style={[S.cell, { width: W.tax }]}>
                <Text style={S.c}>{money(it.tax)}</Text>
                <Text style={S.pct}>({GST_RATE}%)</Text>
              </View>
              <View style={[S.cell, S.noBorder, { width: W.amt }]}><Text style={S.right}>{money(it.lineTotal)}</Text></View>
            </View>
          ))}

          {/* flexible blank area keeps TOTAL / footer pinned to the bottom of the page */}
          <View style={S.fill}>
            <View style={[S.cell, { width: W.sno }]} />
            <View style={[S.cell, { width: W.item }]} />
            <View style={[S.cell, { width: W.qty }]} />
            <View style={[S.cell, { width: W.rate }]} />
            <View style={[S.cell, { width: W.tax }]} />
            <View style={[S.cell, S.noBorder, { width: W.amt }]} />
          </View>

          {/* freight row (always 0, as on the myBillBook invoice) */}
          <View style={S.row}>
            <View style={[S.cell, { width: W.sno }]}><Text> </Text></View>
            <View style={[S.cell, { width: W.item }]}><Text style={[S.right, { fontFamily: 'Helvetica-Oblique' }]}>Freight, Installation &amp; Logistics</Text></View>
            <View style={[S.cell, { width: W.qty }]}><Text style={S.c}>-</Text></View>
            <View style={[S.cell, { width: W.rate }]}><Text style={S.c}>0</Text></View>
            <View style={[S.cell, { width: W.tax }]}><Text style={S.c}>0</Text><Text style={S.pct}>(0%)</Text></View>
            <View style={[S.cell, S.noBorder, { width: W.amt }]}><Rs value={0} style={S.right} /></View>
          </View>

          {/* totals */}
          <View style={S.totalRow}>
            <View style={[S.cell, { width: W.sno }]}><Text> </Text></View>
            <View style={[S.cell, { width: W.item }]}><Text style={[S.right, S.bold]}>TOTAL</Text></View>
            <View style={[S.cell, { width: W.qty }]}><Text style={[S.c, S.bold]}>{inv.qty}</Text></View>
            <View style={[S.cell, { width: W.rate }]}><Text> </Text></View>
            <View style={[S.cell, { width: W.tax }]}><Rs value={inv.tax} bold style={[S.c, S.bold]} /></View>
            <View style={[S.cell, S.noBorder, { width: W.amt }]}><Rs value={inv.total} bold style={[S.right, S.bold]} /></View>
          </View>
          <View style={S.recvRow}>
            <View style={[S.cell, { width: W.sno }]}><Text> </Text></View>
            <View style={[S.cell, { width: W.item }]}><Text style={[S.right, S.bold]}>RECEIVED AMOUNT</Text></View>
            <View style={[S.cell, { width: W.qty }]}><Text> </Text></View>
            <View style={[S.cell, { width: W.rate }]}><Text> </Text></View>
            <View style={[S.cell, { width: W.tax }]}><Text> </Text></View>
            <View style={[S.cell, S.noBorder, { width: W.amt }]}><Rs value={inv.received} bold style={[S.right, S.bold]} /></View>
          </View>
        </View>

        {/* HSN / tax summary */}
        <View style={S.hsnBox}>
          <View style={S.hsnHead}>
            <View style={[S.hCell, { flex: 1.1 }]}><Text style={S.bold}>HSN/SAC</Text></View>
            <View style={[S.hCell, { flex: 1.9 }]}><Text style={S.bold}>Taxable Value</Text></View>
            {groups.map((g) => (
              <View key={g.label} style={{ flex: gFlex, borderRightWidth: BW, borderRightColor: LINE }}>
                <View style={{ alignItems: 'center', paddingVertical: 1.5 }}><Text style={S.bold}>{g.label}</Text></View>
                <View style={S.hsnSub}>
                  <View style={[S.hCell, { flex: inv.intra ? 0.6 : 1.2 }]}><Text>Rate</Text></View>
                  <View style={[S.hCell, { flex: inv.intra ? 1.3 : 2.6, borderRightWidth: 0 }]}><Text>Amount</Text></View>
                </View>
              </View>
            ))}
            <View style={[S.hCell, { flex: 1.7, borderRightWidth: 0 }]}><Text style={S.bold}>Total Tax Amount</Text></View>
          </View>
          <View style={[S.row, { borderTopWidth: BW, borderTopColor: LINE }]}>
            <Text style={[S.hVal, { flex: 1.1 }]}>{HSN_CODE}</Text>
            <Text style={[S.hValR, { flex: 1.9 }]}>{money(inv.taxable)}</Text>
            {groups.map((g) => (
              <View key={g.label} style={{ flex: gFlex, flexDirection: 'row' }}>
                <Text style={[S.hVal, { flex: inv.intra ? 0.6 : 1.2 }]}>{ratePct}%</Text>
                <Text style={[S.hValR, { flex: inv.intra ? 1.3 : 2.6 }]}>{money(g.amt)}</Text>
              </View>
            ))}
            <View style={{ flex: 1.7, paddingVertical: 1.5, paddingHorizontal: 3 }}><Rs value={inv.tax} style={S.right} /></View>
          </View>
        </View>

        {/* words + bank + terms + signatory */}
        <View style={S.lower} wrap={false}>
          <View style={S.words}>
            <Text style={[S.bold, { fontSize: 5.4 }]}>Total Amount (in words)</Text>
            <Text style={{ marginTop: 3 }}>{amountInWords(inv.total)}</Text>
          </View>
          <View style={S.footer}>
            <View style={S.fBank}>
              <Text style={S.h2}>Bank Details</Text>
              <View style={S.bankRow}><Text style={S.bankLbl}>Name:</Text><Text style={S.bankVal}>{INVOICE_BANK.name}</Text></View>
              <View style={S.bankRow}><Text style={S.bankLbl}>IFSC Code:</Text><Text style={S.bankVal}>{INVOICE_BANK.ifsc}</Text></View>
              <View style={S.bankRow}><Text style={S.bankLbl}>Account No:</Text><Text style={S.bankVal}>{INVOICE_BANK.account}</Text></View>
              <View style={S.bankRow}><Text style={S.bankLbl}>Bank:</Text><Text style={S.bankVal}>{INVOICE_BANK.bank}</Text></View>
            </View>
            <View style={S.fTerms}>
              <Text style={S.h2}>Terms and Conditions</Text>
              {INVOICE_TERMS.map((t, i) => <Text key={i} style={S.term}>{i + 1}. {t}</Text>)}
            </View>
            <View style={S.fSign}>
              {stamp ? <Image src={stamp} style={S.stamp} /> : null}
              <Text style={{ textAlign: 'center' }}>Authorised Signatory For</Text>
              <Text style={{ textAlign: 'center' }}>{co.legalName}</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
