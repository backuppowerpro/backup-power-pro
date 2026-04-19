// One-shot: add assigned_installer + installer_pay columns to contacts.
// Same pattern as apply-lead-alert-cron / apply-review-ask-cron.

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
    await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS assigned_installer text`
    await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS installer_pay numeric`
    await sql`CREATE INDEX IF NOT EXISTS contacts_installer_idx ON contacts (assigned_installer) WHERE assigned_installer IS NOT NULL`
    const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'contacts' AND column_name IN ('assigned_installer', 'installer_pay')`
    return new Response(JSON.stringify({ ok: true, columns: cols }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: CORS })
  } finally { await sql.end() }
})
