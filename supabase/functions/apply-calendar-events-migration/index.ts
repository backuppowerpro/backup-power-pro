// One-shot: create calendar_events table so the v2 calendar can show more
// than just contact.install_date rows. Supports standalone notes ("material
// pickup", "sub check-in", "inspection walk-through"), contact-linked events
// beyond the single install_date, and future recurring patterns.
// Idempotent via CREATE TABLE IF NOT EXISTS.

import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  const url = Deno.env.get('DATABASE_URL') || Deno.env.get('SUPABASE_DB_URL')
  if (!url) {
    return new Response(JSON.stringify({ error: 'no DATABASE_URL' }), { status: 500, headers: CORS })
  }

  const sql = postgres(url, { ssl: 'prefer', max: 1 })
  try {
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS calendar_events (
        id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
        title         text        NOT NULL,
        start_at      timestamptz NOT NULL,
        end_at        timestamptz,
        contact_id    uuid        REFERENCES contacts(id) ON DELETE CASCADE,
        notes         text,
        event_type    text        NOT NULL DEFAULT 'other',
        created_at    timestamptz NOT NULL DEFAULT now(),
        updated_at    timestamptz NOT NULL DEFAULT now()
      );
    `)
    // Index for fast week-range queries
    await sql`CREATE INDEX IF NOT EXISTS calendar_events_start_idx ON calendar_events (start_at DESC)`
    await sql`CREATE INDEX IF NOT EXISTS calendar_events_contact_idx ON calendar_events (contact_id)`

    // RLS — service role only, same pattern as sparky_inbox / alex_sessions.
    // The CRM uses the anon key + Supabase auth session, which counts as
    // "authenticated" — add a policy so logged-in users have full access.
    await sql.unsafe(`
      ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS "authenticated full access" ON calendar_events;
      CREATE POLICY "authenticated full access" ON calendar_events
        FOR ALL
        TO authenticated
        USING (true)
        WITH CHECK (true);
      DROP POLICY IF EXISTS "service role full access" ON calendar_events;
      CREATE POLICY "service role full access" ON calendar_events
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
    `)

    // Enable realtime on the table so the CRM calendar view sees inserts /
    // updates without polling.
    try {
      await sql.unsafe(`ALTER PUBLICATION supabase_realtime ADD TABLE calendar_events`)
    } catch (_) {
      // Already added — supabase throws; swallow and move on.
    }

    const cols = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'calendar_events'
      ORDER BY ordinal_position
    `
    return new Response(JSON.stringify({ ok: true, columns: cols }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: CORS })
  } finally {
    await sql.end()
  }
})
