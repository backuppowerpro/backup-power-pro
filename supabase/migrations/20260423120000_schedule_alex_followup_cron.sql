-- Re-schedule alex-followup-hourly with the service-role JWT pulled from
-- vault.secrets instead of hardcoded. This removes the previously-leaked
-- key from the run-migration edge function (which lived in a public repo).
--
-- STEP 1 — store the rotated service-role JWT in vault ONCE (via SQL editor):
--
--   select vault.create_secret(
--     '<paste-the-rotated-service-role-jwt-here>',
--     'service_role_jwt',
--     'Service-role key used by pg_cron → pg_net → edge-function calls'
--   );
--
-- STEP 2 — then run the migration below to (re)create the cron:

DO $$
DECLARE
  jwt text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not installed, skipping alex-followup-hourly schedule.';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'pg_net not installed, skipping alex-followup-hourly schedule.';
    RETURN;
  END IF;

  -- Pull the JWT out of vault at schedule-time so it never appears in
  -- source control. If the secret is missing, abort rather than silently
  -- schedule a cron that always 401s.
  SELECT decrypted_secret INTO jwt
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_jwt'
  LIMIT 1;

  IF jwt IS NULL THEN
    RAISE EXCEPTION 'Missing vault secret "service_role_jwt". Run vault.create_secret first.';
  END IF;

  PERFORM cron.unschedule('alex-followup-hourly');
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
    'alex-followup-hourly',
    '0 * * * *',
    format(
      $fmt$
      SELECT net.http_post(
        url     := 'https://reowtzedjflwmlptupbk.supabase.co/functions/v1/alex-followup',
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
