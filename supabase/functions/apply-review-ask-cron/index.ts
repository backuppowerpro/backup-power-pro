// One-shot installer for the auto-review-ask pg_cron schedule.
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
    await sql`CREATE EXTENSION IF NOT EXISTS pg_cron`
    await sql`CREATE EXTENSION IF NOT EXISTS pg_net`
    await sql.unsafe(`
      DO $$
      DECLARE jid bigint;
      BEGIN
        SELECT jobid INTO jid FROM cron.job WHERE jobname = 'auto-review-ask-daily';
        IF jid IS NOT NULL THEN
          PERFORM cron.unschedule(jid);
        END IF;
      END $$;
    `)
    // 14:00 UTC = 10am EDT / 9am EST. Late enough that Key is up, early
    // enough that the customer's morning coffee-scroll catches the text.
    await sql`
      SELECT cron.schedule(
        'auto-review-ask-daily',
        '0 14 * * *',
        $$ SELECT net.http_post(
          url := 'https://reowtzedjflwmlptupbk.supabase.co/functions/v1/auto-review-ask',
          headers := '{"Content-Type": "application/json"}'::jsonb,
          body := '{}'::jsonb
        ); $$
      )
    `
    const jobs = await sql`SELECT jobid, jobname, schedule FROM cron.job WHERE jobname = 'auto-review-ask-daily'`
    return new Response(JSON.stringify({ ok: true, jobs }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: CORS })
  } finally { await sql.end() }
})
