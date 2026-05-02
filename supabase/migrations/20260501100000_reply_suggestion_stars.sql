-- reply_suggestion_stars
--
-- When Key likes a Claude-suggested reply enough to send it, we save the
-- final body as a "starred" example. The suggest-reply edge function then
-- weights these heavily in subsequent prompts so the model learns Key's
-- voice over time without any ML pipeline.

create table if not exists public.reply_suggestion_stars (
  id          uuid primary key default gen_random_uuid(),
  body        text not null,
  contact_id  uuid references public.contacts(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists reply_suggestion_stars_created_at_idx
  on public.reply_suggestion_stars (created_at desc);

alter table public.reply_suggestion_stars enable row level security;

-- Service role full access; anon read-only because the suggest-reply
-- function can run with the publishable key + the body text is non-PII.
create policy if not exists reply_suggestion_stars_service_all
  on public.reply_suggestion_stars
  for all to service_role
  using (true) with check (true);

create policy if not exists reply_suggestion_stars_authenticated_read
  on public.reply_suggestion_stars
  for select to authenticated
  using (true);

create policy if not exists reply_suggestion_stars_authenticated_insert
  on public.reply_suggestion_stars
  for insert to authenticated
  with check (true);
