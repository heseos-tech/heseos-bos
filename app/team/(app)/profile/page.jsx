import { redirect } from 'next/navigation';
import { getEmployee } from '@/lib/auth';
import TeamProfileScreen from '@/components/team/ProfileScreen';

export const dynamic = 'force-dynamic';

export default async function TeamProfilePage() {
  const employee = await getEmployee();
  if (!employee) redirect('/employee/login');
  return <TeamProfileScreen employee={employee} />;
}
