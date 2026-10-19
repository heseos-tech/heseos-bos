// Installer app backend — installation jobs for the signed-in installation partner.
//
//   GET                                  { available, mine }
//        available: unclaimed jobs with a date + fee in this partner's coverage city (customer phone
//                   and full address withheld until claimed)
//        mine:      jobs this partner claimed (full details), open ones first, then completed ones
//                   with their payout status
//   POST {action:'claim'|'release'|'complete', kind:'order'|'lead', id}
//
// Only partners of type 'installer' are served; everyone else gets 403.
import { getPartner } from '@/lib/auth';
import { listJobsForInstaller, claimJob, releaseJob, completeJob, isInstaller } from '@/lib/installJobs';

export const dynamic = 'force-dynamic';

async function installer() {
  const partner = await getPartner();
  return partner ? (isInstaller(partner) ? { partner } : { error: Response.json({ error: 'This area is for installation partners' }, { status: 403 }) }) : { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) };
}

export async function GET() {
  const g = await installer();
  if (g.error) return g.error;
  return Response.json(await listJobsForInstaller(g.partner));
}

export async function POST(request) {
  const g = await installer();
  if (g.error) return g.error;
  const body = await request.json().catch(() => ({}));
  const { action, kind, id } = body;
  if (!['order', 'lead'].includes(kind) || !id) return Response.json({ error: 'Invalid request' }, { status: 400 });
  const fn = action === 'claim' ? claimJob : action === 'release' ? releaseJob : action === 'complete' ? completeJob : null;
  if (!fn) return Response.json({ error: 'Unknown action' }, { status: 400 });
  const r = await fn(g.partner, kind, String(id));
  if (!r.ok) return Response.json({ error: r.error }, { status: r.status || 400 });
  return Response.json({ ok: true, job: r.job });
}
