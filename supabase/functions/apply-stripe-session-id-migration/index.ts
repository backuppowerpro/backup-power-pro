// One-shot: add stripe_session_id column to payments table.
//
// The stripe-webhook edge function references this column (3 sites) but it
// was never created. Result: every Stripe checkout completion fails to
// record a payment row, even though the invoice gets marked paid and the
// Meta CAPI Purchase event fires. Payments table silently falls out of sync.
//
// Idempotent — ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.

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
    await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS stripe_session_id text`
    await sql`CREATE INDEX IF NOT EXISTS payments_stripe_session_id_idx ON payments (stripe_session_id) WHERE stripe_session_id IS NOT NULL`
    const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'payments' ORDER BY ordinal_position`
    return new Response(JSON.stringify({ ok: true, payments_columns: cols.map(c => c.column_name) }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
  } finally {
    await sql.end({ timeout: 5 })
  }
})
