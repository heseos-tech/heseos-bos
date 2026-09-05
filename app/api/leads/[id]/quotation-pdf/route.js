// app/api/leads/[id]/quotation-pdf/route.js
// Streams one quotation revision as a PDF (lib/quotationPdf.jsx builds the actual document).
// Defaults to the latest revision; ?revision=N re-renders an older one exactly as it was sent.
// Any logged-in employee can view/download — same rule GET /api/leads/[id] already uses for
// reading a lead, since a downloaded quotation isn't a customer-facing send (that's the
// WhatsApp-send route, which is restricted to Admin + Sales Engineers, matching who can build
// a quotation in the first place).
//
// QuotationPdfDocument is called directly as a function (not written as JSX) so this file can
// stay a plain .js route handler like its siblings — it's a function component with no hooks,
// so calling it returns the same React element tree JSX would.
import { renderToBuffer } from '@react-pdf/renderer';
import { dbGetById, dbList } from '@/lib/db';
import { getEmployee } from '@/lib/auth';
import QuotationPdfDocument from '@/lib/quotationPdf';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const employee = await getEmployee();
  if (!employee) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const lead = await dbGetById('leads', id);
  if (!lead) return Response.json({ error: 'Not found' }, { status: 404 });

  const revisions = Array.isArray(lead.quotationRevisions) ? lead.quotationRevisions : [];
  if (revisions.length === 0) {
    return Response.json({ error: 'No quotation has been sent for this lead yet' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const wantRevision = searchParams.get('revision');
  const revision = wantRevision
    ? revisions.find((r) => String(r.revision) === String(wantRevision))
    : revisions[revisions.length - 1];
  if (!revision) return Response.json({ error: 'Revision not found' }, { status: 404 });

  const products = await dbList('products').catch(() => []);

  let buffer;
  try {
    buffer = await renderToBuffer(QuotationPdfDocument({ lead, revision, products }));
  } catch (e) {
    // Was an unhandled crash before (a bare 500 with no body — useless both to whoever clicked
    // Download and to us trying to diagnose it after the fact). Logging the full error here
    // means the real cause shows up in Vercel's function logs for this route the next time this
    // happens, and the client gets an actual message instead of a dead page.
    console.error(`GET quotation-pdf failed for lead ${id} v${revision.revision}:`, e);
    return Response.json({ error: 'Could not generate the quotation PDF' }, { status: 500 });
  }
  const safeName = String(lead.name || 'quotation').replace(/[^a-z0-9]+/gi, '-').toLowerCase();

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      // 'attachment' (not 'inline') deliberately — an installed standalone PWA (both the
      // Partner and Team apps are installable, see components/partner/InstallApp.jsx) has no
      // tab/window chrome for the browser to open an inline PDF viewer into, so a target=_blank
      // link to an inline-disposition PDF can silently do nothing there. 'attachment' makes the
      // browser trigger its native download/save flow directly instead of needing to navigate
      // anywhere — works the same on a normal desktop tab and inside a standalone PWA.
      'Content-Disposition': `attachment; filename="quotation-${safeName}-v${revision.revision}.pdf"`,
    },
  });
}
