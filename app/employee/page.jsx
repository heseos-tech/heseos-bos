import { redirect } from 'next/navigation';
import { getEmployee } from '@/lib/auth';
import EmployeeDashboard from '@/components/EmployeeDashboard';
import PresalesPanel from '@/components/employee/PresalesPanel';
import SalesEngineerPanel from '@/components/employee/SalesEngineerPanel';

export default async function EmployeePage() {
  const employee = await getEmployee();
  if (!employee) redirect('/employee/login');

  // Pre-sales and Sales Engineers get a panel scoped to only their own assigned leads.
  // Admin (and any future role) keeps the full-pipeline view.
  if (employee.role === 'presales') return <PresalesPanel employee={employee} />;
  if (employee.role === 'sales_engineer') return <SalesEngineerPanel employee={employee} />;
  return <EmployeeDashboard employee={employee} />;
}
