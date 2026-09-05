// lib/quotationPdf.jsx
// Renders one quotation revision as a PDF — pure-JS via @react-pdf/renderer (no headless
// browser needed, so it works fine in a serverless function). Used by
// app/api/leads/[id]/quotation-pdf/route.js for both the in-app "Download PDF" button and the
// file WhatsApp sends (lib/heseosNotify.js's sendHeseosQuotationPdf).
//
// This template matches a branded reference layout: letterhead header, a two-column hero (heading
// + intro on the left, a house photo with a rounded "wave" corner on the right), a three-panel
// "Prepared For / Quotation No. / tagline" info row, a product table with per-row photos and a
// real rupee sign, a four-icon feature strip, and a highlighted totals box.
//
// REAL RUPEE SIGN: the built-in PDF fonts (Helvetica etc.) only carry the WinAnsi/CP1252 set,
// which does not include ₹ at all (it's a 2010 Unicode addition, no legacy codepage has it) — no
// amount of care with Helvetica makes it appear, it takes an actual font with that glyph. Rather
// than fetching one over the network at render time (a new failure mode, in a pipeline that has
// already gone down once from a font-related assumption), DejaVu Sans/DejaVu Sans Bold — which do
// contain ₹ (verified: codepoint U+20B9 maps to glyph "uni20B9" in both files) — are bundled
// straight into the repo (public/fonts/) and registered from that LOCAL file, so there is no
// network dependency at all, at render time or otherwise. Registration is wrapped in try/catch
// and gated on the files actually being present (registerRupeeFont() below): if anything about it
// ever fails, every "₹" in this document quietly falls back to "Rs." instead of breaking PDF
// generation — the same safety net the rest of this file already relies on. Only the handful of
// spots that actually show a currency symbol (table header labels, the totals box) opt into the
// DejaVu font; everything else stays on the already-proven Helvetica family.
//
// OTHER DELIBERATE SIMPLIFICATIONS (kept from the previous pass, for the same reason — nothing in
// this pipeline can be live-rendered from wherever this file is edited, so anything not already
// proven either elsewhere in this file or by long-documented @react-pdf/renderer behavior is kept
// simple enough that its failure mode is "looks slightly off", never "breaks the PDF"):
//   - Hero photo: a large rounded corner (bottom-left) rather than an exact free-form wave cutout
//     — react-pdf has no reliable free-form image clip path, but overflow:hidden + borderRadius
//     is standard.
//   - "A Smarter Way to Live" / "Thank you": italic Helvetica, not a true cursive font — no script
//     font file exists anywhere in this repo.
//   - Icon badges: built from Svg's straight-line primitives only (Rect/Line/Circle/Polygon) —
//     no bezier curves — since a malformed curve is the one category of mistake that has no
//     graceful fallback.
import { Document, Page, View, Text, Image, StyleSheet, Font, Svg, Rect, Line, Circle, Polygon } from '@react-pdf/renderer';
import fs from 'fs';
import path from 'path';

const ORANGE = '#ff7a00';
const INK = '#0b1b2e';
const SOFT = '#5c6b7c';
const FAINT = '#8a97a6';
const BORDER = '#e8eaee';
const CARD_BG = '#f7f8fa';
const PEACH = '#fff1e6';
const PEACH_BORDER = '#ffd9b8';
const GREEN = '#178a4c';

const RUPEE_FAMILY = 'HeseosPdfRupee';
const RUPEE_FAMILY_BOLD = 'HeseosPdfRupeeBold';

