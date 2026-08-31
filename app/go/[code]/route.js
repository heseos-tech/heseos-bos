// The unified QR-code / referral-link entry point — every printed QR (partner or billboard/
// location) and every shared referral link (partner or customer) points at
// https://<domain>/go/<code>. See lib/attribution.js for what a code is and how it's created,
// and app/api/bot/webhook/route.js's bridgeToHeseosLeads for the other half (turning the
// resulting WhatsApp chat into an attributed lead).
//
// This route: look up the code → log a scan/click → redirect into WhatsApp, pre-filled with a
// message tagging the code so the webhook can attribute it. It never creates a lead itself —
// scanning a QR code isn't a lead, only the WhatsApp conversation that follows is.
//
// This is Heseos's own QR/referral system — always routes into the multi-tenant Bot Console via
// Heseos's own tenant. (The legacy single-number shop-QR entry point, app/wa/[ref], has since
// been retired — see app/get-started/route.js for the plain, untracked WhatsApp hand-off that
// replaced it for ordinary site CTAs.)

import { dbGetById } from '@/lib/db';
import { getHeseosBotTenant, buildWaLink, recordVisit } from '@/lib/attribution';

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

export async function GET(request, { params }) {
  const { code: rawCode } = await params;
  const code = String(rawCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 24);
  if (!code) return textPage(404, "This link isn't valid. Please check the QR code or link and try again.");

  const link = await dbGetById('attribution_links', code);
  if (!link || link.active === false) {
    return textPage(404, "This link isn't active anymore. Please contact Heseos for an updated link.");
  }

  const tenant = await getHeseosBotTenant();
  const waUrl = tenant ? buildWaLink(tenant, code) : null;
  if (!waUrl) {
    return textPage(503, "This link isn't fully set up yet — Heseos's WhatsApp number hasn't been connected. Please try again shortly or contact Heseos directly.");
  }

  // Fire-and-forget — never let a logging hiccup block the redirect.
  recordVisit(code, link.kind).catch((err) => console.error('Attribution visit log error:', err));

  return Response.redirect(waUrl, 302);
}
