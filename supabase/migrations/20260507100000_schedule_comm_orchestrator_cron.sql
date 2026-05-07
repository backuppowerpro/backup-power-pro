-- comm-orchestrator: hourly cron, fires per-stage customer SMS nudges
-- (permit milestones, install reminders) plus a Mon-9am-ET stalled-contact
-- digest to Key.
--
-- Why hourly: stage transitions and install_at - 24h windows need granular
-- timing; daily would miss Tuesday installs scheduled Monday afternoon.
-- Quiet hours (8am-9pm ET for customer SMS) are enforced inside the function,
-- so the cron itself runs 24/7 and just no-ops outside the window.
--
-- Reuses the same vault-stored service_role_jwt as alex-followup-hourly.

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
    RAISE EXCEPTION 'Missing vault secret "service_role_jwt". Run vault.create_secret first.';
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
    '15 * * * *',  -- 15min past every hour, off-cycle from other crons
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
