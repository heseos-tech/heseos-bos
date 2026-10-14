// Admin backend for Call Requests — WhatsApp customers who tapped "Talk to someone" / "Talk to
// our team" (lib/heseosCallRequests.js). Any logged-in employee can read/manage them, same
// operational access level as Orders and Leads.
import { dbList } from '@/lib/db';
import { getEmployee } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const employee = await getEmployee();
  if (!employee) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const rows = await dbList('call_requests');
  rows.sort((a, b) => new Date(b.lastRequestedAt || b.createdAt || 0) - new Date(a.lastRequestedAt || a.createdAt || 0));
  return Response.json(rows);
}
