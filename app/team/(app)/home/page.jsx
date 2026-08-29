import { redirect } from 'next/navigation';
import { getEmployee } from '@/lib/auth';
import TeamHomeScreen from '@/components/team/HomeScreen';

export const dynamic = 'force-dynamic';

export default async function TeamHomePage() {
  const employee = await getEmployee();
  if (!employee) redirect('/employee/login');
  return <TeamHomeScreen employee={employee} />;
}