// Registers the bundled DejaVu Sans files (the only ones on this document that need to show a
// genuine ₹) from a local path — never a URL — so there is nothing to fetch at render time.
// Returns false (and registers nothing) if the files aren't there or anything about reading/
// registering them throws, so callers can fall back to "Rs." instead of ₹ everywhere below.
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

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, color: INK, fontFamily: 'Helvetica' },

  // Letterhead
  letterhead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  logo: { width: 104 },
  taglineCol: { alignItems: 'flex-end' },
  taglineLine: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: SOFT, letterSpacing: 1, textTransform: 'uppercase' },

  // Two-column hero
  heroRow: { flexDirection: 'row', alignItems: 'stretch', marginBottom: 20 },
  heroLeft: { flexGrow: 1.3, flexBasis: 0, paddingRight: 20, justifyContent: 'center' },
  heroRight: { flexGrow: 1, flexBasis: 0, minHeight: 168 },
  quotationLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  quotationDash: { width: 16, height: 2, backgroundColor: ORANGE, marginRight: 6 },
  quotationLabelText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: SOFT, textTransform: 'uppercase', letterSpacing: 2 },
  headingLine: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: INK },
  headingLineOrange: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: ORANGE, marginTop: 1 },
  introBlock: { marginTop: 10 },
  intro: { fontSize: 9.5, color: SOFT, lineHeight: 1.5 },

  heroImageWrap: { width: '100%', height: '100%', minHeight: 168, borderBottomLeftRadius: 90, overflow: 'hidden', position: 'relative', backgroundColor: CARD_BG },
  heroImage: { width: '100%', height: '100%' },
  heroOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%', backgroundColor: 'rgba(11,27,46,0.40)' },
  heroCaption: { position: 'absolute', right: 14, bottom: 18, width: 78, fontSize: 13, fontFamily: 'Helvetica-Oblique', color: '#ffffff', textAlign: 'right', lineHeight: 1.3 },

  // Three-panel info row
  panelRow: { flexDirection: 'row', marginBottom: 18 },
  panel: { flexGrow: 1, flexBasis: 0, borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 10, marginRight: 10 },
  panelLast: { flexGrow: 1, flexBasis: 0, borderRadius: 10, padding: 10, backgroundColor: PEACH, borderWidth: 1, borderColor: PEACH_BORDER },
  panelLabel: { fontSize: 7.5, color: FAINT, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },

  avatarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  avatarCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: PEACH, alignItems: 'center', overflow: 'hidden', marginRight: 8 },
  personHead: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: ORANGE, marginTop: 4 },
  personBody: { width: 18, height: 11, borderTopLeftRadius: 9, borderTopRightRadius: 9, backgroundColor: ORANGE, marginTop: 1 },
  customerName: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  customerLine: { fontSize: 9, color: SOFT, marginTop: 2 },

  quoteMetaItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  quoteMetaIconWrap: { marginRight: 7 },
  quoteMetaLabel: { fontSize: 7.5, color: FAINT, textTransform: 'uppercase', letterSpacing: 0.5 },
  quoteMetaValue: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: INK, marginTop: 1 },

  taglinePanelIconRow: { marginBottom: 8 },
  taglinePanelText: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', color: INK, lineHeight: 1.4 },
  taglinePanelDash: { width: 20, height: 2, backgroundColor: ORANGE, marginTop: 6 },

  // Product table
  table: { borderTopWidth: 1, borderTopColor: BORDER, marginTop: 4 },
  tHeadRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER, paddingVertical: 6, backgroundColor: CARD_BG },
  tRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER, paddingVertical: 8, alignItems: 'center' },
  colIndex: { flexGrow: 0.4, flexBasis: 0, paddingHorizontal: 6 },
  colProduct: { flexGrow: 2.6, flexBasis: 0, paddingHorizontal: 6 },
  colDescription: { flexGrow: 2.4, flexBasis: 0, paddingHorizontal: 6 },
  colQty: { flexGrow: 0.6, flexBasis: 0, paddingHorizontal: 6, textAlign: 'right' },
  colPrice: { flexGrow: 1, flexBasis: 0, paddingHorizontal: 6, textAlign: 'right' },
  colDiscount: { flexGrow: 1.1, flexBasis: 0, paddingHorizontal: 6, textAlign: 'right' },
  colTotal: { flexGrow: 1.1, flexBasis: 0, paddingHorizontal: 6, textAlign: 'right' },
  thText: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: FAINT, textTransform: 'uppercase' },
  productRow: { flexDirection: 'row', alignItems: 'center' },
  itemThumbWrap: { width: 30, height: 30, borderRadius: 5, overflow: 'hidden', backgroundColor: CARD_BG, borderWidth: 1, borderColor: BORDER },
  itemThumb: { width: '100%', height: '100%' },
  itemTextCol: { marginLeft: 8 },
  itemName: { fontSize: 9.5, fontFamily: 'Helvetica-Bold' },
  itemSku: { fontSize: 8, color: FAINT, marginTop: 1 },
  itemDesc: { fontSize: 8, color: SOFT, lineHeight: 1.3 },
  cellText: { fontSize: 9 },

  // Feature strip
  featureRow: { flexDirection: 'row', marginTop: 18, marginBottom: 6 },
  featureCol: { flexGrow: 1, flexBasis: 0, alignItems: 'center' },
  featureBadge: { width: 30, height: 30, borderRadius: 15, backgroundColor: PEACH, borderWidth: 1, borderColor: PEACH_BORDER, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  featureLabel: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: INK, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.3 },

  // Totals
  totalsBox: { marginTop: 12, alignSelf: 'flex-end', width: 230 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalsLabel: { fontSize: 9.5, color: SOFT },
  totalsValue: { fontSize: 9.5, color: INK },
  totalsDiscountValue: { fontSize: 9.5, color: GREEN },
  grandRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: PEACH, borderRadius: 8, marginTop: 6, paddingVertical: 8, paddingHorizontal: 10 },
  grandLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: INK },
  grandValue: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: ORANGE },

  note: { fontSize: 9, color: SOFT, marginTop: 20, lineHeight: 1.5 },

  footer: { position: 'absolute', bottom: 26, left: 32, right: 32, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 10 },
  footerBrandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  footerBrand: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: INK },
  footerTagline: { fontSize: 8, color: FAINT, marginTop: 1 },
  footerThanks: { fontSize: 13, fontFamily: 'Helvetica-Oblique', color: ORANGE },
  footerValidity: { fontSize: 7.5, color: FAINT, textAlign: 'center', marginTop: 8 },
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

