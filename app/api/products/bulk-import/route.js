// app/api/products/bulk-import/route.js
// Admin -> Products -> Bulk Import: takes the rows already parsed client-side from an uploaded
// CSV (see lib/csv.js and components/admin/ProductsPage.jsx's ImportModal) and upserts them into
// the catalogue by SKU (case-insensitive) — a re-imported/edited export becomes a bulk update
// rather than a pile of duplicate rows. Re-validates every field server-side too; the client
// preview is a convenience, not the source of truth. Same admin-only gate as POST /api/products.

import { dbInsert, dbList, dbPatch } from '@/lib/db';
import { getEmployee } from '@/lib/auth';
import { PRODUCT_CATEGORY } from '@/lib/formOptions';

export const dynamic = 'force-dynamic';

const MAX_ROWS = 500;
const VALID_CATEGORIES = new Set(PRODUCT_CATEGORY.map((c) => c.v));
const INACTIVE_WORDS = new Set(['false', '0', 'no', 'inactive', 'n']);

function parseActive(v) {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return true;
  return !INACTIVE_WORDS.has(s);
}

function validateRow(row) {
  const name = String(row.name || '').trim();
  const sku = String(row.sku || '').trim();
  if (!name || !sku) return { error: 'Name and SKU are required' };

  const category = String(row.category || '').trim();
  if (category && !VALID_CATEGORIES.has(category)) {
    return { error: `Unknown category "${category}"` };
  }

  const rawPrice = String(row.price ?? '').trim();
  let price = null;
  if (rawPrice) {
    price = Number(rawPrice);
    if (!Number.isFinite(price) || price < 0) {
      return { error: 'Price must be a non-negative number, or blank' };
    }
  }

  return {
    value: {
      name,
      sku,
      category,
      price,
      unit: String(row.unit || '').trim() || 'piece',
      description: String(row.description || '').trim(),
      active: parseActive(row.active),
    },
  };
}

export async function POST(request) {
  const employee = await getEmployee();
  if (!employee || employee.role !== 'admin') {
    return Response.json({ error: 'Admin login required' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const rows = Array.isArray(body.rows) ? body.rows : null;
  if (!rows || rows.length === 0) {
    return Response.json({ error: 'No rows to import' }, { status: 400 });
  }
  if (rows.length > MAX_ROWS) {
    return Response.json({ error: `Too many rows — split the file into batches of ${MAX_ROWS} or fewer` }, { status: 400 });
  }

  const existing = await dbList('products');
  // Keyed by lowercased SKU so a duplicate SKU within the same file updates the same in-memory
  // record instead of both racing to insert — the last row for a given SKU in the file wins.
  const bySku = new Map(existing.map((p) => [String(p.sku || '').trim().toLowerCase(), p]));

  let created = 0;
  let updated = 0;
  const errors = [];
  const now = new Date().toISOString();

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2; // +2: header row is row 1, data starts at row 2 in a spreadsheet
    const { value, error } = validateRow(rows[i]);
    if (error) { errors.push({ row: rowNum, error }); continue; }

    const key = value.sku.toLowerCase();
    const match = bySku.get(key);
    if (match) {
      const patch = {
        name: value.name,
        category: value.category,
        price: value.price,
        unit: value.unit,
        description: value.description,
        active: value.active,
        updatedAt: now,
      };
      await dbPatch('products', match.id, patch);
      bySku.set(key, { ...match, ...patch });
      updated++;
    } else {
      const id = `PRD${Date.now().toString(36)}${i}${Math.random().toString(36).slice(2, 6)}`;
      const product = {
        id,
        sku: value.sku,
        name: value.name,
        category: value.category,
        description: value.description,
        price: value.price,
        unit: value.unit,
        photos: [],
        active: value.active,
        createdAt: now,
        updatedAt: now,
        createdBy: employee.id,
      };
      await dbInsert('products', id, product);
      bySku.set(key, product);
      created++;
    }
  }

  return Response.json({ created, updated, errors });
}
