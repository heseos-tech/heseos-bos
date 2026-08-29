import { notFound, redirect } from 'next/navigation';
import { getEmployee } from '@/lib/auth';
import { dbGetById } from '@/lib/db';
import TeamLeadDetailScreen from '@/components/team/LeadDetailScreen';

export const dynamic = 'force-dynamic';

function norm(s) { return String(s || '').trim().toLowerCase(); }

export default async function TeamLeadDetailPage({ params }) {
  const { id } = await params;
  const employee = await getEmployee();
  if (!employee) redirect('/employee/login');

  const lead = await dbGetById('leads', id);
  if (!lead) notFound();

  // Same visibility rule the desktop panels apply client-side: pre-sales only ever sees leads
  // assigned to them; a sales engineer sees leads already claimed by them, PLUS any open demo
  // in their own city (the "Available Leads" pool) so they can view it before claiming.
  const isPresales = employee.role === 'presales';
  const isSE = employee.role === 'sales_engineer';
  const visible =
    (isPresales && lead.assignedTo === employee.id) ||
    (isSE && (lead.salesEngineerId === employee.id ||
      (lead.demoScheduledAt && !lead.salesEngineerId && norm(lead.city) === norm(employee.location))));
  if (!visible) notFound();

  return <TeamLeadDetailScreen employee={employee} lead={lead} />;
}
