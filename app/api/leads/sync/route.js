// Manual "sync leads from Meta" trigger — admin-only. Shows up as a small sync icon on the
// Leads list (Admin). Used to also show on the Pre-sales panel for any logged-in employee, but
// that was pulled per a later decision to keep this an admin-only action. Reuses the exact same
// syncAllLeads() logic as Admin → Settings → Meta Lead Ads' "Sync Leads Now" button, so results
// are identical either way — see lib/metaAds.js.
import { getEmployee } from '@/lib/auth';
import { syncAllLeads } from '@/lib/metaAds';

export const dynamic = 'force-dynamic';

export async function POST() {
  const employee = await getEmployee();
  if (!employee || employee.role !== 'admin') return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await syncAllLeads();
  if (result.error) return Response.json({ error: result.error }, { status: 400 });
  return Response.json(result);
}
