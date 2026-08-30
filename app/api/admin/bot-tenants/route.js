// Admin-only view of Bot Console signups — the approval queue for the "Approval gate" model:
// anyone can submit the self-service signup form (app/api/auth/bot/register), but the account
// stays inert (no session, no seeded data) until a Heseos admin approves it here. Managed from
// Admin -> Settings -> Bot Signups (components/admin/SettingsPage.jsx's BotSignupsCard).
import { getEmployee } from '@/lib/auth';
import { dbList } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const employee = await getEmployee();
  if (!employee || employee.role !== 'admin') return null;
  return employee;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const tenants = await dbList('bot_tenants');
  const safe = tenants
    .map(({ password, waAccessToken, ...t }) => t)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return Response.json(safe);
}
