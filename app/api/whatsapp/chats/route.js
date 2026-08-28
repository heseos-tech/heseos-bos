import { dbList } from '@/lib/db';
import { getEmployee } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const employee = await getEmployee();
  if (!employee) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const chats = await dbList('wa_chats');
  chats.sort((a, b) => new Date(b.lastAt || 0) - new Date(a.lastAt || 0));
  return Response.json(chats);
}
