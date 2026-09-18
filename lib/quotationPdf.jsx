// lib/quotationPdf.jsx
// Renders one quotation revision as a branded, 3-page PDF — pure-JS via @react-pdf/renderer (no
// headless browser needed, so it works fine in a serverless function). Used by
// app/api/leads/[id]/quotation-pdf/route.js for both the in-app "Download PDF" button and the
// file WhatsApp sends (lib/heseosNotify.js's sendHeseosQuotationPdf), and by the public,
// share-token twin app/api/quotation/[token]/pdf/route.js.
//
// Page 1 — Cover: letterhead, a hero photo + headline, the quotation number and validity
//   dates, a From/To block, a 3-icon trust strip, and a closing line.
// Page 2 — Products & Pricing: the line-item table, a Billing Summary box with the total
//   spelled out in words, and the standing Terms & Conditions / Notes.
// Page 3 — Site Readiness Guide: the pre-installation requirements grouped into General /
//   Network / Installation sections, plus a "check before installation" callout.
// A quotation with no line items (an admin/sales-engineer can still send a bare amount) skips
// the table and just shows the total — same graceful fallback this file has always had.
//
// REAL RUPEE SIGN: the built-in PDF fonts (Helvetica etc.) only carry the WinAnsi/CP1252 set,
// which does not include ₹ at all (it's a 2010 Unicode addition, no legacy codepage has it) — no
// amount of care with Helvetica makes it appear, it takes an actual font with that glyph. Rather
// than fetching one over the network at render time, DejaVu Sans / DejaVu Sans Bold (which do
// contain ₹) are bundled into the repo (public/fonts/) and registered from that LOCAL file, so
// there is no network dependency at all. If registration ever fails, every "₹" quietly falls
// back to "Rs." instead of breaking PDF generation.
//
// YOGA LAYOUT NOTES (read this before touching column widths): @react-pdf/renderer's layout
// engine (Yoga) differs from ordinary CSS in two ways that are easy to trip on —
//   1. A flex item's default flexShrink is 0 (CSS defaults to 1). A Text/View sized only by
//      flexGrow never shrinks below its own content's width, so a long value (a customer name,
//      a product name) can silently render past its column's boundary and overlap the next
//      column. Every column here uses an explicit PERCENTAGE width, and every column holding
//      free text also sets flexShrink: 1 so long content wraps instead of overflowing.
//   2. <View> has no CSS "block" fallback — every View is a flex container, defaulting to
//      flexDirection: 'column'. Every View below states its flexDirection explicitly.
// Nothing here can be live-rendered from wherever this file is edited (no way to run this
// project's own @react-pdf/renderer + native SWC toolchain from that environment), so anything
// not already proven, or long-documented @react-pdf/renderer behaviour, is kept simple enough
// that its failure mode is "looks slightly off", never "breaks the PDF".
import { Document, Page, View, Text, Image, StyleSheet, Font, Svg, Rect, Line, Circle, Polygon } from '@react-pdf/renderer';
import fs from 'fs';
import path from 'path';

const ORANGE = '#ff7a00';
const INK = '#0b1b2e';
const SOFT = '#5c6b7c';
const FAINT = '#8a97a6';
const BORDER = '#ece9e4';
const CARD_BG = '#f7f5f1';
const HEADER_BG = '#f5f1ea';
const PEACH = '#fff1e6';
const PEACH_BORDER = '#ffd9b8';
const GREEN = '#178a4c';
const WHITE = '#ffffff';

// The company's own fixed billing details — the same address/GST shown on HESEOS's actual
// quotations (not derived from any lead/employee input, so safe to keep as a constant here,
// same category as brandName/tagline below). Update this one block if the registered office or
// GSTIN ever changes.
const COMPANY = {
  legalName: 'Heseos Technology Pvt Ltd',
  addressLines: ['201, Pride Icon, Thite Nagar, Kharadi,', 'Pune, Maharashtra 411014'],
  gstNo: '27AAGCH7563L1Z0',
  email: 'accounts@heseos.com',
};

