// app/api/products/bulk-import/route.js
// Admin -> Products -> Bulk Import: takes the rows already parsed client-side from an uploaded
// CSV (see lib/csv.js and components/admin/ProductsPage.jsx's ImportModal) and upserts them into
// the catalogue by SKU (case-insensitive) — a re-imported/edited export becomes a bulk update
// rather than a pile of duplicate rows. Re-validates every field server-side too; the client
// preview is a convenience, not the source of truth. Same admin-only gate as POST /api/products.
//
// Each row is its own DB round-trip (dbInsert/dbPatch). Earlier this ran them one at a time,
// awaited sequentially — fine at a handful of rows, but at a few hundred it could take minutes
// and blow well past a serverless function's execution budget. Neon's serverless driver is just a
// stateless HTTP call per query, so writes below run with bounded concurrency (CONCURRENCY workers
// pulling off a shared queue) instead of one-by-one — a few hundred rows now finishes in a couple
// of seconds instead of minutes.
//
// A first attempt at making concurrent writes safe for a repeated SKU folded duplicate SKUs down
// to one write before starting — safe, but wrong: it silently dropped every row whose SKU repeats
// elsewhere in the same file (no error, no count, just gone — e.g. 527 valid rows, ~120 sharing a
// SKU with another row, only 407 ever got written). Every VALID row has to be accounted for in
// created+updated+errors. So instead: every row still gets its own write and its own count, in
// file order, but writes sharing a SKU are chained onto each other (see `chains` below) so they
// apply strictly in order instead of racing — a later row for the same SKU still ends up as the
// final state ("last row wins"), it just isn't allowed to run concurrently with an earlier one for
// that same SKU. Different SKUs still run fully in parallel, which is where the real speedup is
// anyway (repeated SKUs are the rare case).
//
// A single request is still capped at MAX_ROWS as a sanity ceiling; ImportModal splits a bigger
// file into MAX_ROWS-sized batches client-side and posts them one after another, so an admin never
// has to split the CSV by hand. `rowNumbers[i]`, when sent, is the row's actual line number in the
// original file (so error rows still point at the right CSV row even though later batches don't
// start at row 2).

import { dbInsert, dbList, dbPatch } from '@/lib/db';
import { getEmployee } from '@/lib/auth';
import { getProductCategories } from '@/lib/productCategories';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // give Vercel headroom for the largest single batch, belt-and-braces

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

const CONCURRENCY = 15; // parallel DB round-trips — see the header comment for why

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
  // Keyed by lowercased SKU, snapshotted once up front and mutated as writes land, so the next
  // row for that SKU (whether concurrent-ish or chained, see `chains` below) sees the right state.
  const bySku = new Map(existing.map((p) => [String(p.sku || '').trim().toLowerCase(), p]));
  const validCategories = new Set((await getProductCategories()).map((c) => c.v));

  const errors = [];
  // Validate every row up front (cheap, synchronous) but keep them ALL, in file order, including
  // repeated SKUs — nothing gets folded away here, so every valid row is guaranteed to land in
  // created+updated+errors.
  const toWrite = []; // [{ value, rowNum }] in original file order
  for (let i = 0; i < rows.length; i++) {
    // Prefer the client-supplied original file row number (batched imports don't start at
    // row 2) — fall back to a plain offset when called without it.
    const rowNum = (Array.isArray(rowNumbers) && Number.isFinite(rowNumbers[i])) ? rowNumbers[i] : i + 2;
    const { value, error } = validateRow(rows[i], validCategories);
    if (error) { errors.push({ row: rowNum, error }); continue; }
    toWrite.push({ value, rowNum });
  }

  let created = 0;
  let updated = 0;
  const now = new Date().toISOString();
  let next = 0;
  // sku(lower) -> promise for the write currently/last running for that SKU. A row for a SKU
  // already in flight chains onto it instead of firing immediately, so same-SKU writes apply in
  // file order one at a time; different SKUs have nothing to chain onto and run concurrently.
  const chains = new Map();

  async function writeRow(value, rowNum) {
    const key = value.sku.toLowerCase();
    const match = bySku.get(key);
    try {
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
        const id = `PRD${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
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
    } catch (e) {
      errors.push({ row: rowNum, error: e?.message || 'Could not save this row' });
    }
  }

  async function worker() {
    while (next < toWrite.length) {
      const { value, rowNum } = toWrite[next++];
      const key = value.sku.toLowerCase();
      // Chain onto whatever's currently the last write queued for this SKU (or run immediately
      // if nothing's pending for it) so same-SKU rows never write concurrently with each other.
      const prior = chains.get(key) || Promise.resolve();
      const run = prior.then(() => writeRow(value, rowNum));
      chains.set(key, run);
      await run;
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, toWrite.length) }, worker));

  return Response.json({ created, updated, errors });
}
