-- Reschedule morning-todos cron using vault.decrypted_secrets directly.
-- The earlier 20260503140100 migration tried to extract the JWT from
-- alex-followup-hourly's cron.job command text, which failed because the
-- JWT bootstrap pattern used there reads from vault and the cron command
-- doesn't carry it in cleartext. This migration follows the same vault
-- pattern as 20260423120000_schedule_alex_followup_cron.sql.

DO $$
DECLARE
  jwt text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not installed, skipping morning-todos schedule.';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'pg_net not installed, skipping morning-todos schedule.';
    RETURN;
  END IF;

  SELECT decrypted_secret INTO jwt
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_jwt'
  LIMIT 1;

  IF jwt IS NULL THEN
    RAISE NOTICE 'Vault secret "service_role_jwt" not set; skipping morning-todos schedule.';
    RETURN;
  END IF;

  BEGIN
    PERFORM cron.unschedule('morning-todos-daily');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  PERFORM cron.schedule(
    'morning-todos-daily',
    '0 9 * * *',  -- 09:00 UTC = 5am EDT (4am EST in winter; close enough)
    format(
      $fmt$
      SELECT net.http_post(
        url     := 'https://reowtzedjflwmlptupbk.supabase.co/functions/v1/morning-todos',
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
END $$;
