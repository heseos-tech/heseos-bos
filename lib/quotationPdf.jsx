// lib/quotationPdf.jsx
// Renders one quotation revision as a PDF — pure-JS via @react-pdf/renderer (no headless
// browser needed, so it works fine in a serverless function). Used by
// app/api/leads/[id]/quotation-pdf/route.js for both the in-app "Download PDF" button and the
// file WhatsApp sends (lib/heseosQuotationSend.js).
//
// NOTE ON THE RUPEE SIGN: @react-pdf/renderer's built-in Helvetica font doesn't reliably carry
// the ₹ glyph (it can render as a blank box), so this template spells it "Rs." instead — the
// UI everywhere else keeps using ₹, this file is the one deliberate exception.
//
// NOTE ON VERIFICATION: @react-pdf/renderer is listed in package.json but isn't installed in
// this shell (no network access here to fetch it) — this file is written to the library's
// documented API but hasn't been run. `npm install` (in your own terminal) plus a real
// download is the first real test of it; see the chat for the full rundown of what's verified
// this way vs. what isn't.
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import fs from 'fs';
import path from 'path';

const ORANGE = '#ff7a00';
const INK = '#0b1b2e';
const SOFT = '#5c6b7c';
const FAINT = '#8a97a6';
const BORDER = '#e8eaee';

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, color: INK, fontFamily: 'Helvetica' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 26 },
  logo: { width: 120 },
  docTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: ORANGE, textAlign: 'right' },
  docMeta: { fontSize: 9, color: FAINT, textAlign: 'right', marginTop: 4 },
  section: { marginBottom: 18 },
  sectionLabel: { fontSize: 8, color: FAINT, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  customerName: { fontSize: 12, fontFamily: 'Helvetica-Bold' },
  customerLine: { fontSize: 9.5, color: SOFT, marginTop: 2 },
  table: { borderTopWidth: 1, borderTopColor: BORDER, marginTop: 8 },
  tHeadRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER, paddingVertical: 6, backgroundColor: '#f7f8fa' },
  tRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER, paddingVertical: 8 },
  colItem: { flexGrow: 3, flexBasis: 0, paddingHorizontal: 6 },
  colQty: { flexGrow: 0.8, flexBasis: 0, paddingHorizontal: 6, textAlign: 'right' },
  colPrice: { flexGrow: 1.2, flexBasis: 0, paddingHorizontal: 6, textAlign: 'right' },
  colDiscount: { flexGrow: 1.2, flexBasis: 0, paddingHorizontal: 6, textAlign: 'right' },
  colTotal: { flexGrow: 1.3, flexBasis: 0, paddingHorizontal: 6, textAlign: 'right' },
  thText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: FAINT, textTransform: 'uppercase' },
  itemName: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  itemSku: { fontSize: 8, color: FAINT, marginTop: 1 },
  totalsBox: { marginTop: 16, alignSelf: 'flex-end', width: 220 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalsLabel: { fontSize: 9.5, color: SOFT },
  totalsValue: { fontSize: 9.5, color: INK },
  grandRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1.5, borderTopColor: BORDER, marginTop: 6, paddingTop: 8 },
  grandLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: INK },
  grandValue: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: ORANGE },
  note: { fontSize: 9, color: SOFT, marginTop: 20, lineHeight: 1.5 },
  footer: { position: 'absolute', bottom: 30, left: 36, right: 36, fontSize: 8, color: FAINT, textAlign: 'center', borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 10 },
});

function brandLogoDataUri() {
  try {
    const file = path.join(process.cwd(), 'public', 'brand', 'lockup-navy.png');
    const buf = fs.readFileSync(file);
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

function money(n) {
  return `Rs. ${Number(n || 0).toLocaleString('en-IN')}`;
}

export default function QuotationPdfDocument({ lead, revision, brandName = 'Heseos', tagline = 'Smart Home Automation' }) {
  const logo = brandLogoDataUri();
  const items = Array.isArray(revision?.items) ? revision.items : [];
  const hasItems = items.length > 0;
  const dateLabel = revision?.at ? new Date(revision.at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

  return (
    <Document title={`Quotation - ${lead.name}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>{logo ? <Image src={logo} style={styles.logo} /> : <Text style={styles.customerName}>{brandName}</Text>}</View>
          <View>
            <Text style={styles.docTitle}>QUOTATION</Text>
            <Text style={styles.docMeta}>Ref: {lead.id}-v{revision?.revision || 1}</Text>
            {dateLabel ? <Text style={styles.docMeta}>{dateLabel}</Text> : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Prepared For</Text>
          <Text style={styles.customerName}>{lead.name}</Text>
          <Text style={styles.customerLine}>{lead.phone}</Text>
          {lead.city ? <Text style={styles.customerLine}>{lead.city}</Text> : null}
        </View>

        {hasItems && (
          <View style={styles.table}>
            <View style={styles.tHeadRow}>
              <View style={styles.colItem}><Text style={styles.thText}>Item</Text></View>
              <View style={styles.colQty}><Text style={styles.thText}>Qty</Text></View>
              <View style={styles.colPrice}><Text style={styles.thText}>Price</Text></View>
              <View style={styles.colDiscount}><Text style={styles.thText}>Discount</Text></View>
              <View style={styles.colTotal}><Text style={styles.thText}>Total</Text></View>
            </View>
            {items.map((it, i) => (
              <View style={styles.tRow} key={i}>
                <View style={styles.colItem}>
                  <Text style={styles.itemName}>{it.name}</Text>
                  {it.sku ? <Text style={styles.itemSku}>{it.sku}</Text> : null}
                </View>
                <View style={styles.colQty}><Text>{it.qty}</Text></View>
                <View style={styles.colPrice}><Text>{money(it.price)}</Text></View>
                <View style={styles.colDiscount}><Text>{it.discount ? money(it.discount) : '-'}</Text></View>
                <View style={styles.colTotal}><Text>{money(it.lineTotal)}</Text></View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.totalsBox}>
          {hasItems && (
            <>
              <View style={styles.totalsRow}><Text style={styles.totalsLabel}>Subtotal</Text><Text style={styles.totalsValue}>{money(revision.subtotal)}</Text></View>
              <View style={styles.totalsRow}><Text style={styles.totalsLabel}>Discount</Text><Text style={styles.totalsValue}>-{money(revision.discountTotal)}</Text></View>
            </>
          )}
          <View style={styles.grandRow}><Text style={styles.grandLabel}>Total</Text><Text style={styles.grandValue}>{money(revision?.amount)}</Text></View>
        </View>

        {revision?.note ? <Text style={styles.note}>Note: {revision.note}</Text> : null}

        <Text style={styles.footer}>{brandName} · {tagline} · This quotation is valid for 15 days from the date above.</Text>
      </Page>
    </Document>
  );
}
