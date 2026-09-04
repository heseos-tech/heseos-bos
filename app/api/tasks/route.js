// app/api/tasks/route.js
// Assignable follow-up tasks for the team (Admin -> Tasks, and each employee's My Tasks on
// /employee and the Team App). Any logged-in employee can see the full list and create a task
// for themselves or a teammate — a small team on a shared board, same trust level leads already
// work at (any employee can already see/assign any lead). Optionally linked to a lead (leadId)
// so "follow up with this customer next week" has somewhere to point back to, but a task
// doesn't require one — plenty of team to-dos aren't about a specific lead.
import { dbInsert, dbList } from '@/lib/db';
import { getEmployee } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const PRIORITIES = new Set(['low', 'medium', 'high']);

export async function GET() {
  const employee = await getEmployee();
  if (!employee) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const tasks = await dbList('tasks');
  return Response.json(tasks);
}

export async function POST(request) {
  const employee = await getEmployee();
  if (!employee) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const title = String(body.title || '').trim();
  if (!title) return Response.json({ error: 'Title is required' }, { status: 400 });

  const priority = PRIORITIES.has(body.priority) ? body.priority : 'medium';
  const id = `TSK${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const task = {
    id,
    title,
    description: body.description || '',
    assigneeId: body.assigneeId || employee.id,
    dueAt: body.dueAt || null,
    priority,
    status: 'open',
    leadId: body.leadId || null,
    createdBy: employee.id,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };
  await dbInsert('tasks', id, task);
  return Response.json(task);
}
