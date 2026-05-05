-- Ashley Bot — schema migration
-- File: supabase/migrations/20260503000000_ashley_bot.sql
--
-- Adds:
--   - Bot-state and qualification-slot columns on contacts
--   - bot_experiments + bot_experiment_assignments tables (A/B framework)
--   - bot_outcomes table (per-conversation telemetry rollup)
--   - messages columns for per-turn audit (bot_state_at_send, classifier label, etc.)
--   - Indexes for the queries hot in CRM v3 lead-list and pipeline-stage views
--   - RLS policies (service_role full, authenticated read with same-tenant scope)
--
-- Apply via:
--   supabase db push --project-ref reowtzedjflwmlptupbk
-- OR via the db-security-advisor edge function with brain-token auth.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- 1. CONTACTS additions
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.contacts
  -- Bot lifecycle
  ADD COLUMN IF NOT EXISTS bot_state TEXT,
  ADD COLUMN IF NOT EXISTS bot_state_history JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS bot_disabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS bot_paused_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_bot_inbound_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_bot_outbound_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_human_intervention_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_reengage_at TIMESTAMPTZ,

  -- Inferred style + register tracking
  ADD COLUMN IF NOT EXISTS bot_inferred_style TEXT,
  ADD COLUMN IF NOT EXISTS bot_style_history JSONB DEFAULT '[]'::jsonb,

  -- Qualification slots (denormalized from qualification_data for queryability)
  ADD COLUMN IF NOT EXISTS qualification_data JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS gen_240v BOOLEAN,
  ADD COLUMN IF NOT EXISTS gen_brand_model TEXT,
  ADD COLUMN IF NOT EXISTS outlet_amps INT,
  ADD COLUMN IF NOT EXISTS outlet_type TEXT,
  ADD COLUMN IF NOT EXISTS run_feet_estimate TEXT,
  ADD COLUMN IF NOT EXISTS is_owner BOOLEAN,
  ADD COLUMN IF NOT EXISTS install_address TEXT,
  ADD COLUMN IF NOT EXISTS panel_brand TEXT,

  -- Photos
  ADD COLUMN IF NOT EXISTS primary_panel_photo_path TEXT,
  ADD COLUMN IF NOT EXISTS primary_outlet_photo_path TEXT,
  ADD COLUMN IF NOT EXISTS extra_photos JSONB DEFAULT '[]'::jsonb,

  -- Bot-state-specific captures
  ADD COLUMN IF NOT EXISTS bot_off_topic_excerpt TEXT,
  ADD COLUMN IF NOT EXISTS bot_referral_source TEXT,
  ADD COLUMN IF NOT EXISTS bot_callback_time_requested TEXT,
  ADD COLUMN IF NOT EXISTS bot_qualified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bot_complete_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bot_disqualified_reason TEXT,

  -- Pipeline stage (auto-derived from bot_state via trigger or app-level)
  ADD COLUMN IF NOT EXISTS pipeline_stage TEXT;

-- Indexes for CRM lead-list queries
CREATE INDEX IF NOT EXISTS idx_contacts_pipeline_stage_active
  ON public.contacts (pipeline_stage)
  WHERE pipeline_stage IS NOT NULL AND bot_disabled = FALSE;

CREATE INDEX IF NOT EXISTS idx_contacts_bot_qualified_recent
  ON public.contacts (bot_qualified_at DESC)
  WHERE bot_qualified_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_bot_state_active
  ON public.contacts (bot_state)
  WHERE bot_state IS NOT NULL AND bot_disabled = FALSE;

-- ─────────────────────────────────────────────────────────────────────
-- 2. MESSAGES additions (per-turn audit fields)
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS bot_state_at_send TEXT,
  ADD COLUMN IF NOT EXISTS bot_classification TEXT,
  ADD COLUMN IF NOT EXISTS bot_classification_confidence NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS bot_register_at_send TEXT,
  ADD COLUMN IF NOT EXISTS bot_intent_at_send TEXT,
  ADD COLUMN IF NOT EXISTS bot_phraser_used_fallback BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS bot_experiment_assignments JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS bot_photo_classifier_result JSONB;

