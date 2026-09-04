// app/api/leads/[id]/quotation-pdf/send/route.js
// "Send on WhatsApp" — renders the requested quotation revision (default: latest) as a PDF and
// sends it to the lead's phone via lib/heseosNotify.js's sendHeseosQuotationPdf. Restricted to
// Admin + Sales Engineers, matching who can build a quotation in the first place (the 'quotation'
// PATCH type on app/api/leads/[id]/route.js itself stays open to any logged-in employee, same
// as it was before this feature — this route is the customer-facing send action, so it's the
// one that carries the tighter gate).
import { dbGetById } from '@/lib/db';
import { getEmployee } from '@/lib/auth';
import { sendHeseosQuotationPdf } from '@/lib/heseosNotify';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  const employee = await getEmployee();
  if (!employee) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (employee.role !== 'sales_engineer' && employee.role !== 'admin') {
    return Response.json({ error: 'Only Admin or a Sales Engineer can send a quotation' }, { status: 403 });
  }

  const { id } = await params;
  const lead = await dbGetById('leads', id);
  if (!lead) return Response.json({ error: 'Not found' }, { status: 404 });

  const revisions = Array.isArray(lead.quotationRevisions) ? lead.quotationRevisions : [];
  if (revisions.length === 0) {
    return Response.json({ error: 'No quotation has been sent for this lead yet' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const revision = body.revision
    ? revisions.find((r) => String(r.revision) === String(body.revision))
    : revisions[revisions.length - 1];
  if (!revision) return Response.json({ error: 'Revision not found' }, { status: 404 });

  const result = await sendHeseosQuotationPdf(lead, revision);
  if (!result.ok) return Response.json({ error: result.error || 'Could not send the quotation on WhatsApp' }, { status: 502 });
  return Response.json({ success: true });
}
