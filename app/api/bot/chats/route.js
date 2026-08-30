import { dbWhere } from '@/lib/db';
import { getBotTenant } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const tenant = await getBotTenant();
  if (!tenant) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const chats = await dbWhere('bot_chats', 'tenantId', tenant.id);
  chats.sort((a, b) => new Date(b.lastAt || 0) - new Date(a.lastAt || 0));
  return Response.json(chats);
}
