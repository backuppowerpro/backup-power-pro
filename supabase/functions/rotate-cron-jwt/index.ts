/**
 * One-shot: refresh the Bearer JWT embedded in every cron.job.command.
 *
 * Why this exists:
 * When Supabase rotated the service-role JWT on 2026-04-23, the edge-function
 * env `SUPABASE_SERVICE_ROLE_KEY` was updated but the Bearer tokens that had
 * been baked into existing pg_cron schedules (alex-followup-hourly,
 * lead-volume-alert-daily, sparky-daily-digest-evening, …) were NOT updated.
 * Every scheduled run has been silently returning 401 since then.
 *
 * This function reads its own current `SUPABASE_SERVICE_ROLE_KEY` at runtime
 * (which Supabase keeps fresh) and rewrites every cron.job.command that has a
 * legacy-looking Bearer token, replacing it with the current key. After this
 * runs once, all cron → edge calls authenticate correctly again.
 *
 * Security:
 * - Auth is via a short-lived nonce stored in `public.bpp_one_shot_nonce`.
 *   The caller INSERTs a random nonce via SQL (CLI `supabase db query`),
 *   then calls this endpoint with ?nonce=<value>. We require the nonce to
 *   be <5 min old and delete it after successful use so it can't be replayed.
 * - We NEVER return the service-role key itself. Only the list of job names
 *   rewritten.
 *
 * Delete this function after the rotation is done and the crons are healthy.
 */

import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  const url = new URL(req.url)
  const nonce = url.searchParams.get('nonce') || ''
  if (!nonce || nonce.length < 16) {
    return new Response(JSON.stringify({ error: 'nonce query param (>=16 chars) required' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const currentKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!currentKey || currentKey.length < 20) {
    return new Response(JSON.stringify({ error: 'current SUPABASE_SERVICE_ROLE_KEY missing' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const dbUrl = Deno.env.get('SUPABASE_DB_URL')
  if (!dbUrl) {
    return new Response(JSON.stringify({ error: 'SUPABASE_DB_URL missing' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const sql = postgres(dbUrl, { max: 1 })
  try {
    // Nonce check + consume.
    await sql`CREATE TABLE IF NOT EXISTS public.bpp_one_shot_nonce (
      nonce text PRIMARY KEY,
      created_at timestamptz NOT NULL DEFAULT now()
    )`
    const [row] = await sql`
      SELECT nonce FROM public.bpp_one_shot_nonce
      WHERE nonce = ${nonce} AND created_at > now() - interval '5 minutes'
    `
    if (!row) {
      await sql.end()
      return new Response(JSON.stringify({ error: 'nonce not found or expired' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    await sql`DELETE FROM public.bpp_one_shot_nonce WHERE nonce = ${nonce}`

    // Pull every cron.job.command that either (a) embeds a Bearer eyJ… token
    // (legacy JWT) or (b) calls a /functions/v1/… edge function without any
    // Authorization header at all (auto-review-ask, lead-volume-alert were
    // scheduled without auth and have been silently 401ing).
    const jobs: any[] = await sql`
      SELECT jobid, jobname, schedule, command
      FROM cron.job
      WHERE
        command LIKE '%Bearer eyJ%'
        OR command LIKE '%Bearer ''eyJ%'
        OR (command LIKE '%/functions/v1/%' AND command NOT LIKE '%Authorization%')
    `

    const rewritten: any[] = []
    for (const j of jobs) {
      const oldCmd = String(j.command)
      let newCmd = oldCmd

      // (1) Any `Bearer eyJ...` or `Bearer 'eyJ...'` (both concatenation
      //     styles) gets swapped for the current service-role key.
      newCmd = newCmd.replace(
        /Bearer\s+'?eyJ[A-Za-z0-9._-]+'?/g,
        `Bearer ${currentKey}`
      )

      // (2) If the command has no Authorization header at all but is a
      //     functions/v1/ call, inject the auth into the headers jsonb.
      if (!/Authorization/i.test(newCmd) && /\/functions\/v1\//.test(newCmd)) {
        // Look for either:
        //   headers := '{"Content-Type": "application/json"}'::jsonb
        //   headers := '{"Content-Type":"application/json"}'::jsonb
        // and replace with a jsonb_build_object that includes Bearer auth.
        newCmd = newCmd.replace(
          /headers\s*:=\s*'[^']*application\/json[^']*'::jsonb/,
          `headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ${currentKey}')`
        )
      }

      if (newCmd === oldCmd) continue

      // Re-schedule: pg_cron doesn't have a pure "update command" call,
      // so we unschedule + re-schedule with the same name + schedule.
      await sql`SELECT cron.unschedule(${j.jobname})`
      await sql`SELECT cron.schedule(${j.jobname}, ${j.schedule}, ${newCmd})`
      rewritten.push({ jobname: j.jobname, schedule: j.schedule })
    }

    await sql.end()
    return new Response(JSON.stringify({
      success: true,
      rewritten_count: rewritten.length,
      rewritten,
      note: 'Do NOT return the key. Key stays server-side.',
    }, null, 2), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    await sql.end().catch(() => {})
    return new Response(JSON.stringify({ error: String(err).slice(0, 400) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
