// app/api/products/bulk-import/route.js
// Admin -> Products -> Bulk Import: takes the rows already parsed client-side from an uploaded
// CSV (see lib/csv.js and components/admin/ProductsPage.jsx's ImportModal) and upserts them into
// the catalogue by SKU (case-insensitive) — a re-imported/edited export becomes a bulk update
// rather than a pile of duplicate rows. Re-validates every field server-side too; the client
// preview is a convenience, not the source of truth. Same admin-only gate as POST /api/products.
//
// Each row does its own DB round-trip (dbInsert/dbPatch), sequentially, so a single request stays
// capped at MAX_ROWS to keep one call well inside a serverless function's execution time budget.
// A file larger than that isn't rejected outright: ImportModal splits it into MAX_ROWS-sized
// batches client-side and posts them one after another, so an admin never has to split the CSV
// by hand. `rowNumbers[i]`, when sent, is the row's actual line number in the original file (so
// error rows still point at the right CSV row even though later batches don't start at row 2).

import { dbInsert, dbList, dbPatch } from '@/lib/db';
import { getEmployee } from '@/lib/auth';
import { getProductCategories } from '@/lib/productCategories';

export const dynamic = 'force-dynamic';

const MAX_ROWS = 500;
const INACTIVE_WORDS = new Set(['false', '0', 'no', 'inactive', 'n']);

function parseActive(v) {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return true;
  return !INACTIVE_WORDS.has(s);
}

function validateRow(row, validCategories) {
  const name = String(row.name || '').trim();
  const sku = String(row.sku || '').trim();
  if (!name || !sku) return { error: 'Name and SKU are required' };

  const category = String(row.category || '').trim();
  if (category && !validCategories.has(category)) {
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
  const rowNumbers = Array.isArray(body.rowNumbers) ? body.rowNumbers : null;
  if (!rows || rows.length === 0) {
    return Response.json({ error: 'No rows to import' }, { status: 400 });
  }
  if (rows.length > MAX_ROWS) {
    // ImportModal never sends more than MAX_ROWS at a time — it auto-splits on the client — so
    // this only fires for a direct/API call. Kept as a hard safety net either way.
    return Response.json({ error: `Too many rows in a single request — split the file into batches of ${MAX_ROWS} or fewer` }, { status: 400 });
  }

  const existing = await dbList('products');
  // Keyed by lowercased SKU so a duplicate SKU within the same file updates the same in-memory
  // record instead of both racing to insert — the last row for a given SKU in the file wins.
  const bySku = new Map(existing.map((p) => [String(p.sku || '').trim().toLowerCase(), p]));
  const validCategories = new Set((await getProductCategories()).map((c) => c.v));

  let created = 0;
  let updated = 0;
  const errors = [];
  const now = new Date().toISOString();

  for (let i = 0; i < rows.length; i++) {
    // Prefer the client-supplied original file row number (batched imports don't start at
    // row 2) — fall back to a plain offset when called without it.
    const rowNum = (Array.isArray(rowNumbers) && Number.isFinite(rowNumbers[i])) ? rowNumbers[i] : i + 2;
    const { value, error } = validateRow(rows[i], validCategories);
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
