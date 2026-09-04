// app/api/products/route.js
// Heseos's own product catalogue — SKU, name, category, price, photos. Any logged-in employee
// (admin, presales, sales engineer) can read the catalogue, since a sales engineer needs it to
// build a quotation, but only Admin can add/edit/remove products — the catalogue is a shared
// price list, not something every role should be able to change. Photos are stored as base64
// data URLs directly on the record (no external file storage is wired up yet — see the photos
// field), so a product with several photos is a genuinely heavier row than most others in this
// app; fine for a catalogue of a reasonable size.

import { dbInsert, dbList } from '@/lib/db';
import { getEmployee } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const employee = await getEmployee();
  if (!employee || employee.role !== 'admin') return null;
  return employee;
}

export async function GET() {
  const employee = await getEmployee();
  if (!employee) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const products = await dbList('products');
  // Newest first, same convention dbList already gives every other table.
  return Response.json(products);
}

export async function POST(request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: 'Admin login required' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  const sku = String(body.sku || '').trim();
  if (!name || !sku) {
    return Response.json({ error: 'Name and SKU are required' }, { status: 400 });
  }
  const price = body.price !== undefined && body.price !== null && body.price !== '' ? Number(body.price) : null;
  if (price !== null && (!Number.isFinite(price) || price < 0)) {
    return Response.json({ error: 'Price must be a non-negative number' }, { status: 400 });
  }

  const existing = await dbList('products');
  if (existing.some((p) => String(p.sku || '').trim().toLowerCase() === sku.toLowerCase())) {
    return Response.json({ error: `SKU "${sku}" is already in use by another product` }, { status: 409 });
  }

  const id = `PRD${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;
  const now = new Date().toISOString();
  const product = {
    id,
    sku,
    name,
    category: body.category || '',
    description: body.description || '',
    price,
    unit: body.unit || 'piece',
    // Each photo: { id, name, dataUrl } — dataUrl is a base64 data: URI produced client-side
    // (FileReader), capped client-side too (see components/admin/ProductsPage.jsx). The first
    // photo in the array is always the cover/primary image.
    photos: Array.isArray(body.photos) ? body.photos.slice(0, 8) : [],
    active: body.active !== false,
    createdAt: now,
    updatedAt: now,
    createdBy: admin.id,
  };
  await dbInsert('products', id, product);
  return Response.json(product);
}
