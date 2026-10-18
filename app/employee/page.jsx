import { redirect } from 'next/navigation';
import { getEmployee } from '@/lib/auth';
import PresalesPanel from '@/components/employee/PresalesPanel';
import SalesEngineerPanel from '@/components/employee/SalesEngineerPanel';
import OperationsPanel from '@/components/employee/OperationsPanel';

export default async function EmployeePage() {
  const employee = await getEmployee();
  if (!employee) redirect('/employee/login');

  // Pre-sales and Sales Engineers get a panel scoped to only their own assigned leads.
  // Admin logging in here lands straight on the real Admin panel instead of a stale
  // full-pipeline view — /employee isn't a role admins actually work from.
  if (employee.role === 'presales') return <PresalesPanel employee={employee} />;
  if (employee.role === 'sales_engineer') return <SalesEngineerPanel employee={employee} />;
  if (employee.role === 'operations') return <OperationsPanel employee={employee} />;
  if (employee.role === 'admin') redirect('/admin');
  // Marketing / Management have no lead pipeline, so there's no desktop panel for them
  // here — their work lives in the Team app (Orders, Catalogue, Referrals). Send them straight there
  // instead of bouncing them back to the login page, which made a successful sign-in look like a failure.
  if (['marketing', 'management'].includes(employee.role)) redirect('/team/home');
  redirect('/employee/login');
}
