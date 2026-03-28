---
plan: "02-02"
status: complete
completed: "2026-03-17"
commits:
  - "feat(02-02): server/routes/people.js — CRUD + stage events"
  - "feat(02-02): server/routes/events.js — stage event queries"
  - "fix(02-02): use single-quoted SQL strings to avoid column name ambiguity in better-sqlite3"
---

# Summary: 02-02 People + Stage Events Routes

## What Was Done

- Created `server/routes/people.js` — full CRUD for people with stage event logging
- Created `server/routes/events.js` — query stage events by person_id or all events

## Files Created

- `server/routes/people.js` (new)
- `server/routes/events.js` (new)

## Bug Fixed

`datetime("now")` and `'manual'` string literals in SQL were written with double quotes in JS string literals, causing better-sqlite3 to treat them as column identifiers. Fixed by swapping outer quotes so SQL strings use double-quoted JS strings with single-quoted SQL literals.

## Endpoint Behavior

### People
- `GET /api/people` — returns all people ordered by `created_at DESC`, with `days_in_stage` computed via `julianday()` difference
- `GET /api/people/:id` — single person or 404
- `POST /api/people` — creates person + initial `stage_events` row (`from_stage: null`), returns 201
- `PATCH /api/people/:id` — partial update; if stage changes, logs a `stage_events` row and resets `stage_updated_at`
- `DELETE /api/people/:id` — hard delete; cascades to `stage_events` via FK

### Events
- `GET /api/events?person_id=X` — events for one person ordered by `timestamp DESC`
- `GET /api/events` — all events (for analytics), capped at 1000 rows

## Requirements Satisfied

- ARCH-04: `is_archived` and `archive_reason` patchable via PATCH
- ARCH-08: Stage stored on person; archiving + restoring does not reset stage
- PIPE-14: Stage transitions write to `stage_events` and reset `stage_updated_at`
- ANAL-06: No filtering on `is_archived` in events queries — all records included
- ANAL-08: Stage events derived entirely from `stage_events` table
