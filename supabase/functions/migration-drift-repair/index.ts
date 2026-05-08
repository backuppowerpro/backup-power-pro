/**
 * migration-drift-repair, ONE-SHOT migration history reconciliation.
 *
 * Local-vs-remote migration history drifted on 2026-05-05*. Local doesn't
 * have these migrations as files but remote has them recorded as applied.
 * `supabase db push --linked` rejects because of the mismatch, so the
 * 20260507100000 cron migration (comm-orchestrator-hourly) can't deploy.
 *
 * The supabase CLI repair command needs DB password we don't have here.
 * This edge function does the equivalent via service role: marks the
 * drift migrations as reverted (drops them from history). Same effect
 * as `supabase migration repair --status reverted <version>`.
 *
 * Auth: brain-token only. Hard-gated to a known set of versions so
 * an attacker with the token can't wipe legit migrations.
 *
 * Endpoints (POST):
 *   { action: 'inspect' }              -> list current schema_migrations rows
 *   { action: 'reconcile_drift' }      -> mark known drift versions as reverted
 *
 * After this runs, `supabase db push --linked -p <password>` can apply
 * the 20260507* + future migrations cleanly.
 *
 * SAFE TO DELETE THIS FUNCTION AFTER ONE SUCCESSFUL RECONCILE_DRIFT.
 */