// A quotation is open for negotiation for 30 days from the date it's (re)sent — matches the
// gap already seen between Issue Date and Valid Till on Heseos's own quotations.
const VALIDITY_DAYS = 30;

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
  // lineHeight is set here (not per-Text) so it's inherited everywhere by default — without an
  // explicit multiplier, a Text's line box falls back to the active font's own reported
  // ascent/descent metrics, and two stacked lines (a label above a value, a title above a
  // caption) can end up rendered closer together than intended, or overlapping outright, if
  // those metrics ever come back unreliable for the font actually in use at render time. An
  // explicit value removes that dependency for every Text below that doesn't already set its
  // own (several already do, for multi-line paragraphs, and keep it).
  page: { flexDirection: 'column', padding: 40, paddingBottom: 60, fontSize: 10, color: INK, fontFamily: 'Helvetica', lineHeight: 1.35 },

  // ---------- Page 1 letterhead ----------
  letterhead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logoCol: { flexDirection: 'column' },
  logo: { width: 108 },
  logoSub: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: FAINT, letterSpacing: 2, textTransform: 'uppercase', marginTop: 5 },
  taglineCol: { flexDirection: 'column', alignItems: 'flex-end' },
  taglineLine: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: SOFT, letterSpacing: 1, textTransform: 'uppercase', lineHeight: 1.5 },

  // ---------- Pages 2/3 slim header ----------
  slimHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, marginBottom: 18, borderBottomWidth: 1, borderBottomColor: BORDER },
  slimLogo: { width: 76 },
  slimHeaderRight: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: SOFT, textTransform: 'uppercase', letterSpacing: 0.5 },

  // ---------- Hero banner (page 1) — a full-width photo with the headline overlaid directly on
  // it (a dark scrim behind the text guarantees contrast regardless of which part of the photo
  // sits underneath), matching the reference layout rather than the earlier side-by-side split.
  heroBanner: { flexDirection: 'column', width: '100%', height: 230, borderRadius: 16, overflow: 'hidden', position: 'relative', backgroundColor: INK, marginTop: 14, marginBottom: 22 },
  heroBannerImage: { width: '100%', height: '100%', objectFit: 'cover' },
  heroBannerOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(11,27,46,0.45)' },
  heroBannerContent: { position: 'absolute', left: 22, right: 90, top: 22, bottom: 22, flexDirection: 'column', justifyContent: 'flex-start' },
  quotationLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  quotationDash: { width: 16, height: 2, backgroundColor: ORANGE, marginRight: 7 },
  quotationLabelText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: 2 },
  headingLine: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: WHITE, lineHeight: 1.25, marginBottom: 4, flexShrink: 1 },
  headingLineOrange: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: ORANGE, lineHeight: 1.25, marginTop: 2, flexShrink: 1 },
  introBlock: { marginTop: 12 },
  intro: { fontSize: 9, color: 'rgba(255,255,255,0.82)', lineHeight: 1.6, flexShrink: 1 },

  // ---------- Quotation number + validity (page 1) ----------
  metaRow: { flexDirection: 'row', marginBottom: 20 },
  metaLeftCol: { flexDirection: 'column', width: '55%', marginRight: 18, justifyContent: 'center' },
  metaBigLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: FAINT, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 },
  metaBigValue: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: INK },
  metaDatesBox: { flexDirection: 'column', width: '41%', borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 12 },
  metaDateRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  metaDateLabel: { fontSize: 8.5, color: SOFT },
  metaDateValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: INK },

  // ---------- From / To (page 1) ----------
  partiesRow: { flexDirection: 'row', marginBottom: 22 },
  partyCol: { flexDirection: 'column', width: '48%', marginRight: '4%' },
  panelLabel: { fontSize: 7.5, color: FAINT, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  partyName: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: INK, flexShrink: 1 },
  partyLine: { fontSize: 8.5, color: SOFT, marginTop: 3, flexShrink: 1 },

  // ---------- 3-icon trust strip (page 1) ----------
  featureStripBox: { flexDirection: 'column', borderWidth: 1, borderColor: BORDER, borderRadius: 12, paddingVertical: 16, marginBottom: 24, backgroundColor: CARD_BG },
  featureRow: { flexDirection: 'row' },
  featureCol: { flexDirection: 'column', alignItems: 'center', width: '33.33%', paddingHorizontal: 8 },
  featureBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 15, backgroundColor: PEACH, borderWidth: 1, borderColor: PEACH_BORDER, marginBottom: 8 },
  featureLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: INK, textAlign: 'center', marginBottom: 2 },
  featureSub: { fontSize: 7.5, color: FAINT, textAlign: 'center', marginTop: 3, flexShrink: 1 },

  closingBlock: { flexDirection: 'column', alignItems: 'center', marginTop: 4 },
  closingText: { fontSize: 13, fontFamily: 'Helvetica-Oblique', color: ORANGE, textAlign: 'center' },

  // ---------- Section headings (pages 2/3) ----------
  sectionHeading: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: INK, marginBottom: 14 },
  sectionSubheading: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', color: INK, marginBottom: 8 },

  // ---------- Product table (page 2) ----------
  table: { flexDirection: 'column', borderTopWidth: 1, borderTopColor: BORDER, marginBottom: 20 },
  tHeadRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: BORDER, paddingVertical: 7, backgroundColor: HEADER_BG },
  tRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER, paddingVertical: 9, alignItems: 'center' },
  colIndex: { width: '5%', paddingHorizontal: 5 },
  colProductWide: { width: '43%', paddingHorizontal: 5, flexShrink: 1 },
  colQty: { width: '9%', paddingHorizontal: 5, textAlign: 'right' },
  colPrice: { width: '15%', paddingHorizontal: 5, textAlign: 'right' },
  colDiscount: { width: '14%', paddingHorizontal: 5, textAlign: 'right' },
  colTotal: { width: '14%', paddingHorizontal: 5, textAlign: 'right' },
  thText: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: FAINT, textTransform: 'uppercase' },
  productRow: { flexDirection: 'row', alignItems: 'center' },
  itemThumbWrap: { width: 28, height: 28, borderRadius: 6, overflow: 'hidden', backgroundColor: CARD_BG, borderWidth: 1, borderColor: BORDER, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  itemThumb: { width: '100%', height: '100%', objectFit: 'cover' },
  itemTextCol: { flexDirection: 'column', marginLeft: 8, flexShrink: 1 },
  itemName: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', flexShrink: 1 },
  itemSku: { fontSize: 7.5, color: FAINT, marginTop: 2 },
  cellText: { fontSize: 9 },
  cellTextBold: { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  cellSub: { fontSize: 7, color: GREEN, marginTop: 1 },

  // ---------- Billing summary + amount in words (page 2) ----------
  summarySplitRow: { flexDirection: 'row', marginBottom: 24 },
  billingSummaryBox: { flexDirection: 'column', width: '52%', marginRight: '4%', backgroundColor: INK, borderRadius: 12, padding: 16 },
  billingSummaryTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  billingRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  billingLabel: { fontSize: 9.5, color: 'rgba(255,255,255,0.7)' },
  billingValue: { fontSize: 9.5, color: WHITE },
  billingDiscountValue: { fontSize: 9.5, color: '#7ee0a8' },
  billingGrandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.18)', marginTop: 9, paddingTop: 10 },
  billingGrandLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: WHITE },
  billingGrandValue: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: ORANGE },
  wordsCol: { flexDirection: 'column', width: '44%', borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 14 },
  wordsText: { fontSize: 9, color: SOFT, lineHeight: 1.5, flexShrink: 1 },

  // ---------- Terms & Notes (page 2) ----------
  twoColRow: { flexDirection: 'row' },
  twoCol: { flexDirection: 'column', width: '48%', marginRight: '4%' },
  numberedRow: { flexDirection: 'row', marginBottom: 7 },
  numberedIndex: { width: 14, fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: ORANGE },
  numberedText: { fontSize: 8.5, color: SOFT, lineHeight: 1.4, flexShrink: 1, width: '88%' },

  // ---------- Site readiness banner (page 3) ----------
  readinessBanner: { flexDirection: 'column', height: 108, borderRadius: 12, overflow: 'hidden', position: 'relative', backgroundColor: INK, marginBottom: 16 },
  readinessBannerImage: { width: '100%', height: '100%', objectFit: 'cover' },
  readinessBannerOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(11,27,46,0.72)' },
  readinessBannerContent: { position: 'absolute', left: 18, right: 18, top: 0, bottom: 0, flexDirection: 'column', justifyContent: 'center' },
  readinessBannerTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: WHITE, lineHeight: 1.35 },
  readinessBannerSub: { fontSize: 8.5, color: 'rgba(255,255,255,0.75)', marginTop: 8, lineHeight: 1.4, flexShrink: 1, width: '80%' },

  readinessIntro: { fontSize: 8.5, color: SOFT, lineHeight: 1.5, marginBottom: 14, flexShrink: 1 },

  readinessSection: { flexDirection: 'column', marginBottom: 14 },
  readinessSectionHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: INK, borderRadius: 7, paddingVertical: 6, paddingHorizontal: 10, marginBottom: 8 },
  readinessSectionIcon: { width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  readinessSectionTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: WHITE, textTransform: 'uppercase', letterSpacing: 0.5 },
  readinessItemRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER, paddingVertical: 6 },
  readinessItemLabel: { width: '26%', fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: INK, paddingRight: 8, flexShrink: 1 },
  readinessItemText: { width: '74%', fontSize: 8.5, color: SOFT, lineHeight: 1.4, flexShrink: 1 },

  calloutBox: { flexDirection: 'row', backgroundColor: PEACH, borderWidth: 1, borderColor: PEACH_BORDER, borderRadius: 10, padding: 12, marginTop: 4 },
  calloutIconWrap: { width: 24, height: 24, borderRadius: 12, backgroundColor: WHITE, alignItems: 'center', justifyContent: 'center', marginRight: 10, flexShrink: 0 },
  calloutTitle: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: INK, marginBottom: 3 },
  calloutText: { fontSize: 8.5, color: SOFT, lineHeight: 1.4, flexShrink: 1 },

  // ---------- Footer (every page) ----------
  footer: { position: 'absolute', bottom: 26, left: 40, right: 40, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 9, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerBrand: { fontSize: 8, color: FAINT },
  footerPage: { fontSize: 8, color: FAINT },
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

// public/brand/quotation-hero.jpg is a pre-converted JPEG copy of the branded interior photo
// (@react-pdf/renderer's <Image> reliably supports only JPEG/PNG, not the site's WebP originals)
// checked into the repo once, offline — this just reads that copy, nothing is fetched or
// re-encoded at request time.
function heroImageDataUri() {
  try {
    const file = path.join(process.cwd(), 'public', 'brand', 'quotation-hero.jpg');
    const buf = fs.readFileSync(file);
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

// Plain number formatting, no currency symbol.
function numFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
function twoDigitWords(n) {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
}
function threeDigitWords(n) {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  let out = '';
  if (h) out += ONES[h] + ' Hundred';
  if (rest) out += (out ? ' ' : '') + twoDigitWords(rest);
  return out;
}
// Indian numbering (crore/lakh/thousand) amount-in-words — rounds to the nearest whole rupee,
// same convention Heseos's own quotations already use (paise are dropped from the words line
// even when the numeric total carries them).
function numberToWordsINR(amount) {
  let n = Math.round(Math.abs(Number(amount) || 0));
  if (n === 0) return 'Rupees Zero Only';
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  const hundred = n;
  const parts = [];
  if (crore) parts.push(threeDigitWords(crore) + ' Crore');
  if (lakh) parts.push(threeDigitWords(lakh) + ' Lakh');
  if (thousand) parts.push(threeDigitWords(thousand) + ' Thousand');
  if (hundred) parts.push(threeDigitWords(hundred));
  return 'Rupees ' + parts.join(' ') + ' Only';
}

// The standard 14 PDF fonts (Helvetica included) only carry the WinAnsi/CP1252 character set —
// nothing outside it is guaranteed to render, and some ranges have been seen to throw during
// renderToBuffer() rather than just render a blank box, which takes down the WHOLE PDF instead
// of just looking a little off. Every piece of free text that flows into this document (a
// quotation note, a product name/SKU typed into the catalogue, a lead's name/city) is something
// a partner/employee typed and none of it is sanitized before it gets here, so a pasted em dash,
// curly quote, ellipsis or emoji can end up in a revision.note or item name and break PDF
// generation for that lead from then on. First maps common "smart" typography to its plain-ASCII
// equivalent, then strips anything else outside the printable WinAnsi range.
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
    // Anything else (emoji, other scripts, stray control characters) is dropped rather than
    // risking a crash — silently missing an emoji from a quotation note is a fine trade for the
    // PDF actually generating.
  }
  return out;
}

// Looks up the catalogue product behind a quotation line item — first by the productId the line
// was created with, falling back to a case-insensitive SKU match for older revisions saved
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

// Small line-art icons built only from Svg's straight-line/circle primitives (Rect, Line,
// Circle, Polygon) — deliberately no bezier curve paths, so there's nothing here that can render
// as a malformed shape.
function Icon({ name, size = 14, color = ORANGE, strokeWidth = 1.4 }) {
  const box = { width: size, height: size, viewBox: '0 0 24 24' };
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
  if (name === 'people') {
    return (
      <Svg {...box}>
        <Circle cx={16.5} cy={9} r={2.6} stroke={color} strokeWidth={strokeWidth} fill="none" />
        <Rect x={12.5} y={13} width={8} height={6} rx={3} stroke={color} strokeWidth={strokeWidth} fill="none" />
        <Circle cx={9} cy={7.5} r={3.2} stroke={color} strokeWidth={strokeWidth} fill="none" />
        <Rect x={4} y={12} width={10} height={7} rx={3.5} stroke={color} strokeWidth={strokeWidth} fill="none" />
      </Svg>
    );
  }
  if (name === 'gear') {
    // An 8-point star silhouette reads as a simple gear/settings glyph at icon size, built from
    // one Polygon (straight lines only — see the header comment on why nothing here uses a
    // bezier path).
    const cx = 12; const cy = 12; const rOuter = 9.5; const rInner = 6;
    const pts = [];
    for (let i = 0; i < 16; i++) {
      const r = i % 2 === 0 ? rOuter : rInner;
      const a = (Math.PI / 8) * i - Math.PI / 2;
      pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
    }
    return (
      <Svg {...box}>
        <Polygon points={pts.join(' ')} fill="none" stroke={color} strokeWidth={strokeWidth} />
        <Circle cx={cx} cy={cy} r={2.6} fill={color} />
      </Svg>
    );
  }
  if (name === 'signal') {
    return (
      <Svg {...box}>
        <Rect x={4} y={15} width={3.4} height={6} fill={color} />
        <Rect x={10.3} y={10} width={3.4} height={11} fill={color} />
        <Rect x={16.6} y={4} width={3.4} height={17} fill={color} />
      </Svg>
    );
  }
  if (name === 'checkCircle') {
    return (
      <Svg {...box}>
        <Circle cx={12} cy={12} r={9.5} stroke={color} strokeWidth={strokeWidth} fill="none" />
        <Line x1={7.5} y1={12.5} x2={10.5} y2={15.5} stroke={color} strokeWidth={strokeWidth} />
        <Line x1={10.5} y1={15.5} x2={16.5} y2={8.5} stroke={color} strokeWidth={strokeWidth} />
      </Svg>
    );
  }
  if (name === 'alert') {
    return (
      <Svg {...box}>
        <Polygon points="12,3 21,19 3,19" stroke={color} strokeWidth={strokeWidth} fill="none" />
        <Line x1={12} y1={10} x2={12} y2={14.5} stroke={color} strokeWidth={strokeWidth} />
        <Circle cx={12} cy={17} r={0.9} fill={color} />
      </Svg>
    );
  }
  return null;
}

const FEATURES = [
  { label: 'Smart Living', sub: 'More comfort, everyday', icon: 'bulb' },
  { label: 'Reliable Technology', sub: 'Built for peace of mind', icon: 'shield' },
  { label: 'Expert Support', sub: 'From setup to beyond', icon: 'people' },
];

// Standing company policy — the same on every quotation regardless of lead, so it's kept as
// static content here (like the footer/company block) rather than something a revision stores.
const TERMS = [
  'No returns or exchanges on sold goods.',
  'Warranty covers manufacturing defects only; no coverage for Acts of God, burning, or any other damage after handover/installation.',
  'Products are uninsured; the customer bears claim responsibility.',
  'Materials are checked and in working condition; no replacements for damages found at the store/client site.',
  'Materials are inspected for dents/scratches and approved upon client signoff.',
];
const NOTES = [
  "To schedule installation, it is mandatory to have Wi-Fi Internet services on the client's premises.",
  'To schedule installation, the client should inform us at least 3 working days in advance (excluding Sundays).',
  'Logistics will take a maximum of 8 working days.',
];

// Pre-installation requirements — standing content (public/brand-level, not per-quotation),
// grouped the same way Heseos's own site-readiness sheet already groups them.
const SITE_READINESS_SECTIONS = [
  {
    title: 'General Requirements',
    icon: 'gear',
    items: [
      { label: 'Concealed Box Depth', text: 'Use high-quality metal concealed boxes with a minimum depth of 3-3.5 inches to ensure proper fitting of Heseos touch panels and modules.' },
      { label: 'Fan Compatibility', text: 'Standard ceiling fans do not support two-way operation. Please confirm compatibility before planning automation.' },
      { label: 'Bell Switch Wiring', text: 'A neutral wire is mandatory at the bell switch point for proper functionality.' },
      { label: 'Strip Light Load', text: 'For strip lights longer than 6 meters, ensure drivers and wiring support high-load capacity to avoid performance issues.' },
      { label: 'Air Conditioning Load', text: 'High-load control modules are not compatible with centralized VRV/VRF AC systems. Separate planning is required for such setups.' },
      { label: 'Voltage Stability', text: 'To protect smart devices from voltage fluctuations, installation of a Servo Static Stabilizer is strongly recommended.' },
      { label: 'Curtain Motor Wiring', text: 'Provide five-core wiring from the switchboard to each curtain motor point.' },
      { label: 'Analog Dimmer Wiring', text: 'Dimming Control: 2 signal wires + 1 supply wire. Tuning Control: 3 signal wires + 1 supply wire.' },
    ],
  },
  {
    title: 'Network Requirements',
    icon: 'signal',
    items: [
      { label: 'Internet Speed', text: 'Minimum broadband speed of 5 Mbps is required for stable remote access and cloud functionality.' },
      { label: 'Wi-Fi Coverage', text: 'Install high-performance mesh access points (e.g. Deco M4 or equivalent) in each room to eliminate Wi-Fi blind spots.' },
      { label: 'Router & Connectivity', text: 'All access points must connect to the main router using CAT6 cables. A Gigabit power switch should be installed at the router location.' },
      { label: 'Professional Setup', text: 'Network installation and optimization should be handled by a professional networking agency to ensure seamless performance.' },
      { label: 'IoT Frequency', text: 'All Heseos IoT devices operate on the 2.4 GHz frequency band. Ensure compatibility during network setup.' },
    ],
  },
  {
    title: 'Installation Requirements',
    icon: 'checkCircle',
    items: [
      { label: 'Certified Electrician', text: 'Installation must be performed by a qualified electrician. Heseos Service Engineers provide technical guidance and supervision only.' },
      { label: 'Warranty Activation', text: 'Warranty registration must be completed after installation to activate official product coverage.' },
    ],
  },
];

// Repeats on every physical page (including any auto-overflow page a long table/section pushes
// content onto — `fixed` is what makes that happen in @react-pdf/renderer).
function Footer({ brandName }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerBrand}>{safeText(brandName)} Technology Pvt Ltd  •  {COMPANY.email}</Text>
      <Text style={styles.footerPage} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}

