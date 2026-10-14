/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  // pdfkit (a dependency of @react-pdf/renderer, used by lib/quotationPdf.jsx to render
  // quotation PDFs for both the "Download PDF" route and the WhatsApp-send route) loads its
  // built-in standard fonts (Helvetica etc.) from data files inside its own package directory
  // at runtime, via a path Next's build-time file tracer can't follow statically. That left
  // Vercel's deployed serverless bundle for these routes missing
  // node_modules/pdfkit/js/standard-fonts entirely, so every PDF render failed in production
  // with "Cannot find module '.../pdfkit/js/standard-fonts/Helvetica.cjs'" (confirmed in the
  // Vercel function logs for both routes) even though everything worked in local dev, where the
  // full node_modules tree is just on disk. Explicitly including pdfkit's files for the routes
  // that render a PDF fixes this — the same fix commonly needed for `sharp` and other packages
  // that load files dynamically rather than via a statically-analyzable import. Listed a few
  // different ways (the exact route, its /send sibling, and a broader /api/leads/** catch-all)
  // since it's cheap insurance against getting Next's glob-matching syntax slightly wrong for
  // any one of them — a few extra harmless KB of font files bundled into nearby functions either
  // way, versus a repeat of this exact production outage if a pattern silently doesn't match.
  // The public, share-token quotation PDF route (/api/quotation/[token]/pdf — the link sent to
  // customers over WhatsApp) renders the exact same file and was missing from this list; added
  // it and a matching /api/quotation/** catch-all for the same reason as the /api/leads/** one.
  // The HESEOS Smart Door Lock landing page (public/door-lock/index.html) is a static file served at
  // a short, shareable URL — this is the link HESEOS Buddy sends on WhatsApp (lib/heseosDoorLock.js).
  // Query params (?p=<phone> prefill) pass straight through to the page's own script.
  async rewrites() {
    return [
      { source: '/lock', destination: '/door-lock/index.html' },
      // The smart-home enquiry landing page (public/smart-home/index.html) — share this link; add
      // ?ref=<attribution code> to credit a partner, ?p=<mobile> to pre-fill the number.
      { source: '/smart-home', destination: '/smart-home/index.html' },
    ];
  },
  outputFileTracingIncludes: {
    '/api/leads/[id]/quotation-pdf': ['./node_modules/pdfkit/js/**/*'],
    '/api/leads/[id]/quotation-pdf/send': ['./node_modules/pdfkit/js/**/*'],
    '/api/leads/**': ['./node_modules/pdfkit/js/**/*'],
    '/api/quotation/[token]/pdf': ['./node_modules/pdfkit/js/**/*'],
    '/api/quotation/**': ['./node_modules/pdfkit/js/**/*'],
  },
};

export default nextConfig;
