/**
 * One-shot: add alex_sessions.cold_postmortem_at column so the cold-lead
 * sweeper knows which sessions it already processed. Idempotent.
 */

import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js'
import { requireServiceRole } from '../_shared/auth.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
}

const MIGRATION_SQL = `
ALTER TABLE alex_sessions
  ADD COLUMN IF NOT EXISTS cold_postmortem_at timestamptz;

CREATE INDEX IF NOT EXISTS alex_sessions_cold_sweep_idx
  ON alex_sessions (customer_last_msg_at)
  WHERE cold_postmortem_at IS NULL;
`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  const gate = requireServiceRole(req); if (gate) return gate

  const dbUrl = Deno.env.get('SUPABASE_DB_URL')
  if (!dbUrl) return new Response(JSON.stringify({ error: 'no db url' }), { status: 500, headers: CORS })

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
