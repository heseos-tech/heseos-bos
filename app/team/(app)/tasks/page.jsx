import { redirect } from 'next/navigation';
import { getEmployee } from '@/lib/auth';
import TasksScreen from '@/components/team/TasksScreen';

export const dynamic = 'force-dynamic';

// Reuses the layout's own auth guard (app/team/(app)/layout.jsx already redirects anyone who
// isn't presales/sales_engineer before children render) — this fetch just gets `employee` for
// TasksScreen's assigneeId filter, same pattern as app/team/(app)/leads/[id]/page.jsx.
export default async function TeamTasksPage() {
  const employee = await getEmployee();
  if (!employee) redirect('/team/login');
  return <TasksScreen employee={employee} backHref="/team/home" />;
}
