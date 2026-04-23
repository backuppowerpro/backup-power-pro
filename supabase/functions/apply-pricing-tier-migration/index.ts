/**
 * One-shot: apply the Smart Pricing v1 columns (pricing_tier on contacts,
 * pricing_tier + pricing_variant on proposals). Idempotent — safe to run
 * multiple times. Delete this function after it lands.
 */

import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
}

const MIGRATION_SQL = `
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS pricing_tier text NOT NULL DEFAULT 'standard';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contacts_pricing_tier_check'
  ) THEN
    ALTER TABLE contacts
      ADD CONSTRAINT contacts_pricing_tier_check
      CHECK (pricing_tier IN ('standard', 'premium', 'premium_plus'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS contacts_pricing_tier_idx ON contacts (pricing_tier);

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS pricing_tier text,
  ADD COLUMN IF NOT EXISTS pricing_variant text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'proposals_pricing_variant_check'
  ) THEN
    ALTER TABLE proposals
      ADD CONSTRAINT proposals_pricing_variant_check
      CHECK (pricing_variant IS NULL OR pricing_variant IN ('A', 'B'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS proposals_pricing_tier_idx ON proposals (pricing_tier);
`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  const dbUrl = Deno.env.get('SUPABASE_DB_URL')
  if (!dbUrl) {
    return new Response(JSON.stringify({ error: 'SUPABASE_DB_URL not available' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  try {
    const sql = postgres(dbUrl, { max: 1 })
    await sql.unsafe(MIGRATION_SQL)
    await sql.end()

    return new Response(JSON.stringify({ success: true, message: 'pricing_tier / pricing_variant columns applied.' }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
