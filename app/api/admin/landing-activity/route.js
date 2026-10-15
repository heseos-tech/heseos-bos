// Admin -> Landing Activity: funnel, section reach, tapped buttons and recent visits for the
// WhatsApp-linked landing pages. Any logged-in employee can read it (same level as Leads/Orders).
import { getEmployee } from '@/lib/auth';
import { buildLandingReport } from '@/lib/landingActivity';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const employee = await getEmployee();
  if (!employee) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const report = await buildLandingReport({ days: searchParams.get('days') || 7, page: searchParams.get('page') || 'all' });
  return Response.json(report);
}
