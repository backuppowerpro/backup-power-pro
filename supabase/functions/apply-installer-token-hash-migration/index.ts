/**
 * One-shot: add token_hash column + backfill existing installer_tokens
 * with SHA-256 hashes. After this runs, sub-schedule and sub-mark-complete
 * accept either the plaintext path (legacy) or the hashed path. Delete
 * this function after it has run.
 */

import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js'
import { requireServiceRole } from '../_shared/auth.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
}

const MIGRATION_SQL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE installer_tokens
  ADD COLUMN IF NOT EXISTS token_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS installer_tokens_token_hash_uidx
  ON installer_tokens (token_hash)
  WHERE token_hash IS NOT NULL;

UPDATE installer_tokens
   SET token_hash = encode(digest(token, 'sha256'), 'hex')
 WHERE token IS NOT NULL AND token_hash IS NULL;
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
