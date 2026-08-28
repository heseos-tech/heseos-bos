import { redirect } from 'next/navigation';
import { getEmployee } from '@/lib/auth';
import AdminPanel from '@/components/AdminPanel';

export default async function AdminPage() {
  const employee = await getEmployee();
  if (!employee) redirect('/employee/login');
  if (employee.role !== 'admin') redirect('/employee');
  return <AdminPanel employee={employee} />;
}
