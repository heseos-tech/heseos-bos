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
  outputFileTracingIncludes: {
    '/api/leads/[id]/quotation-pdf': ['./node_modules/pdfkit/js/**/*'],
    '/api/leads/[id]/quotation-pdf/send': ['./node_modules/pdfkit/js/**/*'],
    '/api/leads/**': ['./node_modules/pdfkit/js/**/*'],
  },
};

export default nextConfig;
