// One-off script — resets an existing employee's password directly in your Neon database
// (default target: the admin account). Use this when the current password is unknown —
// it overwrites it with a fresh pbkdf2 hash, the same scheme lib/auth.js uses everywhere
// else, so the new password works immediately at /employee/login.
//
// Usage (run from the heseos-bos project root, in your own Terminal — not through any
// bridge):
//
//   DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require" \
//   NEW_PASSWORD="PickYourOwnPassword123!" \
//   node scripts/reset-employee-password.mjs
//
// Optional override (default shown):
//   EMPLOYEE_EMAIL="admin@heseos.com" ... node scripts/reset-employee-password.mjs
//
// Safe to re-run — it just overwrites the password hash each time.

import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. Pass it inline, e.g.:');
  console.error('  DATABASE_URL="postgresql://..." NEW_PASSWORD="..." node scripts/reset-employee-password.mjs');
  process.exit(1);
}

const NEW_PASSWORD = process.env.NEW_PASSWORD;
if (!NEW_PASSWORD || NEW_PASSWORD.length < 6) {
  console.error('NEW_PASSWORD is not set (or is too short — use at least 6 characters). Example:');
  console.error('  DATABASE_URL="..." NEW_PASSWORD="PickYourOwnPassword123!" node scripts/reset-employee-password.mjs');
  process.exit(1);
}

const EMPLOYEE_EMAIL = process.env.EMPLOYEE_EMAIL || 'admin@heseos.com';

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

async function main() {
  const sql = neon(DATABASE_URL);

  const rows = await sql`SELECT id FROM employees WHERE data->>'email' = ${EMPLOYEE_EMAIL} LIMIT 1`;
  if (rows.length === 0) {
    console.error(`No employee found with email ${EMPLOYEE_EMAIL}. Run scripts/seed-admin.mjs first if this account has never been created.`);
    process.exit(1);
  }

  const hashed = await hashPassword(NEW_PASSWORD);
  await sql`UPDATE employees SET data = data || jsonb_build_object('password', ${hashed}::text) WHERE id = ${rows[0].id}`;

  console.log(`Password reset for ${EMPLOYEE_EMAIL} (id ${rows[0].id}). Log in at /employee/login with the new password.`);
}

main().catch((e) => {
  console.error('Failed:', e.message);
  process.exit(1);
});
