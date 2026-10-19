// PATCH one converted lead's installation: { date, slot, fee } | { releaseInstaller: true } | { complete: true }.
import { getEmployee } from '@/lib/auth';
import { setLeadInstallation, completeLeadByOps } from '@/lib/installJobs';

export const dynamic = 'force-dynamic';

export async function PATCH(request, { params }) {
  const employee = await getEmployee();
  if (!employee || !['operations', 'admin'].includes(employee.role)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const actor = employee.name || 'Operations';
  const r = body.complete === true ? await completeLeadByOps(id, actor) : await setLeadInstallation(id, body, actor);
  if (!r.ok) return Response.json({ error: r.error }, { status: r.status || 400 });
  return Response.json(r.job);
}