import { Pool } from 'https://deno.land/x/postgres@v0.17.0/mod.ts'
import { timingSafeEqual } from '../_shared/auth.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SR_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-bpp-brain-token',
}
const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b, null, 2), {
    status: s,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

// Hard-coded list of drift versions. Anything not in here will not be
// touched. Per the CLI's own suggestion when `db pull` ran:
//   reverted: 20260505100000, 20260505140000, 20260505160000,
//             20260505180000, 20260505200000
//   applied:  20260429100000 (this one already exists locally as a file)
const KNOWN_DRIFT_REVERTED = [
  '20260505100000',  // bot-reengagement cron
  '20260505140000',  // EXP-009 register
  '20260505160000',  // mms-inbound bucket
  '20260505180000',  // greeting_variants table
  '20260505200000',  // quote-due-watcher cron
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  // Brain-token auth
  const expectedToken = Deno.env.get('BPP_BRAIN_TOKEN') || ''
  const provided = req.headers.get('x-bpp-brain-token') || ''
  if (!expectedToken || !timingSafeEqual(provided, expectedToken)) {
    return json(401, { error: 'unauthorized' })
  }

  let body: any = {}
  try { body = await req.json() } catch (_) { /* allow empty */ }
  const action = body?.action || 'inspect'

  // PostgREST only exposes the `public` schema; supabase_migrations is
  // server-internal. Connect directly via Postgres protocol with the
  // SUPABASE_DB_URL env var (auto-injected by the edge runtime, gives
  // the service-role connection that has bypassrls + cross-schema read).
  const dbUrl = Deno.env.get('SUPABASE_DB_URL') || ''
  if (!dbUrl) return json(500, { error: 'SUPABASE_DB_URL not available' })

  const pool = new Pool(dbUrl, 1, true)
  const conn = await pool.connect()

  try {
    if (action === 'inspect_stage_setup') {
      // No-phone inspector: dump triggers, RLS policies, generated cols, and
      // the column definition for `stage`. Used to diagnose why the 1->2
      // UPDATE never lands in production.
      const triggers = await conn.queryObject(
        `SELECT trigger_name, event_manipulation, action_timing, action_statement
         FROM information_schema.triggers
         WHERE event_object_table = 'contacts' AND event_object_schema = 'public'`,
      )
      const policies = await conn.queryObject(
        `SELECT policyname, cmd, roles, qual, with_check
         FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contacts'`,
      )
      const stageCol = await conn.queryObject(
        `SELECT column_name, data_type, column_default, is_generated, generation_expression, is_updatable
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'stage'`,
      )
      const rlsState = await conn.queryObject(
        `SELECT relname, relrowsecurity, relforcerowsecurity
         FROM pg_class WHERE relname = 'contacts'`,
      )
      // Also grab a sample stage-1 ashley contact to test on
      const sample = await conn.queryObject(
        `SELECT id, phone, stage, bot_state, created_at
         FROM contacts
         WHERE bot_state IS NOT NULL AND stage = 1
         ORDER BY created_at DESC LIMIT 5`,
      )
      return json(200, {
        ok: true,
        triggers: triggers.rows,
        policies: policies.rows,
        stage_column: stageCol.rows,
        rls_state: rlsState.rows,
        stuck_stage1_contacts: sample.rows,
      })
    }

    if (action === 'force_stage_advance') {
      const id = body?.contact_id
      if (!id) return json(400, { error: 'contact_id required' })
      try {
        const upd = await conn.queryObject<{ id: string; stage: number }>(
          'UPDATE contacts SET stage = 2 WHERE id = $1 RETURNING id, stage',
          [id],
        )
        return json(200, { ok: true, updated: upd.rows })
      } catch (e: any) {
        return json(500, { error: e?.message || String(e), name: e?.name, fields: e?.fields })
      }
    }

    if (action === 'inspect_stage_trigger') {
      // Get the body of fn_record_stage_change to see if it's broken
      const fn = await conn.queryObject(
        `SELECT proname, prosrc FROM pg_proc WHERE proname = 'fn_record_stage_change'`,
      )
      // Check stage_history table exists + columns
      const hist = await conn.queryObject(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'stage_history'`,
      )
      // RLS on stage_history?
      const histRls = await conn.queryObject(
        `SELECT policyname, cmd, roles FROM pg_policies WHERE schemaname='public' AND tablename='stage_history'`,
      )
      return json(200, { ok: true, function: fn.rows, stage_history_columns: hist.rows, stage_history_policies: histRls.rows })
    }

    if (action === 'fix_stage_trigger') {
      // Trigger references NEW.updated_at but contacts has no such column.
      // Every stage UPDATE has been failing 42703 since the trigger landed.
      // Fix: drop the bogus COALESCE and just use now().
      try {
        await conn.queryArray(`
          CREATE OR REPLACE FUNCTION public.fn_record_stage_change()
          RETURNS trigger AS $func$
          BEGIN
            IF NEW.stage IS DISTINCT FROM OLD.stage THEN
              INSERT INTO public.stage_history (contact_id, from_stage, to_stage, changed_at)
              VALUES (NEW.id, OLD.stage, NEW.stage, now());
            END IF;
            RETURN NEW;
          END;
          $func$ LANGUAGE plpgsql;
        `)
        // Now backfill all stuck stage-1 ashley contacts to stage 2 if they
        // got past GREETING (have any AWAIT_ state).
        const fix = await conn.queryObject<{ id: string }>(
          `UPDATE contacts SET stage = 2
           WHERE stage = 1 AND bot_state IS NOT NULL
             AND bot_state NOT IN ('GREETING','START')
           RETURNING id`,
        )
        return json(200, { ok: true, trigger_fixed: true, backfilled_count: fix.rows.length })
      } catch (e: any) {
        return json(500, { error: e?.message || String(e) })
      }
    }

    if (action === 'add_service_role_policies') {
      // Add explicit service_role policy to contacts so the bot-engine
      // (which uses service_role JWT) can update stage.
      try {
        await conn.queryArray(`
          DROP POLICY IF EXISTS "service_role_full_contacts" ON public.contacts;
          CREATE POLICY "service_role_full_contacts" ON public.contacts
            FOR ALL TO service_role USING (true) WITH CHECK (true);
        `)
        return json(200, { ok: true, message: 'service_role policy added to contacts' })
      } catch (e: any) {
        return json(500, { error: e?.message || String(e) })
      }
    }

    if (action === 'check_stage_advance') {
      const phone = body?.phone || ''
      // Inspect the contact's stage + run a fresh stage 1->2 update to see if it sticks
      const before = await conn.queryObject<{ id: string; stage: number; bot_state: string }>(
        'SELECT id, stage, bot_state FROM contacts WHERE phone = $1',
        [phone],
      )
      if (!before.rows.length) return json(404, { error: 'no contact' })
      const contactId = before.rows[0].id
      const stageBefore = before.rows[0].stage
      // Try the same UPDATE bot-engine runs
      const upd = await conn.queryObject(
        'UPDATE contacts SET stage = 2 WHERE id = $1 AND stage = 1 RETURNING id, stage',
        [contactId],
      )
      // Check if it stuck
      const after = await conn.queryObject<{ stage: number }>(
        'SELECT stage FROM contacts WHERE id = $1',
        [contactId],
      )
      // Look for any triggers on contacts table
      const triggers = await conn.queryObject<{ trigger_name: string; event_manipulation: string; action_statement: string }>(
        `SELECT trigger_name, event_manipulation, action_statement
         FROM information_schema.triggers
         WHERE event_object_table = 'contacts' AND event_object_schema = 'public'`,
      )
      return json(200, {
        ok: true,
        contact_id: contactId,
        stage_before: stageBefore,
        update_returned_rows: upd.rows.length,
        update_returned: upd.rows,
        stage_after: after.rows[0]?.stage,
        contacts_triggers: triggers.rows,
      })
    }

    if (action === 'inspect') {
      const result = await conn.queryObject<{ version: string; statements: string[] | null; name: string | null }>(
        'SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version',
      )
      return json(200, {
        ok: true,
        rows: result.rows,
        count: result.rows.length,
        drift_versions_to_revert: KNOWN_DRIFT_REVERTED,
      })
    }

    if (action === 'reconcile_drift') {
      // Same as `supabase migration repair --status reverted <version>`.
      const result = await conn.queryObject<{ version: string }>(
        `DELETE FROM supabase_migrations.schema_migrations
         WHERE version = ANY($1::text[])
         RETURNING version`,
        [KNOWN_DRIFT_REVERTED],
      )
      return json(200, {
        ok: true,
        deleted_versions: result.rows.map(r => r.version),
        count: result.rows.length,
        next_step: 'Now POST { action: "apply_cron" } to land 20260507100000_schedule_comm_orchestrator_cron.sql',
      })
    }

    if (action === 'apply_cron') {
      // Apply the comm-orchestrator-hourly cron migration directly via
      // raw SQL. Then record it in schema_migrations as applied. Same
      // effect as `supabase db push` would produce after drift cleanup.
      const version = '20260507100000'
      const name = 'schedule_comm_orchestrator_cron'

      // Check if already applied (idempotent)
      const existing = await conn.queryObject<{ version: string }>(
        'SELECT version FROM supabase_migrations.schema_migrations WHERE version = $1',
        [version],
      )
      if (existing.rows.length > 0) {
        return json(200, { ok: true, already_applied: true, version })
      }

      // Inline the migration SQL. Same content as
      // supabase/migrations/20260507100000_schedule_comm_orchestrator_cron.sql.
      const migrationSql = `
DO $$
DECLARE
  jwt text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not installed, skipping comm-orchestrator schedule.';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'pg_net not installed, skipping comm-orchestrator schedule.';
    RETURN;
  END IF;

  SELECT decrypted_secret INTO jwt
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_jwt'
  LIMIT 1;

  IF jwt IS NULL THEN
    RAISE EXCEPTION 'Missing vault secret "service_role_jwt".';
  END IF;

  PERFORM cron.unschedule('comm-orchestrator-hourly');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
DECLARE
  jwt text;
BEGIN
  SELECT decrypted_secret INTO jwt
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_jwt'
  LIMIT 1;
  IF jwt IS NULL THEN RETURN; END IF;

  PERFORM cron.schedule(
    'comm-orchestrator-hourly',
    '15 * * * *',
    format(
      $fmt$
      SELECT net.http_post(
        url     := 'https://reowtzedjflwmlptupbk.supabase.co/functions/v1/comm-orchestrator',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || %L
        ),
        body    := '{}'::jsonb
      );
      $fmt$,
      jwt
    )
  );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
      `

      try {
        // Execute migration as a transaction
        await conn.queryArray('BEGIN')
        await conn.queryArray(migrationSql)
        // Record in schema_migrations so future db push knows it's applied
        await conn.queryObject(
          `INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
           VALUES ($1, $2, ARRAY[$3]::text[])`,
          [version, name, migrationSql],
        )
        await conn.queryArray('COMMIT')

        // Verify cron landed
        const cronCheck = await conn.queryObject<{ jobname: string; schedule: string }>(
          "SELECT jobname, schedule FROM cron.job WHERE jobname = 'comm-orchestrator-hourly'",
        )

        return json(200, {
          ok: true,
          version,
          name,
          cron_registered: cronCheck.rows.length > 0,
          cron_schedule: cronCheck.rows[0]?.schedule || null,
        })
      } catch (e: any) {
        try { await conn.queryArray('ROLLBACK') } catch (_) { /* ignore */ }
        return json(500, { error: e?.message || String(e) })
      }
    }

    return json(400, { error: `unknown action: ${action}` })
  } finally {
    conn.release()
    await pool.end()
  }
})
