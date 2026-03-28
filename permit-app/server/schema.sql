CREATE TABLE IF NOT EXISTS people (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  notes TEXT,
  stage INTEGER NOT NULL DEFAULT 1 CHECK(stage BETWEEN 1 AND 9),
  stage_updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_archived INTEGER NOT NULL DEFAULT 0,
  archive_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stage_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  from_stage INTEGER,
  to_stage INTEGER NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('manual', 'webhook', 'auto-archive'))
);

CREATE TABLE IF NOT EXISTS jurisdictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  portal_url TEXT,
  username TEXT,
  password TEXT,
  phone TEXT,
  notes TEXT,
  logo_url TEXT,
  background_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS webhook_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  payload_summary TEXT,
  person_id INTEGER,
  received_at TEXT NOT NULL DEFAULT (datetime('now'))
);
