-- gbp_reviews + daily monitor cron
--
-- Stores the BPP Google Business Profile reviews we've seen so the
-- daily monitor cron can detect new ones. The cron runs at 09:00
-- America/New_York every day; new reviews fire an SMS to Key with the
-- rating, author, and snippet so he can reply same-day (Google rewards
-- quick replies with rank lift).

create table if not exists public.gbp_reviews (
  id                 uuid primary key default gen_random_uuid(),
  author_name        text not null,
  author_url         text,
  profile_photo_url  text,
  rating             integer not null,
  relative_time      text,
  text               text,
  review_time        bigint not null,        -- unix seconds (Places API)
  created_at         timestamptz not null default now(),
  unique (author_name, review_time)
);

create index if not exists gbp_reviews_review_time_idx
  on public.gbp_reviews (review_time desc);

alter table public.gbp_reviews enable row level security;

drop policy if exists gbp_reviews_service_all on public.gbp_reviews;
create policy gbp_reviews_service_all
  on public.gbp_reviews
  for all to service_role
  using (true) with check (true);

drop policy if exists gbp_reviews_authenticated_read on public.gbp_reviews;
create policy gbp_reviews_authenticated_read
  on public.gbp_reviews
  for select to authenticated
  using (true);

-- Daily cron @ 09:00 America/New_York (13:00 UTC during EDT, 14:00 UTC
-- during EST). pg_cron uses UTC; using 13:00 means an hour off during
-- EST which is fine for a "did anyone leave a review yesterday" check.
-- Calls the gbp-review-monitor edge function with the service-role
-- bearer; the function then diffs vs this table and SMSes Key.
select cron.unschedule('gbp-review-monitor-daily')
  where exists (select 1 from cron.job where jobname = 'gbp-review-monitor-daily');

select cron.schedule(
  'gbp-review-monitor-daily',
  '0 13 * * *',
  $$
  select net.http_post(
    url := 'https://reowtzedjflwmlptupbk.supabase.co/functions/v1/gbp-review-monitor',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
