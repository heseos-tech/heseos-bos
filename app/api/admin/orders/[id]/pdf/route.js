// app/api/admin/orders/[id]/pdf/route.js
// Streams one order as a PDF — lib/orderPdf.jsx builds the actual document(s). ?type=slip
// (default) renders the internal packing/dispatch slip; ?type=invoice renders the customer
// invoice. Same auth level as the rest of Admin -> Orders (any logged-in employee).
//
// OrderSlipDocument/OrderInvoiceDocument are called directly as functions (not written as JSX)
// so this file can stay a plain .js route handler like its siblings — see
// app/api/leads/[id]/quotation-pdf/route.js for the identical pattern this is modeled on.
import { renderToBuffer } from '@react-pdf/renderer';
import { dbGetById } from '@/lib/db';
import { getEmployee } from '@/lib/auth';
import { OrderSlipDocument, OrderInvoiceDocument } from '@/lib/orderPdf';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const employee = await getEmployee();
  if (!employee) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const order = await dbGetById('orders', id);
  if (!order) return Response.json({ error: 'Not found' }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') === 'invoice' ? 'invoice' : 'slip';

  let buffer;
  try {
    buffer = await renderToBuffer(type === 'invoice' ? OrderInvoiceDocument({ order }) : OrderSlipDocument({ order }));
  } catch (e) {
    // Same reasoning as quotation-pdf/route.js's own catch: log the real cause server-side so
    // it shows up in Vercel's function logs, and give the client an actual message instead of a
    // bare 500 with no body.
    console.error(`GET order ${type}-pdf failed for order ${id}:`, e);
    return Response.json({ error: `Could not generate the order ${type}` }, { status: 500 });
  }

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      // 'attachment' (not 'inline') — same reasoning as quotation-pdf/route.js: the installed
      // standalone Team app has no browser chrome for an inline PDF viewer to open into.
      'Content-Disposition': `attachment; filename="${type}-${id}.pdf"`,
    },
  });
}
