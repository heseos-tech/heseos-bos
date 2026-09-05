// app/api/quotation/[token]/pdf/route.js
// The public, no-login twin of GET /api/leads/[id]/quotation-pdf — streams the exact same PDF
// (lib/quotationPdf.jsx), but gated by an HMAC-signed share token (lib/quotationShare.js)
// instead of an employee session, since this is the route the "Download PDF" link on the public
// quotation page (app/quotation/[token]/page.jsx) — and, indirectly, the WhatsApp caption link —
// points a customer at. A tampered or made-up token 404s exactly like a lead/revision that
// doesn't exist, rather than telling an attacker which part was wrong.
import { renderToBuffer } from '@react-pdf/renderer';
import { dbGetById, dbList } from '@/lib/db';
import { verifyQuotationShareToken } from '@/lib/quotationShare';
import QuotationPdfDocument from '@/lib/quotationPdf';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { token } = await params;
  const parsed = verifyQuotationShareToken(token);
  if (!parsed) return Response.json({ error: 'Not found' }, { status: 404 });

  const lead = await dbGetById('leads', parsed.leadId);
  if (!lead) return Response.json({ error: 'Not found' }, { status: 404 });

  const revisions = Array.isArray(lead.quotationRevisions) ? lead.quotationRevisions : [];
  const revision = revisions.find((r) => Number(r.revision) === Number(parsed.revision));
  if (!revision) return Response.json({ error: 'Not found' }, { status: 404 });

  const products = await dbList('products').catch(() => []);

  let buffer;
  try {
    buffer = await renderToBuffer(QuotationPdfDocument({ lead, revision, products }));
  } catch (e) {
    console.error(`GET quotation share PDF failed for lead ${parsed.leadId} v${revision.revision}:`, e);
    return Response.json({ error: 'Could not generate the quotation PDF' }, { status: 500 });
  }
  const safeName = String(lead.name || 'quotation').replace(/[^a-z0-9]+/gi, '-').toLowerCase();

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      // 'inline' here (unlike the employee-only route, which deliberately uses 'attachment' for
      // installed-PWA reasons — see that route's own comment): a customer tapping this link from
      // WhatsApp is in their regular mobile browser, which can open a PDF inline just fine, and
      // inline lets them view it as a normal web page before deciding to save it.
      'Content-Disposition': `inline; filename="quotation-${safeName}-v${revision.revision}.pdf"`,
    },
  });
}
