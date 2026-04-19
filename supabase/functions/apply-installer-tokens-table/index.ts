// One-shot: create the installer_tokens table used by sub-schedule.
// Idempotent. Safe to delete after first successful invocation.

import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  const url = Deno.env.get('DATABASE_URL') || Deno.env.get('SUPABASE_DB_URL')
  if (!url) return new Response(JSON.stringify({ error: 'no DATABASE_URL' }), { status: 500, headers: CORS })

  const sql = postgres(url, { ssl: 'prefer', max: 1 })
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS installer_tokens (
        token text PRIMARY KEY,
        installer_name text NOT NULL,
        created_at timestamptz DEFAULT now(),
        revoked_at timestamptz
      )
    `
    await sql`CREATE INDEX IF NOT EXISTS installer_tokens_name_idx ON installer_tokens (installer_name)`

    // Seed Key's own token ONLY if no token exists for him yet. Uses
    // gen_random_uuid() so a fresh install starts with an unguessable
    // value. The old hardcoded 'key-dev-token-please-rotate' seed is
    // kept out intentionally — it was rotated on 2026-04-19 and
    // re-running this one-shot should not recreate a weak default.
    await sql`
      INSERT INTO installer_tokens (token, installer_name)
      SELECT gen_random_uuid()::text, 'Key'
      WHERE NOT EXISTS (
        SELECT 1 FROM installer_tokens WHERE installer_name = 'Key' AND revoked_at IS NULL
      )
    `
    const count = await sql`SELECT count(*) AS n FROM installer_tokens`
    return new Response(JSON.stringify({ ok: true, rowCount: count[0].n }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: CORS })
  } finally { await sql.end() }
})
