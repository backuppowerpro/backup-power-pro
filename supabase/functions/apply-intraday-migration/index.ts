// One-shot: add intraday_sent column to alex_sessions so the same-day nudge
// in alex-followup has a per-session flag to prevent double-firing.
// Safe to invoke multiple times — IF NOT EXISTS makes it idempotent.

import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js'
import { requireServiceRole } from '../_shared/auth.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  const gate = requireServiceRole(req); if (gate) return gate

  const url = Deno.env.get('DATABASE_URL') || Deno.env.get('SUPABASE_DB_URL')
  if (!url) {
    return new Response(JSON.stringify({ error: 'no DATABASE_URL' }), { status: 500, headers: CORS })
  }

  const sql = postgres(url, { ssl: 'prefer', max: 1 })
  try {
    await sql`ALTER TABLE alex_sessions ADD COLUMN IF NOT EXISTS intraday_sent BOOLEAN DEFAULT false`
    const cols = await sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'alex_sessions' AND column_name = 'intraday_sent'
    `
    return new Response(JSON.stringify({ ok: true, column: cols[0] || null }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: CORS })
  } finally {
    await sql.end()
  }
})
