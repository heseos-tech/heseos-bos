// Leads captured by the tenant's bot — any bot_chats row with a `lead` object attached (set
// during the mock seed for now; a real bot would set this the moment a conversation qualifies).

import { dbWhere } from '@/lib/db';
import { getBotTenant } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const tenant = await getBotTenant();
  if (!tenant) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const chats = await dbWhere('bot_chats', 'tenantId', tenant.id);
  const leads = chats
    .filter((c) => c.lead)
    .map((c) => ({ chatId: c.id, name: c.name, phone: c.phone, city: c.city, status: c.lead.status, capturedAt: c.firstMessageAt }))
    .sort((a, b) => new Date(b.capturedAt || 0) - new Date(a.capturedAt || 0));
  return Response.json(leads);
}
