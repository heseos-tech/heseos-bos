// lib/orderPdf.jsx
// Renders a WhatsApp Shopping order (lib/heseosOrders.js) as a one-page PDF — pure-JS via
// @react-pdf/renderer, same reason lib/quotationPdf.jsx uses it (no headless browser needed, so
// it works fine in a serverless function). Used by app/api/admin/orders/[id]/pdf/route.js for
// the Admin -> Orders detail modal's "Generate Slip" / "Generate Invoice" buttons
// (components/admin/OrdersPage.jsx).
//
// Two documents live here:
//   OrderSlipDocument    — an internal packing/dispatch slip: what to pack, where it's going,
//                           no pricing, with a Packed/Checked/Dispatched sign-off strip for the
//                           warehouse team.
//   OrderInvoiceDocument — a customer-facing bill: itemized pricing, subtotal/total, and the
//                           Cash/UPI-on-delivery payment status (see lib/heseosOrders.js's own
//                           header comment on the v1 payment model — no GST breakdown is
//                           computed for orders today, so this is a plain invoice, not a GST tax
//                           invoice; add a tax split here only once orders actually carry one).
//
// Deliberately its OWN small copy of the rupee-font/safeText/company-block helpers that
// lib/quotationPdf.jsx also has, rather than importing from that file or factoring a shared
// module — this file cannot be live-rendered from wherever it's edited (same limitation
// documented at the top of quotationPdf.jsx), so touching that already-live, customer-facing
// quotation PDF to share code here is a risk this file doesn't need to take. A little
// duplication is cheaper than a shared dependency neither file's edits can be test-rendered
// against.
import { Document, Page, View, Text, Image, StyleSheet, Font } from '@react-pdf/renderer';
import fs from 'fs';
import path from 'path';

const ORANGE = '#ff7a00';
const INK = '#0b1b2e';
const SOFT = '#5c6b7c';
const FAINT = '#8a97a6';
const BORDER = '#ece9e4';
const CARD_BG = '#f7f5f1';
const HEADER_BG = '#f5f1ea';

const COMPANY = {
  legalName: 'Heseos Technology Pvt Ltd',
  addressLines: ['201, Pride Icon, Thite Nagar, Kharadi,', 'Pune, Maharashtra 411014'],
  gstNo: '27AAGCH7563L1Z0',
  email: 'accounts@heseos.com',
};

// Own font-family names (not lib/quotationPdf.jsx's RUPEE_FAMILY/RUPEE_FAMILY_BOLD) so this
// file's Font.register calls share no state with that file's — see the header comment above.
const RUPEE_FAMILY = 'HeseosOrderPdfRupee';
const RUPEE_FAMILY_BOLD = 'HeseosOrderPdfRupeeBold';

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
const RUPEE_FONT_AVAILABLE = registerRupeeFont();
const CUR = RUPEE_FONT_AVAILABLE ? '₹' : 'Rs.';

