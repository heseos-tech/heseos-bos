// Storage layer for Heseos BOS — leads, partner (distribution) accounts, employee accounts,
// and the WhatsApp inbox. Ported from MARG's lib/db.js: same shape, same idea.
//
// Uses Neon (serverless Postgres) when DATABASE_URL is set — the right choice for production
// on Vercel, where the filesystem is read-only/ephemeral. When DATABASE_URL is NOT set (e.g.
// local dev before you've provisioned a database), it transparently falls back to JSON files
// under /data so the app keeps working. Records are stored as JSONB to keep the lead/account
// shapes flexible as the product evolves.

import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

const ALLOWED = new Set([
  'leads',           // every captured lead, any source — single source of truth
  'partners',        // distribution partners (shops / installers / dealers) — like MARG's Mitra
  'employees',       // internal team: pre-sales / lead-nurturing + sales engineers + admin
  'wa_chats',        // WhatsApp inbox — one row per conversation
  'wa_messages',     // WhatsApp inbox — one row per message
  'settings',        // small keyed store for integration/org settings (e.g. Meta Lead Ads config)
  'bot_tenants',     // Heseos Bot platform — self-service client accounts (MARG-style, multi-tenant)
  'bot_chats',       // Heseos Bot platform — one row per tenant's WhatsApp conversation (mock data)
  'bot_messages',    // Heseos Bot platform — one row per message within a bot_chats conversation
]);
function tbl(t) {
  if (!ALLOWED.has(t)) throw new Error('Unknown table: ' + t);
  return t;
}

// ── Neon connection (lazy, memoized) ─────────────────────────────────────────
let _sql;
let _schemaReady;
function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!_sql) _sql = neon(url);
  return _sql;
}
async function ensureSchema(sql) {
  if (!_schemaReady) {
    _schemaReady = (async () => {
      await Promise.all([
        sql`CREATE TABLE IF NOT EXISTS leads (
              id TEXT PRIMARY KEY,
              created_at TIMESTAMPTZ DEFAULT now(),
              data JSONB NOT NULL
            )`,
        sql`CREATE TABLE IF NOT EXISTS partners (
              id TEXT PRIMARY KEY,
              created_at TIMESTAMPTZ DEFAULT now(),
              data JSONB NOT NULL
            )`,
        sql`CREATE TABLE IF NOT EXISTS employees (
              id TEXT PRIMARY KEY,
              created_at TIMESTAMPTZ DEFAULT now(),
              data JSONB NOT NULL
            )`,
        sql`CREATE TABLE IF NOT EXISTS wa_chats (
              id TEXT PRIMARY KEY,
              created_at TIMESTAMPTZ DEFAULT now(),
              data JSONB NOT NULL
            )`,
        sql`CREATE TABLE IF NOT EXISTS wa_messages (
              id TEXT PRIMARY KEY,
              created_at TIMESTAMPTZ DEFAULT now(),
              data JSONB NOT NULL
            )`,
        sql`CREATE TABLE IF NOT EXISTS settings (
              id TEXT PRIMARY KEY,
              created_at TIMESTAMPTZ DEFAULT now(),
              data JSONB NOT NULL
            )`,
        sql`CREATE TABLE IF NOT EXISTS bot_tenants (
              id TEXT PRIMARY KEY,
              created_at TIMESTAMPTZ DEFAULT now(),
              data JSONB NOT NULL
            )`,
        sql`CREATE TABLE IF NOT EXISTS bot_chats (
              id TEXT PRIMARY KEY,
              created_at TIMESTAMPTZ DEFAULT now(),
              data JSONB NOT NULL
            )`,
        sql`CREATE TABLE IF NOT EXISTS bot_messages (
              id TEXT PRIMARY KEY,
              created_at TIMESTAMPTZ DEFAULT now(),
              data JSONB NOT NULL
            )`,
      ]);
      await Promise.all([
        sql`CREATE INDEX IF NOT EXISTS idx_leads_status      ON leads ((data->>'status'))`,
        sql`CREATE INDEX IF NOT EXISTS idx_leads_partner     ON leads ((data->>'partnerId'))`,
        sql`CREATE INDEX IF NOT EXISTS idx_leads_assigned    ON leads ((data->>'assignedTo'))`,
        sql`CREATE INDEX IF NOT EXISTS idx_leads_engineer    ON leads ((data->>'salesEngineerId'))`,
        sql`CREATE INDEX IF NOT EXISTS idx_leads_phone       ON leads ((data->>'phone'))`,
        sql`CREATE INDEX IF NOT EXISTS idx_leads_source      ON leads ((data->>'source'))`,
        sql`CREATE INDEX IF NOT EXISTS idx_employees_email   ON employees ((data->>'email'))`,
        sql`CREATE INDEX IF NOT EXISTS idx_partners_phone    ON partners ((data->>'phone'))`,
        sql`CREATE INDEX IF NOT EXISTS idx_wamsg_chat        ON wa_messages ((data->>'chatId'))`,
        sql`CREATE INDEX IF NOT EXISTS idx_wachat_phone      ON wa_chats ((data->>'phone'))`,
        sql`CREATE INDEX IF NOT EXISTS idx_bottenant_loginid ON bot_tenants ((data->>'loginId'))`,
        sql`CREATE INDEX IF NOT EXISTS idx_botchat_tenant    ON bot_chats ((data->>'tenantId'))`,
        sql`CREATE INDEX IF NOT EXISTS idx_botmsg_chat       ON bot_messages ((data->>'chatId'))`,
        sql`CREATE INDEX IF NOT EXISTS idx_botmsg_tenant     ON bot_messages ((data->>'tenantId'))`,
      ]);
    })().catch((e) => { _schemaReady = null; throw e; });
  }
  return _schemaReady;
}

