// Manage one Bot Console tenant from Admin -> Settings -> Bot Signups:
//   - approve / reject   — the signup approval gate (see app/api/auth/bot/register/route.js)
//   - activate / deactivate — the same kill-switch the login route and getBotTenant() already
//     honor for every account type (acct.active === false), so this instantly takes a tenant's
//     bot offline without deleting anything.
//   - reset_password     — generates a fresh temporary password, hashes and stores it, and
//     returns the PLAINTEXT once in this response only (never stored, never logged) so the
//     admin can hand it to the tenant. There's no email/notify flow yet — this is the same
//     "type a temporary password" pattern Partners/Employees use at creation time, just usable
//     after the fact.
//   - set_bot_kind        — the Heseos Bot / White Label switch (components/admin/
//     SettingsPage.jsx's BotSignupsCard). A Heseos bot is trusted to write into the shared
//     Leads CRM and reuse Heseos's own QR/referral system (app/api/bot/webhook, lib/
//     attribution.js); a White Label bot never touches either — its leads live only in its own
//     bot_chats, self-service via the tenant's own Leads tab. Only one tenant can be 'heseos' at
//     a time (lib/attribution.js's getHeseosBotTenant() assumes exactly one), so promoting a new
//     one here automatically demotes whichever tenant held it before.
//   - DELETE              — permanently removes the tenant AND cascades to their bot_chats /
//     bot_messages, so nothing orphaned is left costing storage.
import crypto from 'crypto';
import { getEmployee, hashPassword } from '@/lib/auth';
import { dbGetById, dbPatch, dbInsert, dbWhere, dbList, dbDelete } from '@/lib/db';
import { seedTenantData } from '@/lib/botMock';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const employee = await getEmployee();
  if (!employee || employee.role !== 'admin') return null;
  return employee;
}

// Avoids visually-ambiguous characters (0/O, 1/l/I) since an admin has to read this aloud or
// retype it to hand off to the tenant.
function generateTempPassword() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(12);
  let out = '';
  for (let i = 0; i < 12; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export async function PATCH(request, { params }) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const tenant = await dbGetById('bot_tenants', id);
  if (!tenant) return Response.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const { action } = body;
  const VALID = ['approve', 'reject', 'activate', 'deactivate', 'reset_password', 'set_bot_kind'];
  if (!VALID.includes(action)) return Response.json({ error: `action must be one of: ${VALID.join(', ')}` }, { status: 400 });

  if (action === 'set_bot_kind') {
    const botKind = body.botKind === 'heseos' ? 'heseos' : 'white_label';
    let demotedId = null;
    if (botKind === 'heseos') {
      const currentHeseos = (await dbList('bot_tenants')).find((t) => t.id !== id && (t.botKind === 'heseos' || t.linkToHeseosLeads === true));
      if (currentHeseos) {
        await dbPatch('bot_tenants', currentHeseos.id, { botKind: 'white_label', linkToHeseosLeads: false });
        demotedId = currentHeseos.id;
      }
    }
    const updated = await dbPatch('bot_tenants', id, { botKind, linkToHeseosLeads: botKind === 'heseos' });
    const { password, waAccessToken, ...safe } = updated;
    return Response.json({ ...safe, demotedId });
  }

  if (action === 'reject') {
    const updated = await dbPatch('bot_tenants', id, { approvalStatus: 'rejected' });
    const { password, waAccessToken, ...safe } = updated;
    return Response.json(safe);
  }

  if (action === 'activate' || action === 'deactivate') {
    const updated = await dbPatch('bot_tenants', id, { active: action === 'activate' });
    const { password, waAccessToken, ...safe } = updated;
    return Response.json(safe);
  }

  if (action === 'reset_password') {
    const tempPassword = generateTempPassword();
    const updated = await dbPatch('bot_tenants', id, { password: await hashPassword(tempPassword) });
    const { password, waAccessToken, ...safe } = updated;
    // tempPassword is returned ONCE, here, and nowhere else — it isn't stored in plaintext.
    return Response.json({ ...safe, tempPassword });
  }

  // action === 'approve'
  const patch = { approvalStatus: 'approved' };
  let updated = await dbPatch('bot_tenants', id, patch);

  if (!tenant.seeded) {
    const { chats, messages } = seedTenantData(updated);
    await Promise.all([
      ...chats.map((c) => dbInsert('bot_chats', c.id, c)),
      ...messages.map((m) => dbInsert('bot_messages', m.id, m)),
    ]);
    updated = await dbPatch('bot_tenants', id, { seeded: true });
  }

  const { password, waAccessToken, ...safe } = updated;
  return Response.json(safe);
}

export async function DELETE(request, { params }) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const tenant = await dbGetById('bot_tenants', id);
  if (!tenant) return Response.json({ error: 'Not found' }, { status: 404 });

  const [chats, messages] = await Promise.all([
    dbWhere('bot_chats', 'tenantId', id),
    dbWhere('bot_messages', 'tenantId', id),
  ]);
  await Promise.all([
    ...chats.map((c) => dbDelete('bot_chats', c.id)),
    ...messages.map((m) => dbDelete('bot_messages', m.id)),
  ]);
  await dbDelete('bot_tenants', id);

  return Response.json({ success: true });
}