function brandLogoDataUri() {
  try {
    const file = path.join(process.cwd(), 'public', 'brand', 'lockup-navy.png');
    const buf = fs.readFileSync(file);
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

function numFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

// Same smart-typography-to-ASCII + WinAnsi-range guard as lib/quotationPdf.jsx's safeText — see
// that file's own comment for why: the standard PDF fonts only cover WinAnsi/CP1252, and none of
// the free text flowing in here (a customer's typed name/address, a product name) is sanitized
// before it reaches this file.
const SMART_CHAR_MAP = {
  '‘': "'", '’': "'", '‚': "'", '′': "'",
  '“': '"', '”': '"', '„': '"', '″': '"',
  '–': '-', '—': '-', '−': '-',
  '…': '...',
  '•': '-', '·': '-',
  ' ': ' ',
};
function safeText(v) {
  const s = String(v ?? '');
  let out = '';
  for (const ch of s) {
    const code = ch.codePointAt(0);
    if (SMART_CHAR_MAP[ch]) { out += SMART_CHAR_MAP[ch]; continue; }
    if (code >= 0x20 && code <= 0xff) { out += ch; continue; }
  }
  return out;
}

function CurrencyText({ value, style, bold }) {
  const fontOverride = RUPEE_FONT_AVAILABLE ? { fontFamily: bold ? RUPEE_FAMILY_BOLD : RUPEE_FAMILY } : null;
  return <Text style={[style, fontOverride]}>{CUR} {numFmt(value)}</Text>;
}

function CurrencyHeader({ label }) {
  const fontOverride = RUPEE_FONT_AVAILABLE ? { fontFamily: RUPEE_FAMILY_BOLD } : null;
  return <Text style={styles.thText}>{label} (<Text style={fontOverride}>{CUR}</Text>)</Text>;
}

const styles = StyleSheet.create({
  page: { flexDirection: 'column', padding: 40, paddingBottom: 60, fontSize: 10, color: INK, fontFamily: 'Helvetica', lineHeight: 1.35 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 14, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: BORDER },
  logo: { width: 96 },
  docLabelCol: { flexDirection: 'column', alignItems: 'flex-end' },
  docLabel: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: INK, letterSpacing: 1, textTransform: 'uppercase' },
  docNo: { fontSize: 9.5, color: SOFT, marginTop: 4 },

  metaRow: { flexDirection: 'row', marginBottom: 20 },
  metaBox: { flexDirection: 'column', width: '32%', marginRight: '2%' },
  metaLabel: { fontSize: 7.5, color: FAINT, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  metaValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: INK },

  partiesRow: { flexDirection: 'row', marginBottom: 22 },
  partyCol: { flexDirection: 'column', width: '48%', marginRight: '4%' },
  panelLabel: { fontSize: 7.5, color: FAINT, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  partyName: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: INK, flexShrink: 1 },
  partyLine: { fontSize: 8.5, color: SOFT, marginTop: 3, flexShrink: 1 },

  table: { flexDirection: 'column', borderTopWidth: 1, borderTopColor: BORDER, marginBottom: 20 },
  tHeadRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: BORDER, paddingVertical: 7, backgroundColor: HEADER_BG },
  tRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER, paddingVertical: 9, alignItems: 'center' },
  colIndex: { width: '6%', paddingHorizontal: 5 },
  colProductWide: { width: '52%', paddingHorizontal: 5, flexShrink: 1 },
  colProductWider: { width: '70%', paddingHorizontal: 5, flexShrink: 1 },
  colQty: { width: '12%', paddingHorizontal: 5, textAlign: 'right' },
  colPrice: { width: '15%', paddingHorizontal: 5, textAlign: 'right' },
  colTotal: { width: '15%', paddingHorizontal: 5, textAlign: 'right' },
  thText: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: FAINT, textTransform: 'uppercase' },
  cellText: { fontSize: 9, flexShrink: 1 },
  cellTextBold: { fontSize: 9, fontFamily: 'Helvetica-Bold' },

  summaryRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 24 },
  summaryBox: { flexDirection: 'column', width: '46%' },
  billingRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  billingLabel: { fontSize: 9.5, color: SOFT },
  billingValue: { fontSize: 9.5, color: INK },
  billingGrandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: BORDER, marginTop: 6, paddingTop: 8 },
  billingGrandLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: INK },
  billingGrandValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: ORANGE },

  paymentBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: CARD_BG, borderRadius: 8, padding: 12, marginTop: 12 },
  paymentLabel: { fontSize: 8.5, color: SOFT },
  paymentValue: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: INK, marginTop: 2 },

  sectionSubheading: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', color: INK, marginBottom: 10 },

  checklistRow: { flexDirection: 'row', marginTop: 28 },
  checklistCol: { flexDirection: 'column', width: '31%', marginRight: '3.5%' },
  checklistName: { fontSize: 8.5, color: FAINT, marginBottom: 26 },
  checklistLine: { borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 5 },
  checklistLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: SOFT, textTransform: 'uppercase', letterSpacing: 0.5 },

  notesSection: { flexDirection: 'column', marginTop: 10, marginBottom: 20 },

  signOffRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 30 },
  signOffCol: { flexDirection: 'column', width: '46%', alignItems: 'center' },
  signOffLine: { borderTopWidth: 1, borderTopColor: BORDER, width: '100%', marginTop: 34, paddingTop: 5 },
  signOffLabel: { fontSize: 8, color: FAINT, textAlign: 'center' },

  footer: { position: 'absolute', bottom: 26, left: 40, right: 40, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 9, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerBrand: { fontSize: 8, color: FAINT },
  footerPage: { fontSize: 8, color: FAINT },
});

