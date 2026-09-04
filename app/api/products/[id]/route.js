// app/api/products/[id]/route.js — read, edit or remove one catalogue product. Same access
// rule as app/api/products/route.js: any logged-in employee can read; only Admin can write.

import { dbGetById, dbPatch, dbDelete, dbList } from '@/lib/db';
import { getEmployee } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const employee = await getEmployee();
  if (!employee || employee.role !== 'admin') return null;
  return employee;
}

export async function GET(request, { params }) {
  const employee = await getEmployee();
  if (!employee) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const product = await dbGetById('products', id);
  if (!product) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json(product);
}

export async function PATCH(request, { params }) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: 'Admin login required' }, { status: 401 });
  const { id } = await params;
  const existing = await dbGetById('products', id);
  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const patch = { updatedAt: new Date().toISOString() };

  if (body.name !== undefined) {
    const name = String(body.name || '').trim();
    if (!name) return Response.json({ error: 'Name cannot be empty' }, { status: 400 });
    patch.name = name;
  }
  if (body.sku !== undefined) {
    const sku = String(body.sku || '').trim();
    if (!sku) return Response.json({ error: 'SKU cannot be empty' }, { status: 400 });
    const all = await dbList('products');
    if (all.some((p) => p.id !== id && String(p.sku || '').trim().toLowerCase() === sku.toLowerCase())) {
      return Response.json({ error: `SKU "${sku}" is already in use by another product` }, { status: 409 });
    }
    patch.sku = sku;
  }
  if (body.category !== undefined) patch.category = body.category || '';
  if (body.description !== undefined) patch.description = body.description || '';
  if (body.unit !== undefined) patch.unit = body.unit || 'piece';
  if (body.active !== undefined) patch.active = !!body.active;
  if (body.photos !== undefined) patch.photos = Array.isArray(body.photos) ? body.photos.slice(0, 8) : [];
  if (body.price !== undefined) {
    const price = body.price === null || body.price === '' ? null : Number(body.price);
    if (price !== null && (!Number.isFinite(price) || price < 0)) {
      return Response.json({ error: 'Price must be a non-negative number' }, { status: 400 });
    }
    patch.price = price;
  }

  const updated = await dbPatch('products', id, patch);
  return Response.json(updated);
}

export async function DELETE(request, { params }) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: 'Admin login required' }, { status: 401 });
  const { id } = await params;
  const ok = await dbDelete('products', id);
  if (!ok) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ success: true });
}
