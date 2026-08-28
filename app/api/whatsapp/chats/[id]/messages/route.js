import { dbWhere } from '@/lib/db';
import { getEmployee } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const employee = await getEmployee();
  if (!employee) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const messages = await dbWhere('wa_messages', 'chatId', decodeURIComponent(id));
  messages.sort((a, b) => new Date(a.ts || 0) - new Date(b.ts || 0));
  return Response.json(messages);
}
