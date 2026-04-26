-- Schedule permit-morning-check at 8am ET (12pm UTC) daily.
--
-- Background: the function exists, has all the Greenville eTRAKiT scraping
-- logic, and texts Key (941) 441-7996 with a one-line summary. It's been
-- triggered manually by `scripts/brain/fetch-permits.sh` from the local
-- laptop. After the SR JWT rotation on 2026-04-23, the local script can't
-- authenticate anymore, so it's been a no-op since 2026-04-13.
--
-- Server-side cron is the right place for this — pg_cron + pg_net pull a
-- fresh service-role JWT from vault.secrets at every fire, so it doesn't
-- silently 401 the way a hardcoded JWT would.
--
-- Same vault secret pattern as 20260423120000_schedule_alex_followup_cron:
-- caller must have run `select vault.create_secret('<jwt>', 'service_role_jwt', ...)`
-- once via the SQL editor for the schedule to actually be created.

DO $$
DECLARE
  jwt text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not installed, skipping permit-morning-check schedule.';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'pg_net not installed, skipping permit-morning-check schedule.';
    RETURN;
  END IF;

  -- Pull JWT at schedule-time so it never lives in source.
  SELECT decrypted_secret INTO jwt
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_jwt'
  LIMIT 1;

  IF jwt IS NULL THEN
    RAISE NOTICE 'Missing vault secret "service_role_jwt"; permit-morning-check schedule skipped. Run rotate-cron-jwt or create the secret manually before this migration takes effect.';
    RETURN;
  END IF;

  -- Idempotent: drop the old job if it exists, then re-create.
  PERFORM cron.unschedule('permit-morning-check-daily');
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
    'permit-morning-check-daily',
    -- 12pm UTC = 8am ET during DST, 7am ET in winter. Acceptable drift —
    -- the customer-facing Key SMS arrives mid-morning either way.
    '0 12 * * *',
    format(
      $fmt$
      SELECT net.http_post(
        url     := 'https://reowtzedjflwmlptupbk.supabase.co/functions/v1/permit-morning-check',
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
