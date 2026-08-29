import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getEmployee } from '@/lib/auth';
import { AdminShell } from '@/components/admin/ui';
import './admin.css';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }) {
  const employee = await getEmployee();
  if (!employee) redirect('/employee/login');
  if (employee.role !== 'admin') redirect('/employee');
  // AdminShell reads ?tab= (useSearchParams) to highlight the active sidebar item, which
  // Next.js requires to sit inside a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <AdminShell employee={employee}>{children}</AdminShell>
    </Suspense>
  );
}
