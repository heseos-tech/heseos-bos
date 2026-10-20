// Pre-sales call outcomes for customers who were sent a WhatsApp landing-page card but never opened it
// (the list itself comes from /api/admin/landing-activity → notOpened). GET returns every saved outcome
// plus the people who can be picked as "who is calling"; POST saves one outcome.
import { getEmployee } from '@/lib/auth';
import { dbList, dbGetById, dbInsert } from '@/lib/db';
import { CARD_STATUS_KEYS, cardFollowupKey } from '@/lib/cardFollowupStatus';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['presales', 'admin'];

async function callers() {
  const all = await dbList('employees');
  return all
    .filter((e) => e && e.active !== false && ALLOWED_ROLES.includes(e.role))
    .map((e) => ({ id: e.id, name: e.name || e.email || e.id }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function GET() {
  const me = await getEmployee();
  if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ALLOWED_ROLES.includes(me.role)) return Response.json({ error: 'Forbidden' }, { status: 403 });
  const rows = await dbList('card_followups');
  const followups = {};
  for (const r of rows) if (r && r.id) followups[r.id] = r;
  return Response.json({ followups, callers: await callers(), me: { id: me.id, name: me.name || me.email } });
}

export async function POST(request) {
  const me = await getEmployee();
  if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ALLOWED_ROLES.includes(me.role)) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const key = cardFollowupKey(body.phone);
  if (key.length < 10) return Response.json({ error: 'A valid phone number is required' }, { status: 400 });
  const status = String(body.status || '');
  if (status && !CARD_STATUS_KEYS.includes(status)) return Response.json({ error: 'Unknown status' }, { status: 400 });

  const list = await callers();
  const callerId = String(body.callerId || me.id);
  const caller = list.find((c) => c.id === callerId);
  if (!caller) return Response.json({ error: 'Pick who is calling' }, { status: 400 });

  const prev = await dbGetById('card_followups', key);
  const now = new Date().toISOString();
  const changed = !prev || prev.status !== status || prev.callerId !== caller.id;
  const rec = {
    id: key,
    phone: key,
    status,
    callerId: caller.id,
    callerName: caller.name,
    updatedAt: now,
    updatedById: me.id,
    updatedByName: me.name || me.email || me.id,
    history: changed
      ? [...(prev?.history || []), { status, callerId: caller.id, callerName: caller.name, at: now, by: me.name || me.email || me.id }].slice(-50)
      : (prev?.history || []),
  };
  await dbInsert('card_followups', key, rec);
  return Response.json(rec);
}
