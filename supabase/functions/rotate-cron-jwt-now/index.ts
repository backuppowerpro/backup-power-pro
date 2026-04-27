/**
 * rotate-cron-jwt-now
 *
 * Brain-token-gated variant of rotate-cron-jwt. Same end effect: rewrites
 * every cron.job.command that has a stale Bearer JWT, swaps it with the
 * current SUPABASE_SERVICE_ROLE_KEY (auto-injected by Supabase), AND seeds
 * the vault secret `service_role_jwt` so the migration-driven cron schedules
 * (alex-followup-hourly, sparky-daily-digest-evening, permit-morning-check-
 * daily) that read from vault on each fire actually authenticate.
 *
 * Why a second function rather than reusing rotate-cron-jwt:
 * the original requires a one-shot nonce inserted via SQL editor, which
 * bootstraps a chicken-and-egg when you don't have local SR credentials.
 * This variant trusts the BPP_BRAIN_TOKEN header — same 32-byte secret that
 * gates crm-stats / brain-write — and self-rate-limits to once-per-5-min so
 * a leaked token can't be turned into a runaway rewriter.
 *
 * Idempotent: running it twice in a row is fine. Either path (vault upsert
 * + cron rewrite) is a no-op when nothing has changed.
 *
 * After this runs successfully, three production crons start firing:
 *   - alex-followup-hourly
 *   - sparky-daily-digest-evening
 *   - permit-morning-check-daily
 * which is what the 62-lead Stage 1 backlog (2026-04-26) is waiting for.
 *
 * POST /rotate-cron-jwt-now
 *   header  x-bpp-brain-token: <32-byte hex>
 *
 * Returns:
 *   { vault_seeded: boolean, jobs_rewritten: [{name, schedule}], schedules_recreated: [{name}] }
 */

import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js'
import { timingSafeEqual, allowRate } from '../_shared/auth.ts'

const CORS = {
  'Access-Control-Allow-Origin': 'https://backuppowerpro.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-bpp-brain-token',
  'Vary': 'Origin',
}

