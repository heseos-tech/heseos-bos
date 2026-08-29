import { redirect } from 'next/navigation';
import { getEmployee } from '@/lib/auth';
import { AdminShell } from '@/components/admin/ui';
import './admin.css';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }) {
  const employee = await getEmployee();
  if (!employee) redirect('/employee/login');
  if (employee.role !== 'admin') redirect('/employee');
  return <AdminShell employee={employee}>{children}</AdminShell>;
}
