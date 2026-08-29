// Admin-only CRUD for the operating-cities list (see lib/cities.js). Consumed by the City
// dropdowns on Add Partner / Add Sales Engineer / Add Pre-sales, and managed from
// Admin -> Settings -> Cities.
import { getEmployee } from '@/lib/auth';
import { getCities, addCity, removeCity } from '@/lib/cities';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const employee = await getEmployee();
  if (!employee || employee.role !== 'admin') return null;
  return employee;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  return Response.json({ cities: await getCities() });
}

export async function POST(request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { city } = await request.json().catch(() => ({}));
  try {
    const cities = await addCity(city);
    return Response.json({ cities });
  } catch (e) {
    return Response.json({ error: e.message || 'Could not add city' }, { status: 400 });
  }
}

export async function DELETE(request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { city } = await request.json().catch(() => ({}));
  if (!city) return Response.json({ error: 'city is required' }, { status: 400 });
  const cities = await removeCity(city);
  return Response.json({ cities });
}
