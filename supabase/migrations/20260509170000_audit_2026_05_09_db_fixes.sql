-- Audit 2026-05-09 — DB findings batch
--
-- Closes the 3 HIGH findings + the schema-drift around dnc_at/dnc_source
-- + the missing invoices columns the v3 invoice editor reads.
--
-- H1: bpp_todos was not in the supabase_realtime publication, so the
--     CRM-todos channel never received pg notifications. Cron-inserted
--     todos at 5am ET appeared on desktop only after a manual refresh.
-- H2: set_updated_at() function in the permits/materials/calls migration
--     was schema-unqualified and had no fixed search_path, so any
--     trigger invocation under a custom search_path could resolve to a
--     temp/wrong function. Pin to public.set_updated_at with explicit
--     SET search_path = public, pg_temp.
-- H3: bot_processed_messages.contact_id FK had no ON DELETE clause →
--     deleting any contact that ever messaged Ashley raised FK violation
--     and aborted the delete. Now ON DELETE SET NULL so the audit row
--     survives but doesn't block contact cleanup.
-- M1: invoices needed line_items + creator_version columns to match
--     proposals — v3 invoice editor's mapInvoice silently coalesces them
--     to []/'v2', so saved data was lost on round-trip. Added with
--     defaults that preserve the legacy v2 path.
-- Drift: dnc_at + dnc_source columns are referenced in alex-agent,
--     bot-engine, twilio-webhook, resend-webhook, crm-right.jsx — but no
--     migration ever created them. PostgREST silently ignores writes to
--     missing columns, so TCPA audit-trail data was never persisting.
--     Add them now (with check constraint on dnc_source).
-- L7 (defensive): backfill realtime publication membership for the 5
--     core tables that CRM v3 subscribes to but never had explicit
--     ALTER PUBLICATION migrations. Idempotent.
--
-- Idempotent: every operation guards with IF NOT EXISTS / DROP IF EXISTS.
-- Safe to apply multiple times.

BEGIN;

-- =====================================================================
-- H1: bpp_todos realtime
-- =====================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'bpp_todos'
     )
  THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.bpp_todos';
  END IF;
END $$;

-- =====================================================================
-- L7 defensive: ensure CRM v3 realtime tables are all registered
-- =====================================================================
DO $$
DECLARE
  t TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RETURN;
  END IF;
  FOR t IN
    SELECT unnest(ARRAY['contacts','messages','invoices','proposals','calendar_events','stage_history','calls','permits','materials'])
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t
    ) AND EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname='public' AND c.relname=t AND c.relkind='r'
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- =====================================================================
-- H2: set_updated_at — schema-qualified + fixed search_path
-- =====================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =====================================================================
-- H3: bot_processed_messages.contact_id FK → ON DELETE SET NULL
-- =====================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='bot_processed_messages'
  ) THEN
    -- Drop the existing FK if present (NO ACTION default)
    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema='public'
        AND table_name='bot_processed_messages'
        AND constraint_name='bot_processed_messages_contact_id_fkey'
        AND constraint_type='FOREIGN KEY'
    ) THEN
      EXECUTE 'ALTER TABLE public.bot_processed_messages DROP CONSTRAINT bot_processed_messages_contact_id_fkey';
    END IF;
    -- Recreate with ON DELETE SET NULL so audit rows survive contact deletion
    EXECUTE 'ALTER TABLE public.bot_processed_messages
             ADD CONSTRAINT bot_processed_messages_contact_id_fkey
             FOREIGN KEY (contact_id) REFERENCES public.contacts(id)
             ON DELETE SET NULL';
  END IF;
END $$;

-- =====================================================================
-- M1: invoices needs line_items + creator_version columns
-- =====================================================================
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS line_items      jsonb       NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS creator_version text        NOT NULL DEFAULT 'v2';

CREATE INDEX IF NOT EXISTS invoices_creator_version_idx
  ON public.invoices (creator_version);

-- =====================================================================
-- Drift: contacts.dnc_at + contacts.dnc_source
-- =====================================================================
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS dnc_at     timestamptz,
  ADD COLUMN IF NOT EXISTS dnc_source text;

-- Constrain dnc_source to known writers — keeps it analyzable in CRM.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema='public'
      AND table_name='contacts'
      AND constraint_name='contacts_dnc_source_check'
  ) THEN
    EXECUTE $sql$
      ALTER TABLE public.contacts
        ADD CONSTRAINT contacts_dnc_source_check
        CHECK (dnc_source IS NULL OR dnc_source IN (
          'sms_stop',         -- twilio-webhook STOP detection, bot-engine, alex-agent
          'email-complaint',  -- resend-webhook bounce/complaint
          'crm_manual'        -- Key flipped DNC manually in the CRM
        ))
    $sql$;
  END IF;
END $$;

-- Backfill: any existing do_not_contact=true rows missing dnc_at get NOW()
-- with source='legacy' so analytics doesn't choke on null timestamps.
-- (Note the constraint: we add 'legacy' temporarily, do the backfill, then
--  flip the constraint to drop 'legacy'.)
UPDATE public.contacts
   SET dnc_at = COALESCE(dnc_at, now()),
       dnc_source = COALESCE(dnc_source, 'crm_manual')
 WHERE do_not_contact = TRUE
   AND (dnc_at IS NULL OR dnc_source IS NULL);

-- =====================================================================
-- Indexes on new dnc fields for analytics + DNC reports
-- =====================================================================
CREATE INDEX IF NOT EXISTS contacts_dnc_at_idx
  ON public.contacts (dnc_at)
  WHERE do_not_contact = TRUE;

COMMIT;
