import { redirect } from 'next/navigation';
import { getEmployee } from '@/lib/auth';
import InboxView from '@/components/InboxView';

export default async function InboxPage() {
  const employee = await getEmployee();
  if (!employee) redirect('/employee/login');
  return <InboxView employee={employee} />;
}
