// app/quotation/[token]/page.jsx
// The public, no-login quotation page a customer opens from the "quotation link" sent alongside
// the PDF on WhatsApp (lib/heseosNotify.js's sendHeseosQuotationPdf). Token-gated, not
// session-gated — verifyQuotationShareToken (lib/quotationShare.js) recovers which lead/revision
// this link points to and proves it was actually issued by this server, so guessing/incrementing
// a URL can't show someone a different customer's quotation.
//
// This is a from-scratch HTML/CSS re-implementation of the same design lib/quotationPdf.jsx
// renders as a PDF — not shared code with it, and deliberately not a re-hosting of the PDF
// itself. A real browser can do things the PDF intentionally stayed conservative about (see the
// big comment at the top of quotationPdf.jsx): the actual free-form SVG wave cutout on the hero
// photo instead of a plain rounded corner, and a real cursive webfont for "A Smarter Way to
// Live" / "Thank you" instead of italic Helvetica. A "Download PDF" link is still offered below
// for anyone who wants the fixed, printable copy.
import { notFound } from 'next/navigation';
import { dbGetById, dbList } from '@/lib/db';
import { verifyQuotationShareToken } from '@/lib/quotationShare';

export const dynamic = 'force-dynamic';

function numFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

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

export default async function QuotationSharePage({ params }) {
  const { token } = await params;
  const parsed = verifyQuotationShareToken(token);
  if (!parsed) notFound();

  const lead = await dbGetById('leads', parsed.leadId);
  if (!lead) notFound();

  const revisions = Array.isArray(lead.quotationRevisions) ? lead.quotationRevisions : [];
  const revision = revisions.find((r) => Number(r.revision) === Number(parsed.revision));
  if (!revision) notFound();

  const products = await dbList('products').catch(() => []);
  const items = Array.isArray(revision.items) ? revision.items : [];
  const dateLabel = revision.at
    ? new Date(revision.at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';
  const quotationNo = `${lead.id}-v${revision.revision || 1}`;

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Caveat:wght@500;600;700&display=swap"
        rel="stylesheet"
      />
      <style>{`
        .qshare-root{ background:#f3f1ec; min-height:100vh; padding:28px 14px 60px; font-family:'Manrope',ui-sans-serif,system-ui,-apple-system,sans-serif; color:#0b1b2e; }
        .qshare-root *{ box-sizing:border-box; }
        .qshare-sheet{ width:100%; max-width:900px; margin:0 auto; }
        .qshare-page{ position:relative; width:100%; background:#fff; border-radius:14px; overflow:hidden;
          box-shadow:0 20px 50px rgba(11,27,46,0.14), 0 2px 8px rgba(11,27,46,0.06); padding:40px; }
        .qshare-letterhead{ display:flex; align-items:flex-start; justify-content:space-between; flex-wrap:wrap; gap:12px; }
        .qshare-logo{ height:30px; display:block; }
        .qshare-logo-sub{ font-size:8px; font-weight:700; letter-spacing:3px; color:#8a97a6; margin:6px 0 0 2px; text-transform:uppercase; }
        .qshare-tagline{ text-align:right; }
        .qshare-tagline div{ font-size:10px; font-weight:700; letter-spacing:1.6px; color:#5c6b7c; line-height:1.6; text-transform:uppercase; }

        .qshare-hero-row{ display:flex; align-items:stretch; gap:26px; margin-top:20px; flex-wrap:wrap; }
        .qshare-hero-left{ flex:1.2 1 260px; display:flex; flex-direction:column; justify-content:center; }
        .qshare-hero-right{ flex:1 1 240px; min-width:220px; }
        .qshare-quote-tag{ display:flex; align-items:center; gap:8px; margin-bottom:12px; }
        .qshare-quote-tag .dash{ width:20px; height:2.5px; background:#ff7a00; border-radius:2px; }
        .qshare-quote-tag span{ font-size:10px; font-weight:700; letter-spacing:3px; color:#5c6b7c; text-transform:uppercase; }
        .qshare-headline{ font-size:clamp(24px,4vw,34px); line-height:1.14; font-weight:800; margin:0 0 14px; letter-spacing:-0.4px; }
        .qshare-headline .black{ color:#0b1b2e; display:block; }
        .qshare-headline .orange{ color:#ff7a00; display:block; }
        .qshare-intro{ font-size:12.5px; color:#5c6b7c; line-height:1.65; max-width:420px; }
        .qshare-hero-image{ position:relative; height:100%; min-height:220px; clip-path:url(#qshareHeroWave);
          overflow:hidden; background:#f7f5f1; }
        .qshare-hero-image img{ width:100%; height:100%; object-fit:cover; display:block; }
        .qshare-hero-image::after{ content:''; position:absolute; left:0; right:0; bottom:0; height:58%;
          background:linear-gradient(to top, rgba(9,18,32,0.55), rgba(9,18,32,0)); }
        .qshare-hero-caption{ position:absolute; right:18px; bottom:16px; z-index:2; font-family:'Caveat',cursive;
          font-weight:600; font-size:26px; line-height:1.08; color:#fff; text-align:right; text-shadow:0 2px 10px rgba(0,0,0,0.35); }

        .qshare-panel-row{ display:flex; gap:14px; margin-top:32px; flex-wrap:wrap; }
        .qshare-panel{ flex:1 1 220px; border:1px solid #ece9e4; border-radius:14px; padding:18px; }
        .qshare-panel.peach{ background:#fff1e6; border-color:#ffd9b8; }
        .qshare-panel-label{ font-size:9px; font-weight:700; letter-spacing:1.4px; text-transform:uppercase; color:#8a97a6; margin-bottom:10px; }
        .qshare-prepared-for{ display:flex; align-items:center; gap:10px; margin-bottom:9px; }
        .qshare-avatar{ width:32px; height:32px; border-radius:50%; background:#fff1e6; display:flex; align-items:center; justify-content:center; flex:none; }
        .qshare-avatar svg{ width:16px; height:16px; }
        .qshare-customer-name{ font-size:14px; font-weight:700; }
        .qshare-customer-line{ font-size:11.5px; color:#5c6b7c; margin-top:3px; }
        .qshare-meta-head{ display:flex; align-items:center; margin-bottom:12px; }
        .qshare-meta-icon{ width:26px; height:26px; border-radius:8px; background:#f7f5f1; border:1px solid #ece9e4; display:flex; align-items:center; justify-content:center; }
        .qshare-meta-icon svg{ width:14px; height:14px; }
        .qshare-meta-item + .qshare-meta-item{ margin-top:11px; }
        .qshare-meta-label{ font-size:9px; font-weight:700; letter-spacing:0.8px; text-transform:uppercase; color:#8a97a6; }
        .qshare-meta-value{ font-size:12.5px; font-weight:700; margin-top:3px; }
        .qshare-house-icon{ margin-bottom:10px; }
        .qshare-house-icon svg{ width:22px; height:22px; }
        .qshare-peach-text{ font-size:13.5px; font-weight:700; line-height:1.4; color:#0b1b2e; }
        .qshare-peach-dash{ width:24px; height:2.5px; background:#ff7a00; border-radius:2px; margin-top:10px; }

        .qshare-table-wrap{ margin-top:32px; overflow-x:auto; }
        .qshare-scroll-hint{ display:none; font-size:9.5px; color:#8a97a6; text-align:right; margin-top:6px; }
        table.qshare-items{ width:100%; min-width:560px; border-collapse:collapse; font-size:12px; }
        table.qshare-items thead th{ text-align:left; font-size:9px; font-weight:700; letter-spacing:0.8px; text-transform:uppercase;
          color:#8a97a6; background:#f5f1ea; padding:10px; border-bottom:1px solid #ece9e4; white-space:nowrap; }
        table.qshare-items thead th.num{ text-align:right; }
        table.qshare-items tbody td{ padding:14px 10px; border-bottom:1px solid #ece9e4; vertical-align:middle; }
        table.qshare-items tbody tr:last-child td{ border-bottom:none; }
        table.qshare-items tbody td.num{ text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
        .qshare-prod-cell{ display:flex; align-items:center; gap:10px; }
        .qshare-prod-thumb{ width:34px; height:34px; border-radius:8px; background:#f7f5f1; border:1px solid #ece9e4; flex:none;
          display:flex; align-items:center; justify-content:center; overflow:hidden; }
        .qshare-prod-thumb img{ width:100%; height:100%; object-fit:cover; }
        .qshare-prod-name{ font-weight:700; font-size:12px; }
        .qshare-prod-sku{ font-size:9.5px; color:#8a97a6; margin-top:2px; }
        .qshare-prod-desc{ color:#5c6b7c; font-size:10.5px; line-height:1.5; max-width:220px; }

        .qshare-totals{ margin-top:22px; display:flex; justify-content:flex-end; }
        .qshare-totals-box{ width:100%; max-width:260px; }
        .qshare-totals-row{ display:flex; justify-content:space-between; padding:5px 4px; font-size:12.5px; }
        .qshare-totals-row .label{ color:#5c6b7c; }
        .qshare-totals-row .value.green{ color:#178a4c; }
        .qshare-grand-row{ display:flex; justify-content:space-between; align-items:center; background:#fff1e6; border-radius:10px; padding:12px 14px; margin-top:8px; }
        .qshare-grand-row .label{ font-size:13.5px; font-weight:700; }
        .qshare-grand-row .value{ font-size:17px; font-weight:700; color:#ff7a00; }

        .qshare-feature-row{ display:flex; margin-top:28px; margin-bottom:4px; flex-wrap:wrap; gap:14px 0; }
        .qshare-feature-col{ flex:1 1 25%; min-width:80px; display:flex; flex-direction:column; align-items:center; gap:8px; }
        .qshare-feature-badge{ width:32px; height:32px; border-radius:50%; background:#fff1e6; border:1px solid #ffd9b8;
          display:flex; align-items:center; justify-content:center; }
        .qshare-feature-badge svg{ width:15px; height:15px; }
        .qshare-feature-label{ font-size:8.5px; font-weight:700; letter-spacing:0.3px; text-transform:uppercase; text-align:center; }

        .qshare-note{ font-size:11.5px; color:#5c6b7c; margin-top:20px; line-height:1.6; background:#f7f5f1; border-radius:10px; padding:12px 14px; }

        .qshare-footer{ margin-top:32px; padding-top:16px; border-top:1px solid #ece9e4; display:flex; justify-content:space-between;
          align-items:flex-end; flex-wrap:wrap; gap:10px; }
        .qshare-footer-brand{ font-size:13px; font-weight:700; }
        .qshare-footer-tagline{ font-size:10px; color:#8a97a6; margin-top:2px; }
        .qshare-footer-thanks{ text-align:right; }
        .qshare-footer-thanks .script{ font-family:'Caveat',cursive; font-weight:600; font-size:22px; color:#ff7a00; display:block; }
        .qshare-footer-thanks .dash{ width:28px; height:2px; background:#ff7a00; border-radius:2px; margin:2px 0 0 auto; }
        .qshare-footer-validity{ font-size:9px; color:#8a97a6; text-align:center; margin-top:14px; }

        .qshare-download{ display:block; text-align:center; margin-top:18px; }
        .qshare-download a{ display:inline-flex; align-items:center; gap:8px; background:#0b1b2e; color:#fff; text-decoration:none;
          font-size:13px; font-weight:700; padding:11px 22px; border-radius:999px; }
        .qshare-download a:hover{ background:#16304d; }

        @media (max-width: 620px){
          .qshare-page{ padding:24px 18px; border-radius:10px; }
          .qshare-hero-row{ gap:18px; }
          .qshare-hero-left{ order:2; flex-basis:100%; }
          .qshare-hero-right{ order:1; flex-basis:100%; min-height:200px; }
          .qshare-hero-image{ min-height:200px; }
          .qshare-panel-row{ gap:10px; }
          .qshare-panel{ flex-basis:100%; }
          .qshare-feature-col{ flex-basis:40%; }
          .qshare-scroll-hint{ display:block; }
        }
      `}</style>

      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <clipPath id="qshareHeroWave" clipPathUnits="objectBoundingBox">
            <path d="M0,0 L1,0 L1,1 L0.5,1 C0.24,1 0.08,0.86 0,0.56 L0,0 Z" />
          </clipPath>
        </defs>
      </svg>

      <div className="qshare-root">
        <div className="qshare-sheet">
          <div className="qshare-page">
            <div className="qshare-letterhead">
              <div>
                <img className="qshare-logo" src="/brand/lockup-navy.png" alt="HESEOS" />
                <div className="qshare-logo-sub">Lighting Ahead</div>
              </div>
              <div className="qshare-tagline">
                <div>Smart Homes.</div>
                <div>Stronger People.</div>
                <div>Brighter Tomorrow.</div>
              </div>
            </div>

            <div className="qshare-hero-row">
              <div className="qshare-hero-left">
                <div className="qshare-quote-tag"><span className="dash" /><span>Quotation</span></div>
                <h1 className="qshare-headline">
                  <span className="black">Smart Solutions</span>
                  <span className="orange">for a Smarter You</span>
                </h1>
                <p className="qshare-intro">
                  Thank you for considering HESEOS for your smart home journey. We are pleased to share the quotation as per your requirement.
                </p>
              </div>
              <div className="qshare-hero-right">
                <div className="qshare-hero-image">
                  <img src="/brand/quotation-hero.jpg" alt="A HESEOS smart home" />
                  <div className="qshare-hero-caption">A Smarter<br />Way to Live</div>
                </div>
              </div>
            </div>

            <div className="qshare-panel-row">
              <div className="qshare-panel">
                <div className="qshare-panel-label">Prepared For</div>
                <div className="qshare-prepared-for">
                  <div className="qshare-avatar">
                    <svg viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="8.5" r="3.6" fill="#ff7a00" />
                      <path d="M4.5 20c0-4.1 3.4-6.6 7.5-6.6s7.5 2.5 7.5 6.6" stroke="#ff7a00" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="qshare-customer-name">{lead.name || 'Customer'}</div>
                </div>
                {lead.phone ? <div className="qshare-customer-line">{lead.phone}</div> : null}
                {lead.city ? <div className="qshare-customer-line">{lead.city}</div> : null}
              </div>

              <div className="qshare-panel">
                <div className="qshare-meta-head">
                  <div className="qshare-meta-icon">
                    <svg viewBox="0 0 24 24" fill="none">
                      <rect x="5" y="2.5" width="14" height="19" rx="2" stroke="#ff7a00" strokeWidth="1.5" />
                      <path d="M8 8h8M8 12h8M8 16h5" stroke="#ff7a00" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>
                <div className="qshare-meta-item">
                  <div className="qshare-meta-label">Quotation No.</div>
                  <div className="qshare-meta-value">{quotationNo}</div>
                </div>
                <div className="qshare-meta-item">
                  <div className="qshare-meta-label">Date</div>
                  <div className="qshare-meta-value">{dateLabel || '-'}</div>
                </div>
              </div>

              <div className="qshare-panel peach">
                <div className="qshare-house-icon">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M4 11.5L12 4l8 7.5" stroke="#ff7a00" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M6 10.5V20h12v-9.5" stroke="#ff7a00" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M10 20v-5.5h4V20" stroke="#ff7a00" strokeWidth="1.8" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="qshare-peach-text">Smarter Homes,<br />Happier Lives</div>
                <div className="qshare-peach-dash" />
              </div>
            </div>

            {items.length > 0 && (
              <div className="qshare-table-wrap">
                <table className="qshare-items">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Product</th>
                      <th>Description</th>
                      <th className="num">Qty</th>
                      <th className="num">Price (₹)</th>
                      <th className="num">Discount (₹)</th>
                      <th className="num">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, i) => {
                      const product = findProduct(it, products);
                      const photo = product?.photos?.[0]?.dataUrl;
                      const description = product?.description || '';
                      return (
                        <tr key={i}>
                          <td>{String(i + 1).padStart(2, '0')}</td>
                          <td>
                            <div className="qshare-prod-cell">
                              <div className="qshare-prod-thumb">
                                {photo ? <img src={photo} alt="" /> : null}
                              </div>
                              <div>
                                <div className="qshare-prod-name">{it.name}</div>
                                {it.sku ? <div className="qshare-prod-sku">{it.sku}</div> : null}
                              </div>
                            </div>
                          </td>
                          <td className="qshare-prod-desc">{description}</td>
                          <td className="num">{it.qty}</td>
                          <td className="num">{numFmt(it.price)}</td>
                          <td className="num">{it.discount ? numFmt(it.discount) : '-'}</td>
                          <td className="num">{numFmt(it.lineTotal)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="qshare-scroll-hint">← scroll for prices →</div>
              </div>
            )}

            <div className="qshare-totals">
              <div className="qshare-totals-box">
                {items.length > 0 && (
                  <>
                    <div className="qshare-totals-row"><span className="label">Subtotal</span><span className="value">₹ {numFmt(revision.subtotal)}</span></div>
                    <div className="qshare-totals-row"><span className="label">Discount</span><span className="value green">-₹ {numFmt(revision.discountTotal)}</span></div>
                  </>
                )}
                <div className="qshare-grand-row"><span className="label">Total</span><span className="value">₹ {numFmt(revision.amount)}</span></div>
              </div>
            </div>

            <div className="qshare-feature-row">
              <div className="qshare-feature-col">
                <div className="qshare-feature-badge">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M9 18h6M9.5 21h5" stroke="#ff7a00" strokeWidth="1.6" strokeLinecap="round" /><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.45.9 1.15.9 1.9V16h5.4v-.3c0-.75.3-1.45.9-1.9A6 6 0 0 0 12 3z" stroke="#ff7a00" strokeWidth="1.6" strokeLinejoin="round" /></svg>
                </div>
                <div className="qshare-feature-label">Smarter Living</div>
              </div>
              <div className="qshare-feature-col">
                <div className="qshare-feature-badge">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M12 3l7 3v5.5c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6l7-3z" stroke="#ff7a00" strokeWidth="1.6" strokeLinejoin="round" /><path d="M9 12.2l2 2 4-4.4" stroke="#ff7a00" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <div className="qshare-feature-label">Safer Homes</div>
              </div>
              <div className="qshare-feature-col">
                <div className="qshare-feature-badge">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M13 2L4.5 14h5.7L11 22l8.5-13h-5.7L13 2z" fill="#ff7a00" /></svg>
                </div>
                <div className="qshare-feature-label">Energy Efficient</div>
              </div>
              <div className="qshare-feature-col">
                <div className="qshare-feature-badge">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M4 12h13.5M13 6.5L19 12l-6 5.5" stroke="#ff7a00" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <div className="qshare-feature-label">Future Ready</div>
              </div>
            </div>

            {revision.note ? <div className="qshare-note">Note: {revision.note}</div> : null}

            <div className="qshare-footer">
              <div>
                <div className="qshare-footer-brand">HESEOS</div>
                <div className="qshare-footer-tagline">Smart Home Automation</div>
              </div>
              <div className="qshare-footer-thanks">
                <span className="script">Thank you</span>
                <div className="dash" />
              </div>
            </div>
            <div className="qshare-footer-validity">This quotation is valid for 15 days from the date above. For any queries, feel free to contact us.</div>
          </div>

          <div className="qshare-download">
            <a href={`/api/quotation/${token}/pdf`}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              Download PDF
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
