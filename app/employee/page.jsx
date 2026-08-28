import { redirect } from 'next/navigation';
import { getEmployee } from '@/lib/auth';
import EmployeeDashboard from '@/components/EmployeeDashboard';

export default async function EmployeePage() {
  const employee = await getEmployee();
  if (!employee) redirect('/employee/login');
  return <EmployeeDashboard employee={employee} />;
}
