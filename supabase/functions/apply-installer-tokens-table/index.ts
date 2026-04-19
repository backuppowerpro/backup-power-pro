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

    // Insert Key's own token so the portal works for him too (useful while
    // testing). Token is deterministic here; rotate via UPDATE if leaked.
    await sql`
      INSERT INTO installer_tokens (token, installer_name)
      VALUES ('key-dev-token-please-rotate', 'Key')
      ON CONFLICT (token) DO NOTHING
    `
    const count = await sql`SELECT count(*) AS n FROM installer_tokens`
    return new Response(JSON.stringify({ ok: true, rowCount: count[0].n }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: CORS })
  } finally { await sql.end() }
})
