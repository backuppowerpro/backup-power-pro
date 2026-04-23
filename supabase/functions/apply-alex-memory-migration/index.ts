/**
 * One-shot: create alex_memory_files table + RLS + seed initial files.
 * Idempotent. Delete this function after it has run.
 */

import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js'
import { requireServiceRole } from '../_shared/auth.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
}

const MIGRATION_SQL = `
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

INSERT INTO alex_memory_files (path, content) VALUES
  ('/memories/patterns.md',   E'# Alex Patterns\\n\\nWhat Alex has learned about which lead signals predict outcomes.\\nEntries are short, testable, and anonymized — NO customer PII.\\n\\n## Template\\n- signal: <what happened in conversation>\\n- outcome: <what happened next>\\n- confidence: <low | medium | high>\\n- sample size: <approx N conversations>\\n- date: <YYYY-MM-DD>\\n'),
  ('/memories/objections.md', E'# Objection → response map\\n\\nWhat customer objections came up + which framing moved them forward.\\nAnonymized. Patterns only, no customer quotes.\\n'),
  ('/memories/openers.md',    E'# Opening message variants that got replies\\n\\nWhen a specific opener works vs stalls.\\n'),
  ('/memories/pitfalls.md',   E'# Pitfalls — things that derailed past conversations\\n\\nShort notes on phrasing / assumptions that killed a conversation.\\n')
ON CONFLICT (path) DO NOTHING;
`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  const gate = requireServiceRole(req); if (gate) return gate

  const dbUrl = Deno.env.get('SUPABASE_DB_URL')
  if (!dbUrl) return new Response(JSON.stringify({ error: 'SUPABASE_DB_URL missing' }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })

  const sql = postgres(dbUrl, { max: 1 })
  try {
    await sql.unsafe(MIGRATION_SQL)
    await sql.end()
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
  } catch (err) {
    await sql.end()
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
})
