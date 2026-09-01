// Manual "sync leads from Meta" trigger — available to any logged-in employee, not just
// admin, since anyone actually working the pipeline (pre-sales, admin) should be able to pull
// in leads the webhook might have missed with one click. Shows up as a small sync icon on the
// Leads list (admin) and the Pre-sales panel. Reuses the exact same syncAllLeads() logic as
// Admin → Settings → Meta Lead Ads' "Sync Leads Now" button, so results are identical either
// way — see lib/metaAds.js.
import { getEmployee } from '@/lib/auth';
import { syncAllLeads } from '@/lib/metaAds';

export const dynamic = 'force-dynamic';

export async function POST() {
  const employee = await getEmployee();
  if (!employee) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await syncAllLeads();
  if (result.error) return Response.json({ error: result.error }, { status: 400 });
  return Response.json(result);
}