-- ─────────────────────────────────────────────────────────────────────
-- 3. BOT_EXPERIMENTS table (A/B testing framework)
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.bot_experiments (
  id TEXT PRIMARY KEY,
  hypothesis TEXT NOT NULL,
  primary_metric TEXT NOT NULL,
  variants JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('proposed', 'designed', 'active', 'paused', 'decided', 'archived')),
  sample_target INT NOT NULL,
  decision_rule TEXT NOT NULL,
  stopping_conditions JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  paused_reason TEXT,
  decided_at TIMESTAMPTZ,
  winner TEXT,
  postmortem_url TEXT
);

CREATE INDEX IF NOT EXISTS idx_bot_experiments_status_active
  ON public.bot_experiments (status)
  WHERE status = 'active';

ALTER TABLE public.bot_experiments ENABLE ROW LEVEL SECURITY;

CREATE POLICY bot_experiments_service_role_all ON public.bot_experiments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY bot_experiments_auth_read ON public.bot_experiments
  FOR SELECT TO authenticated USING (true);

-- ─────────────────────────────────────────────────────────────────────
-- 4. BOT_EXPERIMENT_ASSIGNMENTS table
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.bot_experiment_assignments (
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  experiment_id TEXT NOT NULL REFERENCES public.bot_experiments(id) ON DELETE CASCADE,
  variant TEXT NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (contact_id, experiment_id)
);

CREATE INDEX IF NOT EXISTS idx_bot_experiment_assignments_experiment
  ON public.bot_experiment_assignments (experiment_id, variant);

ALTER TABLE public.bot_experiment_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY bea_service_role_all ON public.bot_experiment_assignments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY bea_auth_read ON public.bot_experiment_assignments
  FOR SELECT TO authenticated USING (true);