const json = (status: number, body: unknown) => new Response(
  JSON.stringify(body),
  { status, headers: { ...CORS, 'Content-Type': 'application/json' } },
)

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' })

  // ── Auth: brain token ─────────────────────────────────────────────────
  const BRAIN_TOKEN = Deno.env.get('BPP_BRAIN_TOKEN') || ''
  const sentToken = req.headers.get('x-bpp-brain-token') || ''
  if (!BRAIN_TOKEN || !timingSafeEqual(sentToken, BRAIN_TOKEN)) {
    console.warn('[rotate-cron-jwt-now] auth failed')
    return json(401, { error: 'unauthorized' })
  }

  // ── Rate limit (per IP, but really we just don't want anyone who somehow
  //     leaked the token to be able to rewrite crons more than once / 5min).
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!allowRate(`rotate-cron-jwt-now:${ip}`, 1)) {
    return json(429, { error: 'rate limited (1/min)' })
  }

  const currentKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!currentKey || currentKey.length < 20) {
    return json(500, { error: 'SUPABASE_SERVICE_ROLE_KEY missing in env' })
  }

  const dbUrl = Deno.env.get('SUPABASE_DB_URL')
  if (!dbUrl) {
    return json(500, { error: 'SUPABASE_DB_URL missing in env' })
  }

  const sql = postgres(dbUrl, { max: 1 })
  let vaultSeeded = false
  const rewritten: Array<{ jobname: string; schedule: string }> = []
  const reschedSecretsBacked: Array<{ jobname: string }> = []

  try {
    // ── Step 1: ensure vault.secrets.service_role_jwt is seeded with the
    //     current SR key. The cron-scheduler migrations read this on each
    //     fire — without it, alex-followup et al silent-no-op forever.
    //     vault.create_secret raises if the name already exists, so we
    //     check first; vault.update_secret is the proper path for an
    //     existing entry.
    const [existing] = await sql`
      SELECT id FROM vault.secrets WHERE name = 'service_role_jwt' LIMIT 1
    ` as Array<{ id: string }>

    if (existing) {
      await sql`SELECT vault.update_secret(${existing.id}::uuid, ${currentKey})`
    } else {
      await sql`
        SELECT vault.create_secret(
          ${currentKey},
          'service_role_jwt',
          'pg_cron / pg_net edge-function call auth (rotated by rotate-cron-jwt-now)'
        )
      `
    }
    vaultSeeded = true

    // ── Step 2: rewrite stale Bearer tokens in every existing cron.job.command.
    //     Same logic as rotate-cron-jwt: catch both quoted and unquoted Bearer
    //     concatenation styles, plus the auth-less /functions/v1/ pattern.
    const jobs: any[] = await sql`
      SELECT jobid, jobname, schedule, command
      FROM cron.job
      WHERE
        command LIKE '%Bearer eyJ%'
        OR command LIKE '%Bearer ''eyJ%'
        OR (command LIKE '%/functions/v1/%' AND command NOT LIKE '%Authorization%')
    `

    for (const j of jobs) {
      const oldCmd = String(j.command)
      let newCmd = oldCmd

      // (1) Any `Bearer eyJ...` or `Bearer 'eyJ...'` gets swapped.
      newCmd = newCmd.replace(
        /Bearer\s+'?eyJ[A-Za-z0-9._-]+'?/g,
        `Bearer ${currentKey}`,
      )

      // (2) Inject auth header when missing entirely.
      if (!/Authorization/i.test(newCmd) && /\/functions\/v1\//.test(newCmd)) {
        newCmd = newCmd.replace(
          /headers\s*:=\s*'[^']*application\/json[^']*'::jsonb/,
          `headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ${currentKey}')`,
        )
      }

      if (newCmd === oldCmd) continue

      // pg_cron doesn't have an "update command" call — unschedule + re-schedule.
      await sql`SELECT cron.unschedule(${j.jobname})`
      await sql`SELECT cron.schedule(${j.jobname}, ${j.schedule}, ${newCmd})`
      rewritten.push({ jobname: j.jobname, schedule: j.schedule })
    }

    // ── Step 3: re-apply the migration-driven schedules that depend on the
    //     vault secret. They were written to no-op when the secret was
    //     missing (which is why they've been silent). Now that we just
    //     seeded the vault, fire each migration's schedule block by hand
    //     so the cron actually appears in cron.job.
    //
    //     We don't re-run the full migration files — those have additional
    //     setup. We just call cron.schedule directly with the same name +
    //     schedule the migrations would have used. Idempotent: unschedule
    //     first, then schedule with the freshly-vault-stored JWT.
    const SCHEDULES = [
      {
        name: 'alex-followup-hourly',
        cron: '0 * * * *',
        url:  'https://reowtzedjflwmlptupbk.supabase.co/functions/v1/alex-followup',
      },
      {
        name: 'sparky-daily-digest-evening',
        cron: '0 22 * * *',  // 10pm UTC = ~6pm ET
        url:  'https://reowtzedjflwmlptupbk.supabase.co/functions/v1/sparky-daily-digest',
      },
      {
        name: 'permit-morning-check-daily',
        cron: '0 12 * * *',  // 12pm UTC = 8am ET (DST) / 7am ET (winter)
        url:  'https://reowtzedjflwmlptupbk.supabase.co/functions/v1/permit-morning-check',
      },
      {
        // 14:00 UTC = 10am EDT / 9am EST. Texts go out 24–72h post-stage-9
        // when customers are at peak happiness with the new install. Each
        // 5★ Google review compounds the GBP organic loop. Apr 27: confirmed
        // this cron was either unscheduled OR scheduled without auth, so
        // adding it here as a guaranteed schedule with the fresh SR JWT.
        name: 'auto-review-ask-daily',
        cron: '0 14 * * *',
        url:  'https://reowtzedjflwmlptupbk.supabase.co/functions/v1/auto-review-ask',
      },
      {
        // 13:00 UTC = 9am EDT. Daily zero-day alert: if yesterday saw 0
        // leads through the form, page Key. Catches form-broken-overnight
        // scenarios before another full day of ad spend wastes.
        name: 'lead-volume-alert-daily',
        cron: '30 13 * * *',
        url:  'https://reowtzedjflwmlptupbk.supabase.co/functions/v1/lead-volume-alert',
      },
      {
        // 02:00 UTC daily — Alex cold-lead sweeper. Closes post-mortem
        // analysis on sessions that went cold (≥30d no reply) so the
        // learning loop captures dead leads, not just bookings.
        name: 'alex-cold-lead-sweep-daily',
        cron: '0 2 * * *',
        url:  'https://reowtzedjflwmlptupbk.supabase.co/functions/v1/alex-cold-lead-sweep',
      },
      {
        // 03:00 UTC daily — Alex ghost follow-up sender. Sends day-1 / day-3
        // / day-7 ghost messages to alex_sessions that went silent.
        name: 'alex-ghost-daily',
        cron: '0 3 * * *',
        url:  'https://reowtzedjflwmlptupbk.supabase.co/functions/v1/alex-ghost',
      },
      {
        // 15:00 UTC = 11am EDT. Daily proposal-nudge — finds un-signed
        // proposals ≥18h old and sends a smart F/U based on view_count
        // (0 / 1-2 / 3+). Capped at 2 nudges per proposal lifetime.
        // Apr 27: shipped to lift the 1.2% 30d close rate.
        name: 'proposal-nudge-daily',
        cron: '0 15 * * *',
        url:  'https://reowtzedjflwmlptupbk.supabase.co/functions/v1/proposal-nudge',
      },
    ]

    for (const s of SCHEDULES) {
      const cmd = `SELECT net.http_post(
  url := '${s.url}',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ${currentKey}'
  ),
  body := '{}'::jsonb
);`
      try {
        await sql`SELECT cron.unschedule(${s.name})`
      } catch (_) { /* not yet scheduled — fine */ }
      await sql`SELECT cron.schedule(${s.name}, ${s.cron}, ${cmd})`
      reschedSecretsBacked.push({ jobname: s.name })
    }

    await sql.end()
    return json(200, {
      success: true,
      vault_seeded: vaultSeeded,
      jobs_rewritten: rewritten,
      schedules_recreated: reschedSecretsBacked,
    })
  } catch (err: any) {
    try { await sql.end() } catch (_) { /* ignore */ }
    console.error('[rotate-cron-jwt-now] error:', err?.message || err)
    return json(500, {
      error: 'rotate failed',
      detail: String(err?.message || err).slice(0, 400),
      vault_seeded: vaultSeeded,
      jobs_rewritten: rewritten,
    })
  }
})