// Slim repeating header for pages 2/3 — small logo + the quotation number, so a reader who
// jumps straight to the pricing or site-readiness page can still see which quotation they're
// looking at.
function PageHeader({ logo, brandName, quotationNo }) {
  return (
    <View style={styles.slimHeader} fixed>
      {logo ? <Image src={logo} style={styles.slimLogo} /> : <Text style={styles.metaBigValue}>{safeText(brandName)}</Text>}
      <Text style={styles.slimHeaderRight}>Quotation {quotationNo}</Text>
    </View>
  );
}

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
  // Present on every revision saved after the pricing-breakdown feature shipped (both itemized
  // and manual quotations); absent on older revisions saved before it, which fall back to the
  // original plain Subtotal/Discount/Total display below.
  const hasPricingBreakdown = revision?.netProductCost != null;
  const quotationNo = `${lead.id}-V${revision?.revision || 1}`;

  const issueAt = revision?.at ? new Date(revision.at) : new Date();
  const validTillAt = new Date(issueAt.getTime() + VALIDITY_DAYS * 24 * 60 * 60 * 1000);
  const fmtLabel = (d) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const issueDateLabel = fmtLabel(issueAt);
  const validTillLabel = fmtLabel(validTillAt);

  return (
    <Document title={`Quotation - ${safeText(lead.name)}`}>
      {/* ---------------- Page 1: Cover ---------------- */}
      <Page size="A4" style={styles.page}>
        <View style={styles.letterhead}>
          <View style={styles.logoCol}>
            {logo ? <Image src={logo} style={styles.logo} /> : <Text style={styles.partyName}>{safeText(brandName)}</Text>}
            <Text style={styles.logoSub}>Live Smarter</Text>
          </View>
          <View style={styles.taglineCol}>
            <Text style={styles.taglineLine}>Smart Homes.</Text>
            <Text style={styles.taglineLine}>Happier Living.</Text>
          </View>
        </View>

        <View style={styles.heroBanner}>
          {hero ? <Image src={hero} style={styles.heroBannerImage} /> : null}
          <View style={styles.heroBannerOverlay} />
          <View style={styles.heroBannerContent}>
            <View style={styles.quotationLabelRow}>
              <View style={styles.quotationDash} />
              <Text style={styles.quotationLabelText}>Quotation</Text>
            </View>
            <Text style={styles.headingLine}>Your Smarter Home</Text>
            <Text style={styles.headingLineOrange}>Awaits</Text>
            <View style={styles.introBlock}>
              <Text style={styles.intro}>Thoughtfully designed solutions for a more comfortable, connected and secure home. Thank you for considering {safeText(brandName).toUpperCase()} for your smart home journey.</Text>
            </View>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaLeftCol}>
            <Text style={styles.metaBigLabel}>Quotation No.</Text>
            <Text style={styles.metaBigValue}>{quotationNo}</Text>
          </View>
          <View style={styles.metaDatesBox}>
            <View style={styles.metaDateRow}><Text style={styles.metaDateLabel}>Issue Date</Text><Text style={styles.metaDateValue}>{issueDateLabel}</Text></View>
            <View style={styles.metaDateRow}><Text style={styles.metaDateLabel}>Valid Till</Text><Text style={styles.metaDateValue}>{validTillLabel}</Text></View>
          </View>
        </View>

        <View style={styles.partiesRow}>
          <View style={styles.partyCol}>
            <Text style={styles.panelLabel}>From</Text>
            <Text style={styles.partyName}>{COMPANY.legalName}</Text>
            {COMPANY.addressLines.map((l, i) => <Text key={i} style={styles.partyLine}>{l}</Text>)}
            <Text style={styles.partyLine}>GST No.: {COMPANY.gstNo}</Text>
          </View>
          <View style={styles.partyCol}>
            <Text style={styles.panelLabel}>To</Text>
            <Text style={styles.partyName}>{safeText(lead.name)}</Text>
            {lead.phone ? <Text style={styles.partyLine}>{safeText(lead.phone)}</Text> : null}
            {lead.city ? <Text style={styles.partyLine}>{safeText(lead.city)}</Text> : null}
          </View>
        </View>

        <View style={styles.featureStripBox}>
          <View style={styles.featureRow}>
            {FEATURES.map((f) => (
              <View style={styles.featureCol} key={f.label}>
                <View style={styles.featureBadge}><Icon name={f.icon} size={14} /></View>
                <Text style={styles.featureLabel}>{f.label}</Text>
                <Text style={styles.featureSub}>{f.sub}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.closingBlock}>
          <Text style={styles.closingText}>Let's build a smarter tomorrow, together.</Text>
        </View>

        <Footer brandName={brandName} />
      </Page>

      {/* ---------------- Page 2: Products & Pricing ---------------- */}
      <Page size="A4" style={styles.page}>
        <PageHeader logo={logo} brandName={brandName} quotationNo={quotationNo} />
        <Text style={styles.sectionHeading}>Products &amp; Pricing</Text>

        {hasItems && (
          <View style={styles.table}>
            <View style={styles.tHeadRow}>
              <View style={styles.colIndex}><Text style={styles.thText}>#</Text></View>
              <View style={styles.colProductWide}><Text style={styles.thText}>Item</Text></View>
              <View style={styles.colQty}><Text style={styles.thText}>Qty</Text></View>
              <View style={styles.colPrice}><CurrencyHeader label="Price" /></View>
              <View style={styles.colDiscount}><CurrencyHeader label="Discount" /></View>
              <View style={styles.colTotal}><CurrencyHeader label="Amount" /></View>
            </View>
            {items.map((it, i) => {
              const product = findProduct(it, products);
              const photo = productPhotoDataUri(product);
              const base = (Number(it.price) || 0) * (Number(it.qty) || 0);
              const pct = base > 0 && it.discount ? Math.round((Number(it.discount) / base) * 100) : 0;
              return (
                <View style={styles.tRow} key={i} wrap={false}>
                  <View style={styles.colIndex}><Text style={styles.cellText}>{String(i + 1).padStart(2, '0')}</Text></View>
                  <View style={styles.colProductWide}>
                    <View style={styles.productRow}>
                      <View style={styles.itemThumbWrap}>
                        {photo ? <Image src={photo} style={styles.itemThumb} /> : <Icon name="house" size={12} color={FAINT} />}
                      </View>
                      <View style={styles.itemTextCol}>
                        <Text style={styles.itemName}>{safeText(it.name)}</Text>
                        {it.sku ? <Text style={styles.itemSku}>{safeText(it.sku)}</Text> : null}
                      </View>
                    </View>
                  </View>
                  <View style={styles.colQty}><Text style={styles.cellText}>{it.qty}</Text></View>
                  <View style={styles.colPrice}><Text style={styles.cellText}>{numFmt(it.price)}</Text></View>
                  <View style={styles.colDiscount}>
                    <Text style={styles.cellText}>{it.discount ? numFmt(it.discount) : '-'}</Text>
                    {it.discount ? <Text style={styles.cellSub}>({pct}%)</Text> : null}
                  </View>
                  <View style={styles.colTotal}><Text style={styles.cellTextBold}>{numFmt(it.lineTotal)}</Text></View>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.summarySplitRow} wrap={false}>
          <View style={styles.billingSummaryBox}>
            <Text style={styles.billingSummaryTitle}>Billing Summary</Text>
            {hasPricingBreakdown ? (
              <>
                <View style={styles.billingRow}>
                  <Text style={styles.billingLabel}>{hasItems ? 'Items Subtotal' : 'Amount'}</Text>
                  <CurrencyText value={hasItems ? revision.subtotal : revision.baseAmount} style={styles.billingValue} />
                </View>
                {hasItems && revision.discountTotal > 0 ? (
                  <View style={styles.billingRow}>
                    <Text style={styles.billingLabel}>Discount</Text>
                    <CurrencyText value={revision.discountTotal} style={styles.billingDiscountValue} negative />
                  </View>
                ) : null}
                {!hasItems && revision.pctDiscountAmount > 0 ? (
                  <View style={styles.billingRow}>
                    <Text style={styles.billingLabel}>Discount ({numFmt(revision.pctDiscount)}%)</Text>
                    <CurrencyText value={revision.pctDiscountAmount} style={styles.billingDiscountValue} negative />
                  </View>
                ) : null}
                {(revision.installationCost > 0 || revision.freightCost > 0) ? (
                  <View style={styles.billingRow}>
                    <Text style={styles.billingLabel}>Net Product Cost</Text>
                    <CurrencyText value={revision.netProductCost} style={styles.billingValue} />
                  </View>
                ) : null}
                {revision.installationCost > 0 ? (
                  <View style={styles.billingRow}>
                    <Text style={styles.billingLabel}>Installation ({numFmt(revision.installationRate)}%)</Text>
                    <CurrencyText value={revision.installationCost} style={styles.billingValue} />
                  </View>
                ) : null}
                {revision.freightCost > 0 ? (
                  <View style={styles.billingRow}>
                    <Text style={styles.billingLabel}>Freight</Text>
                    <CurrencyText value={revision.freightCost} style={styles.billingValue} />
                  </View>
                ) : null}
                {revision.gstAmount > 0 ? (
                  <>
                    <View style={styles.billingRow}>
                      <Text style={styles.billingLabel}>Subtotal (before GST)</Text>
                      <CurrencyText value={revision.preGstSubtotal} style={styles.billingValue} />
                    </View>
                    <View style={styles.billingRow}>
                      <Text style={styles.billingLabel}>GST ({numFmt(revision.gstRate)}%)</Text>
                      <CurrencyText value={revision.gstAmount} style={styles.billingValue} />
                    </View>
                  </>
                ) : null}
              </>
            ) : (
              hasItems && (
                <>
                  <View style={styles.billingRow}>
                    <Text style={styles.billingLabel}>Subtotal</Text>
                    <CurrencyText value={revision.subtotal} style={styles.billingValue} />
                  </View>
                  <View style={styles.billingRow}>
                    <Text style={styles.billingLabel}>Discount</Text>
                    <CurrencyText value={revision.discountTotal} style={styles.billingDiscountValue} negative />
                  </View>
                </>
              )
            )}
            <View style={styles.billingGrandRow}>
              <Text style={styles.billingGrandLabel}>Total Amount</Text>
              <CurrencyText value={revision?.amount} style={styles.billingGrandValue} bold />
            </View>
          </View>
          <View style={styles.wordsCol}>
            <Text style={styles.panelLabel}>Amount In Words</Text>
            <Text style={styles.wordsText}>{numberToWordsINR(revision?.amount)}</Text>
            {revision?.note ? (
              <>
                <Text style={[styles.panelLabel, { marginTop: 12 }]}>Note</Text>
                <Text style={styles.wordsText}>{safeText(revision.note)}</Text>
              </>
            ) : null}
          </View>
        </View>

        <View style={styles.twoColRow}>
          <View style={styles.twoCol}>
            <Text style={styles.sectionSubheading}>Terms &amp; Conditions</Text>
            {TERMS.map((t, i) => (
              <View style={styles.numberedRow} key={i}>
                <Text style={styles.numberedIndex}>{i + 1}.</Text>
                <Text style={styles.numberedText}>{t}</Text>
              </View>
            ))}
          </View>
          <View style={styles.twoCol}>
            <Text style={styles.sectionSubheading}>Notes</Text>
            {NOTES.map((t, i) => (
              <View style={styles.numberedRow} key={i}>
                <Text style={styles.numberedIndex}>{i + 1}.</Text>
                <Text style={styles.numberedText}>{t}</Text>
              </View>
            ))}
          </View>
        </View>

        <Footer brandName={brandName} />
      </Page>

      {/* ---------------- Page 3: Site Readiness Guide ---------------- */}
      <Page size="A4" style={styles.page}>
        <PageHeader logo={logo} brandName={brandName} quotationNo={quotationNo} />

        <View style={styles.readinessBanner}>
          {hero ? <Image src={hero} style={styles.readinessBannerImage} /> : null}
          <View style={styles.readinessBannerOverlay} />
          <View style={styles.readinessBannerContent}>
            <Text style={styles.readinessBannerTitle}>Getting your home ready{'\n'}for a smarter tomorrow</Text>
            <Text style={styles.readinessBannerSub}>A few important requirements to ensure smooth installation and best performance.</Text>
          </View>
        </View>

        <Text style={styles.readinessIntro}>Installation readiness is essential for system performance. Please coordinate these requirements with your electrician, networking agency and project team ahead of the visit.</Text>

        {SITE_READINESS_SECTIONS.map((section, si) => (
          <View style={styles.readinessSection} key={section.title} wrap={false}>
            <View style={styles.readinessSectionHeader}>
              <View style={styles.readinessSectionIcon}><Icon name={section.icon} size={12} color={WHITE} /></View>
              <Text style={styles.readinessSectionTitle}>{String(si + 1).padStart(2, '0')}   {section.title}</Text>
            </View>
            {section.items.map((it, ii) => (
              <View style={styles.readinessItemRow} key={ii}>
                <Text style={styles.readinessItemLabel}>{it.label}</Text>
                <Text style={styles.readinessItemText}>{it.text}</Text>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.calloutBox} wrap={false}>
          <View style={styles.calloutIconWrap}><Icon name="alert" size={13} color={ORANGE} /></View>
          <View style={{ flexDirection: 'column', flexShrink: 1 }}>
            <Text style={styles.calloutTitle}>Check Before Installation</Text>
            <Text style={styles.calloutText}>Electrical points, neutral wiring, curtain wiring, network coverage, CAT6 backhaul and 2.4 GHz compatibility — a well-prepared site means a faster, smoother, hassle-free installation.</Text>
          </View>
        </View>

        <Footer brandName={brandName} />
      </Page>
    </Document>
  );
}
