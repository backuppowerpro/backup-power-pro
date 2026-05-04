-- bpp_todos: simple Key-facing todo list, populated by 5am cron + manual adds.
-- Lives next to the Jurisdiction filter in the Permits view of CRM v2.
--
-- Design notes:
-- - source='ai' rows come from morning-todos edge function (run at 5am ET)
-- - source='manual' rows come from Key typing in the inline input
-- - generated_for_date dedupes AI runs (one batch per day; running cron twice
--   in a row is idempotent — we look at this date before inserting)
-- - RLS: locked down. authenticated users (Key) can read/write/delete their
--   rows. service_role (edge functions / cron) full access. anon blocked.

CREATE TABLE IF NOT EXISTS bpp_todos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 TEXT NOT NULL,
  notes                 TEXT,
  source                TEXT NOT NULL CHECK (source IN ('ai', 'manual')),
  priority              SMALLINT CHECK (priority BETWEEN 1 AND 5),
  related_contact_id    UUID REFERENCES contacts(id) ON DELETE SET NULL,
  completed             BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_for_date    DATE,
  CONSTRAINT bpp_todos_completed_consistency
    CHECK ((completed IS FALSE AND completed_at IS NULL) OR (completed IS TRUE AND completed_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_bpp_todos_open       ON bpp_todos(completed, created_at DESC) WHERE completed IS FALSE;
CREATE INDEX IF NOT EXISTS idx_bpp_todos_ai_for_day ON bpp_todos(generated_for_date) WHERE source = 'ai';

ALTER TABLE bpp_todos ENABLE ROW LEVEL SECURITY;

-- Key (authenticated user) full access. BPP is single-operator so no per-user scoping.
DROP POLICY IF EXISTS "key_full_access_bpp_todos" ON bpp_todos;
CREATE POLICY "key_full_access_bpp_todos" ON bpp_todos
  FOR ALL TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

-- service_role bypasses RLS by default (used by edge functions + cron); no
-- explicit policy needed but documented for clarity.

-- anon: blocked by default (no policy granting access).
