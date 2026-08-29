import { redirect } from 'next/navigation';
import { getEmployee } from '@/lib/auth';
import PresalesPanel from '@/components/employee/PresalesPanel';
import SalesEngineerPanel from '@/components/employee/SalesEngineerPanel';

export default async function EmployeePage() {
  const employee = await getEmployee();
  if (!employee) redirect('/employee/login');

  // Pre-sales and Sales Engineers get a panel scoped to only their own assigned leads.
  // Admin logging in here lands straight on the real Admin panel instead of a stale
  // full-pipeline view — /employee isn't a role admins actually work from.
  if (employee.role === 'presales') return <PresalesPanel employee={employee} />;
  if (employee.role === 'sales_engineer') return <SalesEngineerPanel employee={employee} />;
  if (employee.role === 'admin') redirect('/admin');
  redirect('/employee/login');
}
