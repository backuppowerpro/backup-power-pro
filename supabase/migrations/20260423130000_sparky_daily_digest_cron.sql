-- Schedule sparky-daily-digest: runs every night at 9:00pm America/New_York.
-- In UTC that's 01:00 (EDT) or 02:00 (EST). We pick 01:00 UTC so it fires at
-- 9pm EDT / 8pm EST — Key's phone sees it during wind-down, not overnight.
--
-- Auth bootstrap strategy:
-- The service-role JWT already lives inside the existing alex-followup-hourly
-- cron command (scheduled by 20260423_schedule_alex_followup_cron.sql). Rather
-- than duplicating the key in vault or source, we lift it out of that job's
-- command text at schedule-time. This keeps the key out of git and means any
-- future service-role rotation only needs to update the alex-followup cron;
-- all other crons re-bootstrap from it.
--
-- Idempotent (drops prior schedule with same name).

DO $$
DECLARE
  existing_cmd text;
  jwt text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not installed, skipping sparky-daily-digest schedule.';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'pg_net not installed, skipping sparky-daily-digest schedule.';
    RETURN;
  END IF;

  SELECT command INTO existing_cmd FROM cron.job WHERE jobname = 'alex-followup-hourly' LIMIT 1;
  IF existing_cmd IS NULL THEN
    RAISE NOTICE 'alex-followup-hourly job not found; skipping sparky-daily-digest schedule.';
    RETURN;
  END IF;

  jwt := substring(existing_cmd from 'Bearer (eyJ[A-Za-z0-9._-]+)');
  IF jwt IS NULL OR length(jwt) < 30 THEN
    RAISE NOTICE 'Could not extract JWT from alex-followup-hourly; skipping sparky-daily-digest schedule.';
    RETURN;
  END IF;

  BEGIN
    PERFORM cron.unschedule('sparky-daily-digest-evening');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  PERFORM cron.schedule(
    'sparky-daily-digest-evening',
    '0 1 * * *',  -- 01:00 UTC = 9pm EDT (8pm EST in winter)
    format(
      $fmt$
      SELECT net.http_post(
        url     := 'https://reowtzedjflwmlptupbk.supabase.co/functions/v1/sparky-daily-digest',
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
