import { dbList, dbInsert } from '@/lib/db';
import { getEmployee, hashPassword, EMPLOYEE_ROLES } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const employee = await getEmployee();
  if (!employee || employee.role !== 'admin') return null;
  return employee;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const employees = await dbList('employees');
  // Never ship password hashes to the client.
  return Response.json(employees.map(({ password, ...rest }) => rest));
}

export async function POST(request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, email, password, role, phone, location, cities } = await request.json();
  if (!name || !email || !password || !EMPLOYEE_ROLES.includes(role)) {
    return Response.json({ error: `name, email, password and a valid role (${EMPLOYEE_ROLES.join(', ')}) are required` }, { status: 400 });
  }

  // Pre-sales can cover multiple cities (or every city); sales engineers and partners are
  // pinned to exactly one, since they physically visit. `location` stays the single display
  // string used everywhere in the UI; `cities` is the structured list city-matching actually
  // reads for pre-sales (see lib/leadAssign.js).
  let finalLocation = location || '';
  let finalCities = undefined;
  if (role === 'presales' && Array.isArray(cities) && cities.length) {
    const isAll = cities.some((c) => String(c).trim().toLowerCase() === 'all cities' || String(c).trim().toLowerCase() === 'all');
    finalCities = isAll ? ['ALL'] : cities.map((c) => String(c).trim()).filter(Boolean);
    finalLocation = isAll ? 'All Cities' : finalCities.join(', ');
  }

  const existing = await dbList('employees');
  if (existing.some((e) => String(e.email).toLowerCase() === String(email).toLowerCase())) {
    return Response.json({ error: 'An employee with that email already exists' }, { status: 409 });
  }

  const id = `EMP${Date.now().toString().slice(-8)}`;
  const record = {
    id, name, email, role, active: true,
    phone: phone || '',
    location: finalLocation,
    ...(finalCities ? { cities: finalCities } : {}),
    password: await hashPassword(password),
    createdAt: new Date().toISOString(),
    createdBy: admin.id,
  };
  await dbInsert('employees', id, record);
  const { password: _omit, ...safe } = record;
  return Response.json(safe);
}
