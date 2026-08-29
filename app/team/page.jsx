import { redirect } from 'next/navigation';
import { getEmployee } from '@/lib/auth';

// Bare /team (also the PWA start_url) — send the visitor straight to the right place instead
// of showing a marketing hero (there's nothing to sign up for here; login already lives at
// /employee/login and is shared with the desktop dashboards).
export default async function TeamRootPage() {
  const employee = await getEmployee();
  if (!employee) redirect('/employee/login');
  if (employee.role === 'admin') redirect('/admin');
  if (employee.role === 'presales' || employee.role === 'sales_engineer') redirect('/team/home');
  redirect('/employee/login');
}
