// Team App — "My Partners": every partner whose onboardedByEmployeeId matches the signed-in
// employee. That field is set automatically when a partner claims a pre-printed QR code batch
// tagged with this employee (see lib/attribution.js's claimPartnerQrCode), or by hand from
// Admin -> Partners (app/api/admin/partners/[id]) when Admin reassigns/records who onboarded an
// existing partner. Deliberately its OWN, non-admin-gated endpoint — unlike
// app/api/admin/partners (admin role only, returns every partner), any signed-in employee can
// call this, but it only ever returns the slice THEY personally onboarded, never anyone else's.
import { dbList } from '@/lib/db';
import { getEmployee } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const employee = await getEmployee();
  if (!employee) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const partners = await dbList('partners');
  const mine = partners.filter((p) => p.onboardedByEmployeeId === employee.id);
  return Response.json(mine.map(({ password, ...rest }) => rest));
}