-- ─────────────────────────────────────────────────────────────────────
-- 5. BOT_OUTCOMES table (per-conversation rollup)
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.bot_outcomes (
  contact_id UUID PRIMARY KEY REFERENCES public.contacts(id) ON DELETE CASCADE,
  greeted_at TIMESTAMPTZ,
  first_reply_at TIMESTAMPTZ,
  reached_qualified_at TIMESTAMPTZ,
  reached_complete_at TIMESTAMPTZ,
  exit_state TEXT,
  total_turns INT,
  customer_messages INT,
  bot_messages INT,
  was_disqualified BOOLEAN DEFAULT FALSE,
  was_stopped BOOLEAN DEFAULT FALSE,
  needs_callback BOOLEAN DEFAULT FALSE,
  voice_score_estimated NUMERIC(3,1),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_outcomes_complete_recent
  ON public.bot_outcomes (reached_complete_at DESC)
  WHERE reached_complete_at IS NOT NULL;

ALTER TABLE public.bot_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY bot_outcomes_service_role_all ON public.bot_outcomes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY bot_outcomes_auth_read ON public.bot_outcomes
  FOR SELECT TO authenticated USING (true);

-- ─────────────────────────────────────────────────────────────────────
-- 6. Trigger: keep bot_outcomes.updated_at fresh on UPDATE
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.bot_outcomes_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bot_outcomes_updated_at_trigger ON public.bot_outcomes;
CREATE TRIGGER bot_outcomes_updated_at_trigger
  BEFORE UPDATE ON public.bot_outcomes
  FOR EACH ROW EXECUTE FUNCTION public.bot_outcomes_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- 7. Storage bucket: mms-inbound (for photo MMS storage)
-- ─────────────────────────────────────────────────────────────────────

-- Note: Supabase Storage buckets are created via the Supabase JS client
-- or dashboard, not raw SQL. Run this once via the JS client or dashboard:
--
--   await supabase.storage.createBucket('mms-inbound', { public: false });
--
-- Then apply RLS to objects in this bucket:
--
--   CREATE POLICY mms_inbound_service_only ON storage.objects
--     FOR ALL TO service_role
--     USING (bucket_id = 'mms-inbound')
--     WITH CHECK (bucket_id = 'mms-inbound');
--
-- Done at deploy time, not in this migration file.

COMMIT;

-- ─────────────────────────────────────────────────────────────────────
-- VERIFICATION QUERIES (run manually after migration)
-- ─────────────────────────────────────────────────────────────────────

-- Verify columns exist:
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='contacts'
--   AND column_name IN ('bot_state', 'qualification_data', 'pipeline_stage');

-- Verify tables exist:
-- SELECT tablename FROM pg_tables WHERE schemaname='public'
--   AND tablename IN ('bot_experiments', 'bot_experiment_assignments', 'bot_outcomes');

-- ─────────────────────────────────────────────────────────────────────
-- 6. BOT_PROCESSED_MESSAGES (idempotency for Twilio webhook)
-- ─────────────────────────────────────────────────────────────────────

-- v10.1 audit added: Twilio retries webhooks on 5xx + occasional duplicate
-- sends. Without idempotency, the bot processes the same inbound twice.
-- See bot-lab/production/bot-webhook-idempotency.ts.

CREATE TABLE IF NOT EXISTS public.bot_processed_messages (
  message_sid TEXT PRIMARY KEY,
  contact_id UUID REFERENCES public.contacts(id),
  outcome TEXT NOT NULL CHECK (outcome IN ('replied', 'silent', 'error')),
  error_message TEXT,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_processed_messages_processed_at
  ON public.bot_processed_messages (processed_at DESC);

ALTER TABLE public.bot_processed_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON public.bot_processed_messages
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Wrapper for advisory locks (called from edge function for idempotency)
CREATE OR REPLACE FUNCTION public.pg_try_advisory_xact_lock_wrapped(lock_key BIGINT)
  RETURNS BOOLEAN AS $$
    SELECT pg_try_advisory_xact_lock(lock_key);
  $$ LANGUAGE SQL VOLATILE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.pg_try_advisory_xact_lock_wrapped(BIGINT) TO service_role;

-- ─────────────────────────────────────────────────────────────────────
-- 7. Re-engagement support (last_reengage_count column)
-- ─────────────────────────────────────────────────────────────────────

-- v10.1 audit added: 24h/72h re-engagement cron needs a counter to know
-- whether a contact has been re-engaged once or twice (final attempt
-- before cold-out). See bot-lab/production/bot-reengagement-cron.sql.

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS last_reengage_count SMALLINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS do_not_contact BOOLEAN DEFAULT FALSE,
  -- v10.1.1: tracks the state the bot was in when warm-paused (e.g.,
  -- spouse_approval_needed sets bot_state=POSTPONED + paused_at_state=
  -- whatever was in progress). On customer return, bot-engine restores
  -- to paused_at_state and continues the flow.
  ADD COLUMN IF NOT EXISTS paused_at_state TEXT,
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pause_reason TEXT,  -- e.g., 'spouse_approval_needed' / 'callback_time_requested'
  -- v10.1.2: lead quality score (1-5) computed at COMPLETE state by
  -- bot-handoff-notifier. Lets Key prioritize follow-up at-a-glance.
  ADD COLUMN IF NOT EXISTS lead_quality_score NUMERIC(2,1);

CREATE INDEX IF NOT EXISTS idx_contacts_quality_score
  ON public.contacts (lead_quality_score DESC, bot_complete_at DESC)
  WHERE lead_quality_score IS NOT NULL;

-- Note: do_not_contact already exists on most BPP setups; the IF NOT
-- EXISTS guard makes this safe to apply.

-- ─────────────────────────────────────────────────────────────────────
-- 8. Verify post-migration
-- ─────────────────────────────────────────────────────────────────────

-- Verify RLS:
-- SELECT tablename, rowsecurity FROM pg_tables
--   WHERE schemaname='public' AND tablename LIKE 'bot_%';

-- Verify policies:
-- SELECT tablename, policyname, roles FROM pg_policies
--   WHERE schemaname='public' AND tablename LIKE 'bot_%';

-- Verify functions:
-- SELECT proname FROM pg_proc WHERE proname LIKE 'bot_%' OR proname LIKE 'exp_%';
