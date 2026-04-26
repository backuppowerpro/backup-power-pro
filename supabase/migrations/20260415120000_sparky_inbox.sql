-- sparky_inbox: agents report here, Sparky reads and surfaces to Key
-- Nothing in this table auto-sends to customers. Key approves all actions in CRM.

CREATE TABLE IF NOT EXISTS sparky_inbox (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  agent          text        NOT NULL,            -- 'alex' | 'permit' | 'pipeline' | 'brief'
  contact_id     uuid        REFERENCES contacts(id) ON DELETE SET NULL,
  priority       text        NOT NULL DEFAULT 'normal', -- 'urgent' | 'normal' | 'fyi'
  summary        text        NOT NULL,            -- plain English: what happened
  draft_reply    text,                            -- suggested SMS to customer (NOT sent — Key approves)
  suggested_action text,                          -- what Sparky recommends Key do
  read           boolean     NOT NULL DEFAULT false,
  actioned       boolean     NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Index for fast unread fetches
CREATE INDEX IF NOT EXISTS sparky_inbox_unread ON sparky_inbox (read, created_at DESC);

-- RLS: service role only (agents write, CRM reads via service role key)
ALTER TABLE sparky_inbox ENABLE ROW LEVEL SECURITY;

-- Explicit TO service_role — without it Postgres defaults to TO PUBLIC
-- (anon + authenticated + service_role). Hardened in
-- 20260423_rls_hardening.sql.
CREATE POLICY "service role full access" ON sparky_inbox
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