// ── JSON-file fallback (local dev without DATABASE_URL) ──────────────────────
const FILES = {
  leads: path.join(process.cwd(), 'data', 'leads.json'),
  partners: path.join(process.cwd(), 'data', 'partners.json'),
  employees: path.join(process.cwd(), 'data', 'employees.json'),
  wa_chats: path.join(process.cwd(), 'data', 'wa_chats.json'),
  wa_messages: path.join(process.cwd(), 'data', 'wa_messages.json'),
  settings: path.join(process.cwd(), 'data', 'settings.json'),
  bot_tenants: path.join(process.cwd(), 'data', 'bot_tenants.json'),
  bot_chats: path.join(process.cwd(), 'data', 'bot_chats.json'),
  bot_messages: path.join(process.cwd(), 'data', 'bot_messages.json'),
};
function readFile(t) {
  try { return JSON.parse(fs.readFileSync(FILES[t], 'utf8')); } catch { return []; }
}
function writeFile(t, d) {
  try { fs.writeFileSync(FILES[t], JSON.stringify(d, null, 2)); } catch { /* read-only fs (e.g. Vercel) */ }
}

export function storageMode() {
  return getSql() ? 'neon' : 'file';
}

export async function dbGetById(table, id) {
  const t = tbl(table);
  const sql = getSql();
  if (!sql) return readFile(t).find((r) => r && r.id === id) || null;
  await ensureSchema(sql);
  const rows = await sql.query(`SELECT data FROM ${t} WHERE id = $1 LIMIT 1`, [id]);
  return rows[0] ? rows[0].data : null;
}

export async function dbList(table) {
  const t = tbl(table);
  const sql = getSql();
  if (!sql) return readFile(t);
  await ensureSchema(sql);
  const rows = await sql.query(`SELECT data FROM ${t} ORDER BY created_at DESC`);
  return rows.map((r) => r.data);
}

