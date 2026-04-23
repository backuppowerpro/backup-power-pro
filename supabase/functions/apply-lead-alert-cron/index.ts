// One-shot: apply the lead-volume-alert cron schedule.
// Safe to call multiple times — unschedule-then-reschedule is idempotent.
// After this runs once successfully, the function can be deleted.

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
    await sql`CREATE EXTENSION IF NOT EXISTS pg_cron`
    await sql`CREATE EXTENSION IF NOT EXISTS pg_net`

    // Unschedule prior same-named job, then schedule fresh
    await sql.unsafe(`
      DO $$
      DECLARE jid bigint;
      BEGIN
        SELECT jobid INTO jid FROM cron.job WHERE jobname = 'lead-volume-alert-daily';
        IF jid IS NOT NULL THEN
          PERFORM cron.unschedule(jid);
        END IF;
      END $$;
    `)

    await sql`
      SELECT cron.schedule(
        'lead-volume-alert-daily',
        '30 12 * * *',
        $$ SELECT net.http_post(
          url := 'https://reowtzedjflwmlptupbk.supabase.co/functions/v1/lead-volume-alert',
          headers := '{"Content-Type": "application/json"}'::jsonb,
          body := '{}'::jsonb
        ); $$
      )
    `

    const jobs = await sql`SELECT jobid, jobname, schedule FROM cron.job WHERE jobname = 'lead-volume-alert-daily'`
    return new Response(JSON.stringify({ ok: true, jobs }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: CORS })
  } finally {
    await sql.end()
  }
})
