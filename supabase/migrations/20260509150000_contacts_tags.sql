-- Move per-contact tags from localStorage to a `contacts.tags` column
-- so tags sync between desktop and mobile. Same bug class as the
-- pinned-contacts fix earlier today (migration 20260509140000) — flagged
-- by audit-crm.sh on 2026-05-09 evening.
--
-- TEXT[] (array) lets us add multiple tags per contact, query with
-- @> containment, and avoid a join table for what's a small per-row
-- list (24-char cap × maybe 5-10 tags).

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

-- GIN index supports `where tags @> '{vip}'` queries that would surface
-- contacts with a given tag fast. Cheap to add now; expensive to add
-- after the table grows.
CREATE INDEX IF NOT EXISTS idx_contacts_tags
  ON contacts USING GIN (tags);
