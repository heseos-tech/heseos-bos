import { redirect } from 'next/navigation';
import { getEmployee } from '@/lib/auth';
import TeamLeadsScreen from '@/components/team/LeadsScreen';

export const dynamic = 'force-dynamic';

export default async function TeamLeadsPage() {
  const employee = await getEmployee();
  if (!employee) redirect('/employee/login');
  return <TeamLeadsScreen employee={employee} />;
}
