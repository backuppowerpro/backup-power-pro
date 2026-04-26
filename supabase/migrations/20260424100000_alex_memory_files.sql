-- Backing storage for Alex's client-side memory tool (memory_20250818).
-- Each row is one file in Alex's /memories/ virtual filesystem. The
-- memory tool's commands (view / create / str_replace / insert / delete
-- / rename) all operate on this table.
--
-- PII scrubbing happens in the edge function on write (regex strips
-- phones, names, addresses, prices) so the content stored here should
-- be anonymized patterns only — cross-customer learnings, not
-- individual conversations. Per-contact state still lives in sparky_memory.
--
-- RLS: service role only. The CRM doesn't talk to this table directly;
-- the only reader/writer is the alex-agent edge function.

CREATE TABLE IF NOT EXISTS alex_memory_files (
  path        text        PRIMARY KEY,
  content     text        NOT NULL DEFAULT '',
  updated_at  timestamptz NOT NULL DEFAULT now(),
  size_bytes  integer     GENERATED ALWAYS AS (octet_length(content)) STORED
);

CREATE INDEX IF NOT EXISTS alex_memory_files_updated_at_idx
  ON alex_memory_files (updated_at DESC);

ALTER TABLE alex_memory_files ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'alex_memory_files' AND policyname = 'alex_memory_files_service_role_all') THEN
    CREATE POLICY alex_memory_files_service_role_all ON alex_memory_files
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END$$;

-- Seed the initial directory structure so Alex's first view /memories
-- call returns a sensible layout instead of an empty dir.
INSERT INTO alex_memory_files (path, content) VALUES
  ('/memories/patterns.md',   '# Alex Patterns

What Alex has learned about which lead signals predict outcomes.
Entries are short, testable, and anonymized — NO customer PII.

## Template
- signal: <what happened in conversation>
- outcome: <what happened next>
- confidence: <low | medium | high>
- sample size: <approx N conversations>
- date: <YYYY-MM-DD>
'),
  ('/memories/objections.md', '# Objection → response map

What customer objections came up + which framing moved them forward.
Anonymized. Patterns only, no customer quotes.
'),
  ('/memories/openers.md',    '# Opening message variants that got replies

When a specific opener works vs stalls. Alex A/B tests openers
in quo-ai-new-lead; this log captures the learnings so the next
conversation picks the best-performing style.
'),
  ('/memories/pitfalls.md',   '# Pitfalls — things that derailed past conversations

Short notes on phrasing / assumptions that killed a conversation.
Write a line here whenever you catch yourself saying the wrong thing.
')
ON CONFLICT (path) DO NOTHING;
