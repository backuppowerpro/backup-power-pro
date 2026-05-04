-- Schedule morning-todos to run daily at 5:00am America/New_York.
-- In UTC that's 09:00 (EDT) or 10:00 (EST). We pick 09:00 UTC so it fires
-- at 5am EDT / 4am EST — Key wakes up to a fresh todo list.
--
-- Auth bootstrap: lifts the service-role JWT from the existing
-- alex-followup-hourly cron command (same pattern as
-- 20260423130000_sparky_daily_digest_cron.sql). Avoids duplicating the
-- key across migrations.

DO $$
DECLARE
  existing_cmd text;
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

  SELECT command INTO existing_cmd FROM cron.job WHERE jobname = 'alex-followup-hourly' LIMIT 1;
  IF existing_cmd IS NULL THEN
    RAISE NOTICE 'alex-followup-hourly job not found; skipping morning-todos schedule.';
    RETURN;
  END IF;

  jwt := substring(existing_cmd from 'Bearer (eyJ[A-Za-z0-9._-]+)');
  IF jwt IS NULL OR length(jwt) < 30 THEN
    RAISE NOTICE 'Could not extract JWT from alex-followup-hourly; skipping morning-todos schedule.';
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
