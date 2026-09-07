// Admin-only CRUD for the product catalogue categories list (see lib/productCategories.js).
// Consumed by the Category dropdowns on Admin -> Products (filter + Add/Edit Product), and
// managed from Admin -> Products' "Manage Categories" panel — same shape as
// app/api/admin/cities/route.js's Cities management.
import { getEmployee } from '@/lib/auth';
import { getProductCategories, addProductCategory, removeProductCategory } from '@/lib/productCategories';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const employee = await getEmployee();
  if (!employee || employee.role !== 'admin') return null;
  return employee;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  return Response.json({ categories: await getProductCategories() });
}

export async function POST(request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { label } = await request.json().catch(() => ({}));
  try {
    const categories = await addProductCategory(label);
    return Response.json({ categories });
  } catch (e) {
    return Response.json({ error: e.message || 'Could not add category' }, { status: 400 });
  }
}

export async function DELETE(request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { v } = await request.json().catch(() => ({}));
  if (!v) return Response.json({ error: 'v is required' }, { status: 400 });
  const categories = await removeProductCategory(v);
  return Response.json({ categories });
}
