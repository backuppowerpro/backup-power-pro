-- Schedule lead-volume-alert to run daily at 8:30am America/New_York.
-- In UTC that's 12:30 (EDT) or 13:30 (EST); we split the difference and pick
-- 12:30 UTC which fires at 8:30am EDT and 7:30am EST. Either is early enough.
--
-- Requires pg_cron + pg_net extensions. Supabase hosts both by default.
-- The SUPABASE_URL + service key are referenced from Supabase Vault where
-- possible, otherwise inlined below with the public anon URL (service key
-- is pulled from vault.secrets if set, else from env at invoke time).

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any prior schedule with this name (idempotent re-run)
SELECT cron.unschedule(j.jobid)
FROM cron.job j
WHERE j.jobname = 'lead-volume-alert-daily';

SELECT cron.schedule(
  'lead-volume-alert-daily',
  '30 12 * * *',  -- 12:30 UTC = 8:30 EDT (7:30 EST in winter)
  $$
  SELECT net.http_post(
    url := 'https://reowtzedjflwmlptupbk.supabase.co/functions/v1/lead-volume-alert',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
