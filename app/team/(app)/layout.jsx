import { redirect } from 'next/navigation';
import { getEmployee } from '@/lib/auth';
import { TeamAppShell } from '@/components/team/ui';

// Same auth guard shape as app/partner/(app)/layout.jsx, but for employees. Admins get sent
// to /admin (matches "if employee login is admin then directly land admin to admin pannel");
// anyone who isn't presales/sales_engineer/admin has no business here.
export default async function TeamAppLayout({ children }) {
  const employee = await getEmployee();
  if (!employee) redirect('/team/login');
  if (employee.role === 'admin') redirect('/admin');
  if (employee.role !== 'presales' && employee.role !== 'sales_engineer') redirect('/team/login');

  return (
    <div className="hp-root">
      <TeamAppShell>{children}</TeamAppShell>
    </div>
  );
}