// The hero photo the user pointed to (public/Home-Screen.webp) is a WebP file, and
// @react-pdf/renderer's <Image> reliably supports only JPEG/PNG — not WebP — so a JPEG copy
// (public/brand/quotation-hero.jpg) was made once, offline, and checked into the repo. This just
// reads that pre-converted copy; it does not touch or re-encode anything at request time.
function heroImageDataUri() {
  try {
    const file = path.join(process.cwd(), 'public', 'brand', 'quotation-hero.jpg');
    const buf = fs.readFileSync(file);
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

// Plain number formatting, no currency symbol — the product table's own rows never show a
// currency mark (only the column headers and the totals box do), so this alone is what every
// price/discount/total cell in the table uses.
function numFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

// The standard 14 PDF fonts (Helvetica included) only carry the WinAnsi/CP1252 character set —
// nothing outside it is guaranteed to render, and some ranges (emoji and other characters well
// outside Latin-1 in particular) have been seen to throw during renderToBuffer() rather than
// just render a blank box, which is a much worse failure than a missing glyph: it takes down
// the WHOLE PDF (and, upstream, the WhatsApp send) instead of just looking a little off. Every
// piece of free text that flows into this document is something a partner/employee typed (a
// quotation note, a product name/SKU/description picked or typed into the catalogue, a lead's
// name/city) — none of it is sanitized before it gets here, so a pasted em dash, curly quote,
// ellipsis or emoji (all common from a phone keyboard or copy-pasted from WhatsApp/Word) can end
// up in a revision.note or item name and break PDF generation for that lead from then on. First
// maps the common "smart" typography to its plain-ASCII equivalent (keeps the text reading the
// same instead of just vanishing), then strips anything else outside the printable WinAnsi range.
const SMART_CHAR_MAP = {
  '‘': "'", '’': "'", '‚': "'", '′': "'",
  '“': '"', '”': '"', '„': '"', '″': '"',
  '–': '-', '—': '-', '−': '-',
  '…': '...',
  '•': '-', '·': '-',
  ' ': ' ',
};
function safeText(v) {
  const s = String(v ?? '');
  let out = '';
  for (const ch of s) {
    const code = ch.codePointAt(0);
    if (SMART_CHAR_MAP[ch]) { out += SMART_CHAR_MAP[ch]; continue; }
    if (code >= 0x20 && code <= 0xff) { out += ch; continue; }
    // Anything else (emoji, other scripts, stray control characters) is dropped rather than
    // risking a crash — silently missing an emoji from a quotation note is a fine trade for
    // the PDF actually generating.
  }
  return out;
}

// Looks up the catalogue product behind a quotation line item — first by the productId the
// line was created with, falling back to a case-insensitive SKU match for older revisions saved
// before productId existed on a line, or for a product that's since been edited. Returns null
// (not throwing) whenever nothing matches, since a deleted/renamed product should just fall back
// to a placeholder thumbnail rather than break the PDF.
function findProduct(item, products) {
  if (!Array.isArray(products) || products.length === 0) return null;
  if (item?.productId) {
    const byId = products.find((p) => p && p.id === item.productId);
    if (byId) return byId;
  }
  if (item?.sku) {
    const bySku = products.find((p) => p && p.sku && String(p.sku).toLowerCase() === String(item.sku).toLowerCase());
    if (bySku) return bySku;
  }
  return null;
}

function productPhotoDataUri(product) {
  const url = product?.photos?.[0]?.dataUrl;
  // Product photos are captured client-side as JPEG data URLs (ProductsPage.jsx always calls
  // canvas.toDataURL('image/jpeg', ...)), which is exactly what <Image> can render — this check
  // just guards against a malformed/missing value rather than assuming the shape is always right.
  return typeof url === 'string' && url.startsWith('data:image') ? url : null;
}

// A currency-prefixed amount ("₹ 12,000" / "Rs. 12,000"). Only text that actually shows a
// currency mark opts into the bundled DejaVu font (see the big comment at the top of this file);
// everything else in the document stays on the proven Helvetica family untouched.
function CurrencyText({ value, style, negative, bold }) {
  const fontOverride = RUPEE_FONT_AVAILABLE ? { fontFamily: bold ? RUPEE_FAMILY_BOLD : RUPEE_FAMILY } : null;
  return (
    <Text style={[style, fontOverride]}>
      {negative ? '-' : ''}{CUR} {numFmt(value)}
    </Text>
  );
}

// A table header label with a "(₹)" suffix — the label itself stays in Helvetica-Bold (matching
// every other header) and only the currency mark switches font, as an inline run.
function CurrencyHeader({ label }) {
  const fontOverride = RUPEE_FONT_AVAILABLE ? { fontFamily: RUPEE_FAMILY_BOLD } : null;
  return (
    <Text style={styles.thText}>
      {label} (<Text style={fontOverride}>{CUR}</Text>)
    </Text>
  );
}

// Small line-art icons built only from Svg's straight-line/circle primitives (Rect, Line, Circle,
// Polygon) — deliberately no bezier curve paths, so there's nothing here that can render as a
// malformed shape.
function Icon({ name, size = 14, color = ORANGE, strokeWidth = 1.4 }) {
  const box = { width: size, height: size, viewBox: '0 0 24 24' };
  if (name === 'document') {
    return (
      <Svg {...box}>
        <Rect x={5} y={2} width={14} height={20} rx={2} stroke={color} strokeWidth={strokeWidth} fill="none" />
        <Line x1={8} y1={8} x2={16} y2={8} stroke={color} strokeWidth={strokeWidth} />
        <Line x1={8} y1={12} x2={16} y2={12} stroke={color} strokeWidth={strokeWidth} />
        <Line x1={8} y1={16} x2={13} y2={16} stroke={color} strokeWidth={strokeWidth} />
      </Svg>
    );
  }
  if (name === 'calendar') {
    return (
      <Svg {...box}>
        <Rect x={3} y={5} width={18} height={16} rx={2} stroke={color} strokeWidth={strokeWidth} fill="none" />
        <Line x1={3} y1={10} x2={21} y2={10} stroke={color} strokeWidth={strokeWidth} />
        <Line x1={7} y1={2} x2={7} y2={6} stroke={color} strokeWidth={strokeWidth} />
        <Line x1={17} y1={2} x2={17} y2={6} stroke={color} strokeWidth={strokeWidth} />
      </Svg>
    );
  }
  if (name === 'house') {
    return (
      <Svg {...box}>
        <Polygon points="12,3 21,10 3,10" fill={color} />
        <Rect x={6} y={10} width={12} height={9} stroke={color} strokeWidth={strokeWidth} fill="none" />
      </Svg>
    );
  }
  if (name === 'bulb') {
    return (
      <Svg {...box}>
        <Circle cx={12} cy={9} r={6} stroke={color} strokeWidth={strokeWidth} fill="none" />
        <Line x1={9} y1={17} x2={15} y2={17} stroke={color} strokeWidth={strokeWidth} />
        <Line x1={10} y1={20} x2={14} y2={20} stroke={color} strokeWidth={strokeWidth} />
      </Svg>
    );
  }
  if (name === 'shield') {
    return (
      <Svg {...box}>
        <Polygon points="12,3 20,6 20,12 12,21 4,12 4,6" stroke={color} strokeWidth={strokeWidth} fill="none" />
        <Line x1={8} y1={12} x2={11} y2={15} stroke={color} strokeWidth={strokeWidth} />
        <Line x1={11} y1={15} x2={16} y2={9} stroke={color} strokeWidth={strokeWidth} />
      </Svg>
    );
  }
  if (name === 'bolt') {
    return (
      <Svg {...box}>
        <Polygon points="13,2 5,14 11,14 9,22 20,9 12,9" fill={color} />
      </Svg>
    );
  }
  if (name === 'arrow') {
    return (
      <Svg {...box}>
        <Polygon points="3,10 14,10 14,5 21,13 14,21 14,16 3,16" fill={color} />
      </Svg>
    );
  }
  return null;
}

const FEATURES = [
  { label: 'Smarter Living', icon: 'bulb' },
  { label: 'Safer Homes', icon: 'shield' },
  { label: 'Energy Efficient', icon: 'bolt' },
  { label: 'Future Ready', icon: 'arrow' },
];

export default function QuotationPdfDocument({
  lead,
  revision,
  products = [],
  brandName = 'Heseos',
  tagline = 'Smart Home Automation',
}) {
  const logo = brandLogoDataUri();
  const hero = heroImageDataUri();
  const items = Array.isArray(revision?.items) ? revision.items : [];
  const hasItems = items.length > 0;
  const dateLabel = revision?.at ? new Date(revision.at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

  return (
    <Document title={`Quotation - ${safeText(lead.name)}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.letterhead}>
          <View>{logo ? <Image src={logo} style={styles.logo} /> : <Text style={styles.customerName}>{safeText(brandName)}</Text>}</View>
          <View style={styles.taglineCol}>
            <Text style={styles.taglineLine}>Smart Homes.</Text>
            <Text style={styles.taglineLine}>Stronger People.</Text>
            <Text style={styles.taglineLine}>Brighter Tomorrow.</Text>
          </View>
        </View>

        <View style={styles.heroRow}>
          <View style={styles.heroLeft}>
            <View style={styles.quotationLabelRow}>
              <View style={styles.quotationDash} />
              <Text style={styles.quotationLabelText}>Quotation</Text>
            </View>
            <Text style={styles.headingLine}>Smart Solutions</Text>
            <Text style={styles.headingLineOrange}>for a Smarter You</Text>
            <View style={styles.introBlock}>
              <Text style={styles.intro}>Thank you for considering {safeText(brandName).toUpperCase()} for your smart home journey.</Text>
              <Text style={styles.intro}>We are pleased to share the quotation as per your requirement.</Text>
            </View>
          </View>
          <View style={styles.heroRight}>
            {hero ? (
              <View style={styles.heroImageWrap}>
                <Image src={hero} style={styles.heroImage} />
                <View style={styles.heroOverlay} />
                <Text style={styles.heroCaption}>A Smarter Way to Live</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.panelRow}>
          <View style={styles.panel}>
            <Text style={styles.panelLabel}>Prepared For</Text>
            <View style={styles.avatarRow}>
              <View style={styles.avatarCircle}>
                <View style={styles.personHead} />
                <View style={styles.personBody} />
              </View>
              <Text style={styles.customerName}>{safeText(lead.name)}</Text>
            </View>
            <Text style={styles.customerLine}>{safeText(lead.phone)}</Text>
            {lead.city ? <Text style={styles.customerLine}>{safeText(lead.city)}</Text> : null}
          </View>

          <View style={styles.panel}>
            <View style={styles.quoteMetaItem}>
              <View style={styles.quoteMetaIconWrap}><Icon name="document" size={14} /></View>
              <View>
                <Text style={styles.quoteMetaLabel}>Quotation No.</Text>
                <Text style={styles.quoteMetaValue}>{lead.id}-v{revision?.revision || 1}</Text>
              </View>
            </View>
            <View style={styles.quoteMetaItem}>
              <View style={styles.quoteMetaIconWrap}><Icon name="calendar" size={14} /></View>
              <View>
                <Text style={styles.quoteMetaLabel}>Date</Text>
                <Text style={styles.quoteMetaValue}>{dateLabel || '-'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.panelLast}>
            <View style={styles.taglinePanelIconRow}><Icon name="house" size={16} /></View>
            <Text style={styles.taglinePanelText}>Smarter Homes,</Text>
            <Text style={styles.taglinePanelText}>Happier Lives</Text>
            <View style={styles.taglinePanelDash} />
          </View>
        </View>

        {hasItems && (
          <View style={styles.table}>
            <View style={styles.tHeadRow}>
              <View style={styles.colIndex}><Text style={styles.thText}>#</Text></View>
              <View style={styles.colProduct}><Text style={styles.thText}>Product</Text></View>
              <View style={styles.colDescription}><Text style={styles.thText}>Description</Text></View>
              <View style={styles.colQty}><Text style={styles.thText}>Qty</Text></View>
              <View style={styles.colPrice}><CurrencyHeader label="Price" /></View>
              <View style={styles.colDiscount}><CurrencyHeader label="Discount" /></View>
              <View style={styles.colTotal}><CurrencyHeader label="Total" /></View>
            </View>
            {items.map((it, i) => {
              const product = findProduct(it, products);
              const photo = productPhotoDataUri(product);
              const description = product?.description ? safeText(product.description) : '';
              return (
                <View style={styles.tRow} key={i}>
                  <View style={styles.colIndex}><Text style={styles.cellText}>{String(i + 1).padStart(2, '0')}</Text></View>
                  <View style={styles.colProduct}>
                    <View style={styles.productRow}>
                      <View style={styles.itemThumbWrap}>
                        {photo ? <Image src={photo} style={styles.itemThumb} /> : null}
                      </View>
                      <View style={styles.itemTextCol}>
                        <Text style={styles.itemName}>{safeText(it.name)}</Text>
                        {it.sku ? <Text style={styles.itemSku}>{safeText(it.sku)}</Text> : null}
                      </View>
                    </View>
                  </View>
                  <View style={styles.colDescription}>
                    {description ? <Text style={styles.itemDesc}>{description}</Text> : null}
                  </View>
                  <View style={styles.colQty}><Text style={styles.cellText}>{it.qty}</Text></View>
                  <View style={styles.colPrice}><Text style={styles.cellText}>{numFmt(it.price)}</Text></View>
                  <View style={styles.colDiscount}><Text style={styles.cellText}>{it.discount ? numFmt(it.discount) : '-'}</Text></View>
                  <View style={styles.colTotal}><Text style={styles.cellText}>{numFmt(it.lineTotal)}</Text></View>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.featureRow}>
          {FEATURES.map((f) => (
            <View style={styles.featureCol} key={f.label}>
              <View style={styles.featureBadge}><Icon name={f.icon} size={15} /></View>
              <Text style={styles.featureLabel}>{f.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBox}>
          {hasItems && (
            <>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Subtotal</Text>
                <CurrencyText value={revision.subtotal} style={styles.totalsValue} />
              </View>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Discount</Text>
                <CurrencyText value={revision.discountTotal} style={styles.totalsDiscountValue} negative />
              </View>
            </>
          )}
          <View style={styles.grandRow}>
            <Text style={styles.grandLabel}>Total</Text>
            <CurrencyText value={revision?.amount} style={styles.grandValue} bold />
          </View>
        </View>

        {revision?.note ? <Text style={styles.note}>Note: {safeText(revision.note)}</Text> : null}

        <View style={styles.footer}>
          <View style={styles.footerBrandRow}>
            <View>
              <Text style={styles.footerBrand}>{safeText(brandName)}</Text>
              <Text style={styles.footerTagline}>{safeText(tagline)}</Text>
            </View>
            <Text style={styles.footerThanks}>Thank you</Text>
          </View>
          <Text style={styles.footerValidity}>This quotation is valid for 15 days from the date above. For any queries, feel free to contact us.</Text>
        </View>
      </Page>
    </Document>
  );
}
