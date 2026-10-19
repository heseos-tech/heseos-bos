// Operations -> converted leads awaiting installation. A lead is a closed deal from a sales engineer
// (not a landing-page order); Operations sets its installation date, time window and the installer's
// fee from here, and installation partners then claim it just like an order — see lib/installJobs.js.
// Open to Operations and Admin.
import { dbList } from '@/lib/db';
import { getEmployee } from '@/lib/auth';
import { leadToJob } from '@/lib/installJobs';

export const dynamic = 'force-dynamic';

export async function GET() {
  const employee = await getEmployee();
  if (!employee || !['operations', 'admin'].includes(employee.role)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const leads = await dbList('leads');
  const jobs = leads.filter((l) => l.demoOutcome === 'converted').map((l) => ({
    ...leadToJob(l),
    finalPrice: l.finalPrice || null,
    convertedAt: l.convertedAt || l.demoOutcomeAt || null,
    installPartnerName: null,
  }));
  return Response.json(jobs);
}
