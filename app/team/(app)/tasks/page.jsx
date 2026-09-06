'use client';
import { useEmployeeSession } from '@/components/team/ui';
import TasksScreen from '@/components/team/TasksScreen';

// Reuses TeamAppShell's own auth guard (app/team/(app)/layout.jsx) — this just reads the
// already-resolved employee from context for TasksScreen's assigneeId filter. No server-side
// fetch here any more (see leads/[id]/page.jsx and ../layout.jsx for the same change elsewhere).
export default function TeamTasksPage() {
  const employee = useEmployeeSession();
  return <TasksScreen employee={employee} backHref="/team/home" />;
}
