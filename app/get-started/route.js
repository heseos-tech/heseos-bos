// Every "Get Started" / "Request Demo" / "Book a Demo" / "Contact Us" CTA across the marketing
// site (Navbar, Hero, Footer, PoweringCTA, /become-a-partner) points here now, instead of
// scrolling to an on-page enquiry form — the embedded form (components/EnquirySection.jsx) was
// retired in favour of every channel converging on WhatsApp, same as the QR/referral system.
//
// Plain, untracked hand-off — no ref tag (that's only for QR codes / referral links, see
// lib/attribution.js and app/go/[code]). The resulting chat lands as an ordinary 'whatsapp_bot'
// source lead once lib/heseosLeadSync.js's createHeseosLead/finalizeHeseosLead picks it up.

import { getHeseosBotTenant } from '@/lib/attribution';

export const dynamic = 'force-dynamic';

function textPage(status, message) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>Heseos</title><style>body{font-family:-apple-system,system-ui,sans-serif;background:#0B1220;color:#fff;` +
    `display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center}` +
    `p{max-width:360px;line-height:1.5;color:#B9C2D0;font-size:15px}</style></head>` +
    `<body><p>${message}</p></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

export async function GET() {
  const tenant = await getHeseosBotTenant();
  const number = String(tenant?.whatsappNumber || '').replace(/[^0-9]/g, '');
  if (!number) {
    return textPage(503, "WhatsApp isn't connected yet — please contact Heseos directly.");
  }
  const text = "Hi Heseos! I'm interested in smart home automation.";
  return Response.redirect(`https://wa.me/${number}?text=${encodeURIComponent(text)}`, 302);
}
