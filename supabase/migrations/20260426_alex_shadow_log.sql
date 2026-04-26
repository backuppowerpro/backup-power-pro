-- Alex shadow critic log — every Alex draft that the pre-send reviewer
-- examined, plus the verdict. Lets us mine the corrections to find
-- recurring patterns to bake back into the SYSTEM_PROMPT (or the
-- shadow-critic prompt itself).
--
-- Populated by alex-agent/index.ts -> logShadowDecision() whenever
-- ALEX_SHADOW_MODE is set to 'log' or 'rewrite'.

create table if not exists public.alex_shadow_log (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  session_id    uuid,
  phone         text not null,
  original_draft text not null,
  -- 'ship'    : critic approved the draft as-is
  -- 'rewrite' : critic flagged + supplied a correction (whether shipped depends
  --             on the env-var mode — see alex-agent/applyShadow)
  verdict       text not null check (verdict in ('ship', 'rewrite')),
  corrected     text,
  reason        text
);

create index if not exists alex_shadow_log_session_idx on public.alex_shadow_log (session_id, created_at desc);
create index if not exists alex_shadow_log_phone_idx   on public.alex_shadow_log (phone, created_at desc);
create index if not exists alex_shadow_log_verdict_idx on public.alex_shadow_log (verdict, created_at desc);

-- RLS: service role only — this is internal coaching data, never user-facing.
alter table public.alex_shadow_log enable row level security;

create policy "alex_shadow_log_service_role_all"
  on public.alex_shadow_log
  for all
  to service_role
  using (true)
  with check (true);

comment on table public.alex_shadow_log is
  'Pre-send shadow-critic decisions for Alex SMS drafts. Mine the rewrite rows for prompt-improvement signals.';
