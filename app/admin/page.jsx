import { getEmployee } from '@/lib/auth';
import DashboardPage from '@/components/admin/DashboardPage';

export default async function AdminDashboardRoute() {
  const employee = await getEmployee();
  return <DashboardPage employee={employee} />;
}