function Footer() {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerBrand}>Heseos Technology Pvt Ltd  •  {COMPANY.email}</Text>
      <Text style={styles.footerPage} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}

function fmtDate(v) {
  const d = v ? new Date(v) : new Date();
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_LABEL = { placed: 'Placed', packed: 'Packed', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' };

function DeliveryParty({ order }) {
  return (
    <View style={styles.partyCol}>
      <Text style={styles.panelLabel}>Ship To</Text>
      <Text style={styles.partyName}>{safeText(order.customerName || 'WhatsApp customer')}</Text>
      {order.phone ? <Text style={styles.partyLine}>{safeText(order.phone)}</Text> : null}
      {order.deliveryAddress ? <Text style={styles.partyLine}>{safeText(order.deliveryAddress)}</Text> : null}
    </View>
  );
}

function FromParty() {
  return (
    <View style={styles.partyCol}>
      <Text style={styles.panelLabel}>From</Text>
      <Text style={styles.partyName}>{COMPANY.legalName}</Text>
      {COMPANY.addressLines.map((l, i) => <Text key={i} style={styles.partyLine}>{l}</Text>)}
      <Text style={styles.partyLine}>GST No.: {COMPANY.gstNo}</Text>
    </View>
  );
}

// ---------------- Order Slip (internal packing/dispatch doc — no pricing) ----------------
export function OrderSlipDocument({ order }) {
  const logo = brandLogoDataUri();
  const items = Array.isArray(order?.items) ? order.items : [];
  const totalQty = items.reduce((n, it) => n + (Number(it.qty) || 0), 0);

  return (
    <Document title={`Order Slip - ${order.id}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {logo ? <Image src={logo} style={styles.logo} /> : <Text style={styles.partyName}>HESEOS</Text>}
          <View style={styles.docLabelCol}>
            <Text style={styles.docLabel}>Order Slip</Text>
            <Text style={styles.docNo}>{order.id}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaBox}><Text style={styles.metaLabel}>Order Date</Text><Text style={styles.metaValue}>{fmtDate(order.createdAt)}</Text></View>
          <View style={styles.metaBox}><Text style={styles.metaLabel}>Status</Text><Text style={styles.metaValue}>{STATUS_LABEL[order.status] || order.status}</Text></View>
          <View style={styles.metaBox}><Text style={styles.metaLabel}>Total Items</Text><Text style={styles.metaValue}>{totalQty}</Text></View>
        </View>

        <View style={styles.partiesRow}>
          <DeliveryParty order={order} />
        </View>

        <View style={styles.table}>
          <View style={styles.tHeadRow}>
            <View style={styles.colIndex}><Text style={styles.thText}>#</Text></View>
            <View style={styles.colProductWider}><Text style={styles.thText}>Item</Text></View>
            <View style={styles.colQty}><Text style={styles.thText}>Qty</Text></View>
          </View>
          {items.map((it, i) => (
            <View style={styles.tRow} key={i} wrap={false}>
              <View style={styles.colIndex}><Text style={styles.cellText}>{String(i + 1).padStart(2, '0')}</Text></View>
              <View style={styles.colProductWider}><Text style={styles.cellText}>{safeText(it.name)}</Text></View>
              <View style={styles.colQty}><Text style={styles.cellTextBold}>{it.qty}</Text></View>
            </View>
          ))}
        </View>

        {order.notes ? (
          <View style={styles.notesSection}>
            <Text style={styles.panelLabel}>Notes</Text>
            <Text style={styles.billingLabel}>{safeText(order.notes)}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionSubheading}>Packing &amp; Dispatch Checklist</Text>
        <View style={styles.checklistRow}>
          <View style={styles.checklistCol}>
            <Text style={styles.checklistName}> </Text>
            <View style={styles.checklistLine}><Text style={styles.checklistLabel}>Packed By / Date</Text></View>
          </View>
          <View style={styles.checklistCol}>
            <Text style={styles.checklistName}> </Text>
            <View style={styles.checklistLine}><Text style={styles.checklistLabel}>Checked By / Date</Text></View>
          </View>
          <View style={styles.checklistCol}>
            <Text style={styles.checklistName}> </Text>
            <View style={styles.checklistLine}><Text style={styles.checklistLabel}>Dispatched By / Date</Text></View>
          </View>
        </View>

        <Footer />
      </Page>
    </Document>
  );
}

// ---------------- Invoice (customer-facing bill — itemized pricing) ----------------
export function OrderInvoiceDocument({ order }) {
  const logo = brandLogoDataUri();
  const items = Array.isArray(order?.items) ? order.items : [];
  const total = order.subtotal ?? items.reduce((s, it) => s + (Number(it.lineTotal) || (Number(it.price) || 0) * (Number(it.qty) || 0)), 0);
  const isPaid = order.paymentStatus === 'paid';

  return (
    <Document title={`Invoice - ${order.id}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {logo ? <Image src={logo} style={styles.logo} /> : <Text style={styles.partyName}>HESEOS</Text>}
          <View style={styles.docLabelCol}>
            <Text style={styles.docLabel}>Invoice</Text>
            <Text style={styles.docNo}>{order.id}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaBox}><Text style={styles.metaLabel}>Invoice Date</Text><Text style={styles.metaValue}>{fmtDate(order.createdAt)}</Text></View>
          <View style={styles.metaBox}><Text style={styles.metaLabel}>Payment Method</Text><Text style={styles.metaValue}>Cash / UPI on Delivery</Text></View>
          <View style={styles.metaBox}><Text style={styles.metaLabel}>Payment Status</Text><Text style={styles.metaValue}>{isPaid ? 'Paid' : 'Pending'}</Text></View>
        </View>

        <View style={styles.partiesRow}>
          <FromParty />
          <DeliveryParty order={order} />
        </View>

        <View style={styles.table}>
          <View style={styles.tHeadRow}>
            <View style={styles.colIndex}><Text style={styles.thText}>#</Text></View>
            <View style={styles.colProductWide}><Text style={styles.thText}>Item</Text></View>
            <View style={styles.colQty}><Text style={styles.thText}>Qty</Text></View>
            <View style={styles.colPrice}><CurrencyHeader label="Price" /></View>
            <View style={styles.colTotal}><CurrencyHeader label="Amount" /></View>
          </View>
          {items.map((it, i) => (
            <View style={styles.tRow} key={i} wrap={false}>
              <View style={styles.colIndex}><Text style={styles.cellText}>{String(i + 1).padStart(2, '0')}</Text></View>
              <View style={styles.colProductWide}><Text style={styles.cellText}>{safeText(it.name)}</Text></View>
              <View style={styles.colQty}><Text style={styles.cellText}>{it.qty}</Text></View>
              <View style={styles.colPrice}><Text style={styles.cellText}>{numFmt(it.price)}</Text></View>
              <View style={styles.colTotal}><Text style={styles.cellTextBold}>{numFmt(it.lineTotal ?? (Number(it.price) || 0) * (Number(it.qty) || 0))}</Text></View>
            </View>
          ))}
        </View>

        <View style={styles.summaryRow} wrap={false}>
          <View style={styles.summaryBox}>
            <View style={styles.billingRow}>
              <Text style={styles.billingLabel}>Subtotal</Text>
              <CurrencyText value={total} style={styles.billingValue} />
            </View>
            <View style={styles.billingGrandRow}>
              <Text style={styles.billingGrandLabel}>Total Payable</Text>
              <CurrencyText value={total} style={styles.billingGrandValue} bold />
            </View>
            <View style={styles.paymentBox}>
              <View>
                <Text style={styles.paymentLabel}>Payment Status</Text>
                <Text style={styles.paymentValue}>{isPaid ? `Paid${order.paidAt ? ` on ${fmtDate(order.paidAt)}` : ''}` : 'Pending — collected on delivery'}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.signOffRow}>
          <View style={styles.signOffCol}>
            <View style={styles.signOffLine}><Text style={styles.signOffLabel}>For {COMPANY.legalName} — Authorised Signatory</Text></View>
          </View>
        </View>

        <Footer />
      </Page>
    </Document>
  );
}
