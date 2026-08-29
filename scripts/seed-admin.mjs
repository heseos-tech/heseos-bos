// One-off seed script — creates a real admin login (and optionally a demo partner login)
// directly in your Neon database, using the same pbkdf2 hashing as lib/auth.js.
//
// Why you need this: switching the app to DATABASE_URL means production now reads/writes
// Neon instead of the bundled /data JSON files. Neon starts empty — none of the demo accounts
// in /data exist there — so without this, nobody can log in at all.
//
// Usage (run from the heseos-bos project root, in your own Terminal — not through any bridge):
//
//   DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require" node scripts/seed-admin.mjs
//
// Optional overrides (defaults shown):
//   ADMIN_NAME="Baljeet Singh Khiva" ADMIN_EMAIL="admin@heseos.com" ADMIN_PASSWORD="ChangeMe123!" \
//   SEED_PARTNER=1 \
//   DATABASE_URL="..." node scripts/seed-admin.mjs
//
// SEED_PARTNER=1 also inserts the demo partner login (phone 9876543210) so you can test the
// partner portal the same way you tested it against the JSON fallback. Omit it to skip that.
//
// Safe to re-run: existing accounts with the same id are left as-is (ON CONFLICT DO NOTHING) —
// change the id (or delete the row in Neon's SQL editor) if you want to reseed a changed password.

import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. Pass it inline, e.g.:');
  console.error('  DATABASE_URL="postgresql://..." node scripts/seed-admin.mjs');
  process.exit(1);
}

const ADMIN_NAME = process.env.ADMIN_NAME || 'Baljeet Singh Khiva';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@heseos.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
const SEED_PARTNER = process.env.SEED_PARTNER === '1';

// ── pbkdf2 hashing — identical scheme to lib/auth.js's hashPassword() ──────────────
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('base64url');
  const iterations = 120000;
  const key = await new Promise((resolve, reject) => {
    crypto.pbkdf2(String(password), salt, iterations, 32, 'sha256', (err, derived) =>
      err ? reject(err) : resolve(derived)
    );
  });
  return `pbkdf2$${iterations}$${salt}$${key.toString('base64url')}`;
}

function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(9).toString('base64url')}`;
}

async function main() {
  const sql = neon(DATABASE_URL);

  // Make sure the tables exist (harmless if they already do — same DDL as lib/db.js).
  await sql`CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now(),
    data JSONB NOT NULL
  )`;
  await sql`CREATE TABLE IF NOT EXISTS partners (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now(),
    data JSONB NOT NULL
  )`;

  const existingAdmins = await sql`SELECT data FROM employees WHERE data->>'email' = ${ADMIN_EMAIL} LIMIT 1`;
  if (existingAdmins.length > 0) {
    console.log(`An employee with email ${ADMIN_EMAIL} already exists — leaving it as-is.`);
  } else {
    const id = newId('emp');
    const passwordHash = await hashPassword(ADMIN_PASSWORD);
    const admin = {
      id,
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: passwordHash,
      role: 'admin',
      active: true,
      createdAt: new Date().toISOString(),
    };
    await sql`INSERT INTO employees (id, data) VALUES (${id}, ${JSON.stringify(admin)}::jsonb)`;
    console.log('Created admin login:');
    console.log(`  Email:    ${ADMIN_EMAIL}`);
    console.log(`  Password: ${ADMIN_PASSWORD}`);
    console.log('  Log in at /employee/login, then change the password via a real flow once you add one.');
  }

  if (SEED_PARTNER) {
    const demoPhone = '9876543210';
    const existingPartners = await sql`SELECT data FROM partners WHERE data->>'phone' = ${demoPhone} LIMIT 1`;
    if (existingPartners.length > 0) {
      console.log(`A partner with phone ${demoPhone} already exists — leaving it as-is.`);
    } else {
      const id = newId('ptr');
      const passwordHash = await hashPassword('partner123');
      const partner = {
        id,
        name: 'Demo Partner',
        businessName: 'Heseos Demo Electronics',
        phone: demoPhone,
        password: passwordHash,
        type: 'shop',
        active: true,
        createdAt: new Date().toISOString(),
      };
      await sql`INSERT INTO partners (id, data) VALUES (${id}, ${JSON.stringify(partner)}::jsonb)`;
      console.log('Created demo partner login:');
      console.log(`  Phone:    ${demoPhone}`);
      console.log('  Password: partner123');
      console.log('  Log in at /partner/login.');
    }
  }

  console.log('Done.');
}

main().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
