---
plan: "02-01"
status: complete
completed: "2026-03-17"
commits:
  - "feat(02-01): install better-sqlite3"
  - "feat(02-01): server/db.js — better-sqlite3 singleton"
  - "feat(02-01): schema.sql + migrate.js + wire into server"
  - "feat(02-01): seed.js — 7 pre-loaded jurisdictions"
---

# Summary: 02-01 Database Foundation

## What Was Done

- Installed `better-sqlite3` (^11.0.0) in `server/`
- Created `server/db.js` — exports a singleton `db` instance with WAL mode and foreign keys enabled
- Created `server/schema.sql` — defines all 4 tables: `people`, `stage_events`, `jurisdictions`, `webhook_log`
- Created `server/migrate.js` — exports `runMigrations()` which runs schema.sql via `db.exec()`
- Created `server/seed.js` — exports `seedJurisdictions()` with idempotent count check, inserts 7 jurisdictions in a transaction
- Updated `server/index.js` to call `runMigrations()` and `seedJurisdictions()` on startup

## Files Created/Modified

- `server/db.js` (new)
- `server/schema.sql` (new)
- `server/migrate.js` (new)
- `server/seed.js` (new)
- `server/index.js` (modified — added 4 import lines + 2 startup calls)
- `server/package.json` (modified — better-sqlite3 added to dependencies)

## Verification

- Server starts clean, prints `[DB] Schema applied` and `[DB] Seeded 7 jurisdictions` on first run
- Second run prints `[DB] Jurisdictions already seeded, skipping` — idempotent confirmed
- `permit-manager.db` created at `server/permit-manager.db`

## Requirements Satisfied

- ARCH-04: `is_archived` + `archive_reason` columns on people table
- ARCH-11: `archive_reason` values constrained via schema (enforced in archive logic)
- JURI-09: 7 jurisdictions pre-loaded at first run
- JURI-10: Seed is idempotent — count check prevents duplicates
- JURI-11: Passwords stored as plaintext in SQLite
- AUTO-13: `webhook_log` table created
- ANAL-08: `people` and `stage_events` tables are the source of all analytics
- PIPE-14: `stage_updated_at` column present for time-in-stage computation
