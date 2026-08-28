-- Heseos BOS — Neon Postgres schema
-- The app auto-creates these tables on first use (see lib/db.js), but you can run this
-- manually in the Neon SQL Editor if you prefer to provision up front.

CREATE TABLE IF NOT EXISTS leads (
  id         TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  data       JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS partners (
  id         TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  data       JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS employees (
  id         TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  data       JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS wa_chats (
  id         TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  data       JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS wa_messages (
  id         TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  data       JSONB NOT NULL
);

-- Helpful indexes for filtering/sorting
CREATE INDEX IF NOT EXISTS leads_created_idx    ON leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status     ON leads ((data->>'status'));
CREATE INDEX IF NOT EXISTS idx_leads_partner    ON leads ((data->>'partnerId'));
CREATE INDEX IF NOT EXISTS idx_leads_assigned   ON leads ((data->>'assignedTo'));
CREATE INDEX IF NOT EXISTS idx_leads_engineer   ON leads ((data->>'salesEngineerId'));
CREATE INDEX IF NOT EXISTS idx_leads_phone      ON leads ((data->>'phone'));
CREATE INDEX IF NOT EXISTS idx_leads_source     ON leads ((data->>'source'));
CREATE INDEX IF NOT EXISTS idx_employees_email  ON employees ((data->>'email'));
CREATE INDEX IF NOT EXISTS idx_partners_phone   ON partners ((data->>'phone'));
CREATE INDEX IF NOT EXISTS idx_wamsg_chat       ON wa_messages ((data->>'chatId'));
CREATE INDEX IF NOT EXISTS idx_wachat_phone     ON wa_chats ((data->>'phone'));