// Scoped lookup: rows where data->>key === value. On Neon this uses the JSONB expression
// indexes above; on the file fallback it filters in memory. `key` must be a plain identifier.
export async function dbWhere(table, key, value) {
  const t = tbl(table);
  if (!/^[a-zA-Z0-9_]+$/.test(String(key))) throw new Error('Invalid key: ' + key);
  const sql = getSql();
  if (!sql) return readFile(t).filter((r) => r && String(r[key]) === String(value));
  await ensureSchema(sql);
  const rows = await sql.query(`SELECT data FROM ${t} WHERE data->>'${key}' = $1 ORDER BY created_at DESC`, [String(value)]);
  return rows.map((r) => r.data);
}

export async function dbInsert(table, id, obj) {
  const t = tbl(table);
  const sql = getSql();
  if (!sql) {
    const arr = readFile(t);
    const i = arr.findIndex((r) => r.id === id);
    if (i === -1) arr.unshift(obj); else arr[i] = obj;
    writeFile(t, arr);
    return obj;
  }
  await ensureSchema(sql);
  await sql.query(
    `INSERT INTO ${t} (id, data) VALUES ($1, $2::jsonb)
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
    [id, JSON.stringify(obj)]
  );
  return obj;
}

export async function dbPatch(table, id, patch) {
  const t = tbl(table);
  const sql = getSql();
  if (!sql) {
    const arr = readFile(t);
    const i = arr.findIndex((r) => r.id === id);
    if (i === -1) return null;
    arr[i] = { ...arr[i], ...patch };
    writeFile(t, arr);
    return arr[i];
  }
  await ensureSchema(sql);
  const rows = await sql.query(
    `UPDATE ${t} SET data = data || $2::jsonb WHERE id = $1 RETURNING data`,
    [id, JSON.stringify(patch)]
  );
  return rows[0] ? rows[0].data : null;
}

// Atomic "claim" write: applies `patch` only if `field` is currently null/unset on the row —
// used for the sales-engineer lead claim pool, where the first person to accept an open demo
// must win even under concurrent requests. Returns { ok: true, data } on success, or
// { ok: false, reason: 'already_claimed' | 'not_found', data? } otherwise. On Neon this is a
// single conditional UPDATE (race-safe across concurrent requests); the file fallback does a
// read-check-write, which is only ever hit by one request at a time in local dev.
export async function dbClaim(table, id, field, patch) {
  const t = tbl(table);
  if (!/^[a-zA-Z0-9_]+$/.test(String(field))) throw new Error('Invalid field: ' + field);
  const sql = getSql();
  if (!sql) {
    const arr = readFile(t);
    const i = arr.findIndex((r) => r.id === id);
    if (i === -1) return { ok: false, reason: 'not_found' };
    if (arr[i][field] != null) return { ok: false, reason: 'already_claimed', data: arr[i] };
    arr[i] = { ...arr[i], ...patch };
    writeFile(t, arr);
    return { ok: true, data: arr[i] };
  }
  await ensureSchema(sql);
  const rows = await sql.query(
    `UPDATE ${t} SET data = data || $2::jsonb WHERE id = $1 AND (data->>'${field}') IS NULL RETURNING data`,
    [id, JSON.stringify(patch)]
  );
  if (rows[0]) return { ok: true, data: rows[0].data };
  const existing = await dbGetById(table, id);
  if (!existing) return { ok: false, reason: 'not_found' };
  return { ok: false, reason: 'already_claimed', data: existing };
}

export async function dbDelete(table, id) {
  const t = tbl(table);
  const sql = getSql();
  if (!sql) {
    const arr = readFile(t);
    const filtered = arr.filter((r) => r.id !== id);
    if (filtered.length === arr.length) return false;
    writeFile(t, filtered);
    return true;
  }
  await ensureSchema(sql);
  const rows = await sql.query(`DELETE FROM ${t} WHERE id = $1 RETURNING id`, [id]);
  return rows.length > 0;
}
