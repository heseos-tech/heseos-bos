// lib/quotationPdf.jsx
// Renders one quotation revision as a PDF — pure-JS via @react-pdf/renderer (no headless
// browser needed, so it works fine in a serverless function). Used by
// app/api/leads/[id]/quotation-pdf/route.js for both the in-app "Download PDF" button and the
// file WhatsApp sends (lib/heseosNotify.js's sendHeseosQuotationPdf).
//
// This template was redesigned to match a branded reference layout (letterhead header + hero
// photo, two-tone heading, a three-panel "Prepared For / Quotation No. / tagline" info row, a
// product table with per-row photos, a four-badge feature strip, and a highlighted totals box).
// A few details from that reference were DELIBERATELY simplified for reliability, because this
// exact pipeline has already broken production twice this project (a font-encoding crash, and a
// pdfkit/Vercel bundling failure) from assumptions that looked safe but weren't verified:
//   - Rupee sign: still spelled "Rs." (see the long-standing note below) rather than a genuine
//     ₹ glyph — the built-in Helvetica font doesn't reliably carry ₹, and fixing that for real
//     needs either a bundled font file (none exists in this repo) or a Font.register() call to
//     a remote font at render time, which reintroduces a network dependency into a code path
//     that has already taken production down once before.
//   - Hero photo: a rounded-corner rectangle instead of an exact wave-shaped cutout — react-pdf
//     doesn't give us a reliable free-form clip path, but overflow:hidden + borderRadius on the
//     wrapping View is a well-documented, low-risk way to round an image's corners.
//   - Script-style accents ("A Smarter Way to Live", the "Thank you" sign-off): italic Helvetica
//     instead of a true cursive font — no script font file exists anywhere in this repo, and
//     there's no network access available to fetch one from wherever this is edited.
//   - Icon badges (the four feature icons, the small panel accents): plain geometric shapes
//     (circles, rects, and a CSS-style border-triangle) built only from View/StyleSheet — the
//     same primitives already proven safe in this file — rather than illustrated icons, since
//     there's no way to test-render an <Svg> path in this pipeline before it ships to
//     production.
//
// NOTE ON THE RUPEE SIGN: @react-pdf/renderer's built-in Helvetica font doesn't reliably carry
// the ₹ glyph (it can render as a blank box), so this template spells it "Rs." instead — the
// UI everywhere else keeps using ₹, this file is the one deliberate exception.
//
// NOTE ON VERIFICATION: nothing in this pipeline can be live-rendered from wherever this file is
// edited (no network access to install @react-pdf/renderer there, and no way to preview a PDF),
// so every style property used below is one already proven either elsewhere in this exact file
// or by long-standing, well-documented @react-pdf/renderer behavior — nothing exotic (no
// transforms, no gradients, no <Svg> paths) was introduced for this redesign.
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
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

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, color: INK, fontFamily: 'Helvetica' },

  // Letterhead
  letterhead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  logo: { width: 108 },
  taglineCol: { alignItems: 'flex-end' },
  taglineLine: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: SOFT, letterSpacing: 1, textTransform: 'uppercase' },

  // Hero photo
  heroWrap: { width: '100%', height: 140, borderRadius: 18, overflow: 'hidden', position: 'relative', marginBottom: 18, backgroundColor: CARD_BG },
  heroImage: { width: '100%', height: '100%' },
  heroOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 60, backgroundColor: 'rgba(11,27,46,0.42)' },
  heroCaption: { position: 'absolute', left: 18, bottom: 16, fontSize: 17, fontFamily: 'Helvetica-Oblique', color: '#ffffff', letterSpacing: 0.5 },

  // Two-tone heading + intro
  heading: { fontSize: 18, marginBottom: 6 },
  headingBlack: { fontFamily: 'Helvetica-Bold', color: INK },
  headingOrange: { fontFamily: 'Helvetica-Bold', color: ORANGE },
  intro: { fontSize: 9.5, color: SOFT, lineHeight: 1.5, marginBottom: 16 },

  // Three-panel info row
  panelRow: { flexDirection: 'row', marginBottom: 18 },
  panel: { flexGrow: 1, flexBasis: 0, borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 10, marginRight: 10 },
  panelLast: { flexGrow: 1, flexBasis: 0, borderRadius: 10, padding: 10, backgroundColor: PEACH, borderWidth: 1, borderColor: PEACH_BORDER },
  panelLabel: { fontSize: 7.5, color: FAINT, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },

  avatarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  avatarCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: PEACH, borderWidth: 1, borderColor: PEACH_BORDER, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  avatarInitial: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: ORANGE },
  customerName: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  customerLine: { fontSize: 9, color: SOFT, marginTop: 2 },

  quoteMetaRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  quoteMetaIcon: { width: 16, height: 16, borderRadius: 3, backgroundColor: '#eef1f5', borderWidth: 1, borderColor: BORDER, marginRight: 6 },
  quoteMetaIconBar: { height: 4, backgroundColor: ORANGE, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  quoteMetaLabel: { fontSize: 7.5, color: FAINT, textTransform: 'uppercase', letterSpacing: 0.5 },
  quoteMetaValue: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: INK, marginTop: 1 },

  taglinePanelText: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', color: INK, lineHeight: 1.4 },
  houseIconWrap: { alignItems: 'center', justifyContent: 'flex-end', height: 20, marginBottom: 8 },
  houseRoof: { width: 0, height: 0, borderLeftWidth: 9, borderRightWidth: 9, borderBottomWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: ORANGE },
  houseBase: { width: 14, height: 8, backgroundColor: ORANGE },

  // Product table
  table: { borderTopWidth: 1, borderTopColor: BORDER, marginTop: 4 },
  tHeadRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER, paddingVertical: 6, backgroundColor: CARD_BG },
  tRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER, paddingVertical: 8, alignItems: 'center' },
  colImage: { flexGrow: 0, flexBasis: 40, paddingHorizontal: 6 },
  colItem: { flexGrow: 3, flexBasis: 0, paddingHorizontal: 6 },
  colQty: { flexGrow: 0.7, flexBasis: 0, paddingHorizontal: 6, textAlign: 'right' },
  colPrice: { flexGrow: 1.1, flexBasis: 0, paddingHorizontal: 6, textAlign: 'right' },
  colDiscount: { flexGrow: 1.1, flexBasis: 0, paddingHorizontal: 6, textAlign: 'right' },
  colTotal: { flexGrow: 1.2, flexBasis: 0, paddingHorizontal: 6, textAlign: 'right' },
  thText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: FAINT, textTransform: 'uppercase' },
  itemThumbWrap: { width: 30, height: 30, borderRadius: 5, overflow: 'hidden', backgroundColor: CARD_BG, borderWidth: 1, borderColor: BORDER },
  itemThumb: { width: '100%', height: '100%' },
  itemName: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  itemSku: { fontSize: 8, color: FAINT, marginTop: 1 },
  itemDesc: { fontSize: 8, color: SOFT, marginTop: 2 },

  // Feature strip
  featureRow: { flexDirection: 'row', marginTop: 18, marginBottom: 6 },
  featureCol: { flexGrow: 1, flexBasis: 0, alignItems: 'center' },
  featureBadge: { width: 30, height: 30, borderRadius: 15, backgroundColor: PEACH, borderWidth: 1, borderColor: PEACH_BORDER, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  featureLabel: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: INK, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.3 },

  // Feature badge marks (built from plain shapes only)
  markDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ORANGE },
  markSquareOutline: { width: 11, height: 11, borderWidth: 1.5, borderColor: ORANGE },
  markTriangle: { width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderBottomWidth: 9, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: ORANGE },
  markBars: { flexDirection: 'row', alignItems: 'flex-end' },
  markBarSm: { width: 4, height: 6, backgroundColor: ORANGE, marginRight: 2 },
  markBarMd: { width: 4, height: 10, backgroundColor: ORANGE },

  // Totals
  totalsBox: { marginTop: 12, alignSelf: 'flex-end', width: 230 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalsLabel: { fontSize: 9.5, color: SOFT },
  totalsValue: { fontSize: 9.5, color: INK },
  totalsDiscountValue: { fontSize: 9.5, color: GREEN, fontFamily: 'Helvetica-Bold' },
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

function money(n) {
  return `Rs. ${Number(n || 0).toLocaleString('en-IN')}`;
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
// same instead of just vanishing), then strips anything else outside the printable WinAnsi range
// — this is the general form of the same fix already applied to the rupee sign below.
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

function FeatureBadgeMark({ shape }) {
  if (shape === 'square') return <View style={styles.markSquareOutline} />;
  if (shape === 'triangle') return <View style={styles.markTriangle} />;
  if (shape === 'bars') {
    return (
      <View style={styles.markBars}>
        <View style={styles.markBarSm} />
        <View style={styles.markBarMd} />
      </View>
    );
  }
  return <View style={styles.markDot} />;
}

const FEATURES = [
  { label: 'Smarter Living', shape: 'dot' },
  { label: 'Safer Homes', shape: 'square' },
  { label: 'Energy Efficient', shape: 'triangle' },
  { label: 'Future Ready', shape: 'bars' },
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
  const customerInitial = safeText(lead?.name).trim().charAt(0).toUpperCase() || '?';

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

        {hero && (
          <View style={styles.heroWrap}>
            <Image src={hero} style={styles.heroImage} />
            <View style={styles.heroOverlay} />
            <Text style={styles.heroCaption}>A Smarter Way to Live</Text>
          </View>
        )}

        <Text style={styles.heading}>
          <Text style={styles.headingBlack}>Smart Solutions </Text>
          <Text style={styles.headingOrange}>for a Smarter You</Text>
        </Text>
        <Text style={styles.intro}>
          Thank you for considering {safeText(brandName)}. Here is a tailored smart-home quotation, put together
          around your space and the products you asked about.
        </Text>

        <View style={styles.panelRow}>
          <View style={styles.panel}>
            <Text style={styles.panelLabel}>Prepared For</Text>
            <View style={styles.avatarRow}>
              <View style={styles.avatarCircle}><Text style={styles.avatarInitial}>{customerInitial}</Text></View>
              <Text style={styles.customerName}>{safeText(lead.name)}</Text>
            </View>
            <Text style={styles.customerLine}>{safeText(lead.phone)}</Text>
            {lead.city ? <Text style={styles.customerLine}>{safeText(lead.city)}</Text> : null}
          </View>

          <View style={styles.panel}>
            <View style={styles.quoteMetaIcon}><View style={styles.quoteMetaIconBar} /></View>
            <View style={styles.quoteMetaRow}>
              <View>
                <Text style={styles.quoteMetaLabel}>Quotation No.</Text>
                <Text style={styles.quoteMetaValue}>{lead.id}-v{revision?.revision || 1}</Text>
              </View>
            </View>
            <View style={styles.quoteMetaRow}>
              <View>
                <Text style={styles.quoteMetaLabel}>Date</Text>
                <Text style={styles.quoteMetaValue}>{dateLabel || '-'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.panelLast}>
            <View style={styles.houseIconWrap}>
              <View style={styles.houseRoof} />
              <View style={styles.houseBase} />
            </View>
            <Text style={styles.taglinePanelText}>Smarter Homes, Happier Lives</Text>
          </View>
        </View>

        {hasItems && (
          <View style={styles.table}>
            <View style={styles.tHeadRow}>
              <View style={styles.colImage} />
              <View style={styles.colItem}><Text style={styles.thText}>Item</Text></View>
              <View style={styles.colQty}><Text style={styles.thText}>Qty</Text></View>
              <View style={styles.colPrice}><Text style={styles.thText}>Price</Text></View>
              <View style={styles.colDiscount}><Text style={styles.thText}>Discount</Text></View>
              <View style={styles.colTotal}><Text style={styles.thText}>Total</Text></View>
            </View>
            {items.map((it, i) => {
              const product = findProduct(it, products);
              const photo = productPhotoDataUri(product);
              const description = product?.description ? safeText(product.description) : '';
              return (
                <View style={styles.tRow} key={i}>
                  <View style={styles.colImage}>
                    <View style={styles.itemThumbWrap}>
                      {photo ? <Image src={photo} style={styles.itemThumb} /> : null}
                    </View>
                  </View>
                  <View style={styles.colItem}>
                    <Text style={styles.itemName}>{safeText(it.name)}</Text>
                    {it.sku ? <Text style={styles.itemSku}>{safeText(it.sku)}</Text> : null}
                    {description ? <Text style={styles.itemDesc}>{description}</Text> : null}
                  </View>
                  <View style={styles.colQty}><Text>{it.qty}</Text></View>
                  <View style={styles.colPrice}><Text>{money(it.price)}</Text></View>
                  <View style={styles.colDiscount}><Text>{it.discount ? money(it.discount) : '-'}</Text></View>
                  <View style={styles.colTotal}><Text>{money(it.lineTotal)}</Text></View>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.featureRow}>
          {FEATURES.map((f) => (
            <View style={styles.featureCol} key={f.label}>
              <View style={styles.featureBadge}><FeatureBadgeMark shape={f.shape} /></View>
              <Text style={styles.featureLabel}>{f.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBox}>
          {hasItems && (
            <>
              <View style={styles.totalsRow}><Text style={styles.totalsLabel}>Subtotal</Text><Text style={styles.totalsValue}>{money(revision.subtotal)}</Text></View>
              <View style={styles.totalsRow}><Text style={styles.totalsLabel}>Discount</Text><Text style={styles.totalsDiscountValue}>-{money(revision.discountTotal)}</Text></View>
            </>
          )}
          <View style={styles.grandRow}><Text style={styles.grandLabel}>Total</Text><Text style={styles.grandValue}>{money(revision?.amount)}</Text></View>
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
          <Text style={styles.footerValidity}>This quotation is valid for 15 days from the date above.</Text>
        </View>
      </Page>
    </Document>
  );
}
