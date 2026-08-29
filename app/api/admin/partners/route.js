import { dbList, dbInsert } from '@/lib/db';
import { getEmployee, hashPassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const employee = await getEmployee();
  if (!employee || employee.role !== 'admin') return null;
  return employee;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const partners = await dbList('partners');
  return Response.json(partners.map(({ password, ...rest }) => rest));
}

export async function POST(request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, businessName, phone, password, type, city } = await request.json();
  if (!name || !phone || !password) {
    return Response.json({ error: 'name, phone and password are required' }, { status: 400 });
  }

  const digits = String(phone).replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) return Response.json({ error: 'Phone must be a 10-digit number' }, { status: 400 });

  const existing = await dbList('partners');
  if (existing.some((p) => String(p.phone || '').replace(/\D/g, '').slice(-10) === digits)) {
    return Response.json({ error: 'A partner with that phone number already exists' }, { status: 409 });
  }

  const id = `PTR${Date.now().toString().slice(-8)}`;
  const record = {
    id, name, businessName: businessName || name, phone: digits, type: type || 'electrical_shop', active: true,
    city: city || '',
    password: await hashPassword(password),
    createdAt: new Date().toISOString(),
    createdBy: admin.id,
  };
  await dbInsert('partners', id, record);
  const { password: _omit, ...safe } = record;
  return Response.json(safe);
}
