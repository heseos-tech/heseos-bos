import { Suspense } from 'react';
import { getEmployee } from '@/lib/auth';
import AdminHome from '@/components/admin/AdminHome';

// The single admin route — every sidebar section (Dashboard, Leads, Partners, Sales
// Engineers, Pre-sales, Demo Schedule, Quotations, Conversions, Reports, Payouts, Tasks,
// Settings) renders inside AdminHome now, switched by the ?tab= query param instead of a
// separate route per section. See components/admin/AdminHome.jsx for why.
export default async function AdminDashboardRoute() {
  const employee = await getEmployee();
  return (
    <Suspense fallback={<div className="adm-empty">Loading…</div>}>
      <AdminHome employee={employee} />
    </Suspense>
  );
}
