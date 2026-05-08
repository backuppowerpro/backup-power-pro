-- 2026-04-29 — Auto-record every contacts.stage transition into stage_history.
--
-- WHY: The CRM UI (crm/crm.html) updates contacts.stage directly without
-- writing to stage_history. As a result, edge functions that need to know
-- WHEN a stage transition happened (e.g., experiment-stats trying to
-- compute "Stage 2 within 48h") have no timing data.
--
-- The existing stage_history rows come from:
--   - stripe-webhook (writes to_stage=4 on payment)
--   - sub-mark-complete (writes to_stage=9 on install completion)
-- Stage 2, 3, 5, 6, 7, 8 transitions from the CRM UI never land here.
--
-- This migration adds a TRIGGER that fires on UPDATE OF stage and
-- automatically records the transition. Idempotent — safe to re-run.
-- Backfills are NOT done here (would require a different strategy);
-- this only catches NEW transitions from now on.

-- Drop any pre-existing trigger so we can re-create cleanly
DROP TRIGGER IF EXISTS contacts_stage_change_record ON public.contacts;
DROP FUNCTION IF EXISTS public.fn_record_stage_change();

-- The function that records the change. Only fires when stage actually changed.
-- NULLs handled safely (NULL → 1 is a real transition that we want to record).
CREATE OR REPLACE FUNCTION public.fn_record_stage_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- IS DISTINCT FROM treats NULL correctly (NULL <> 1 is NULL in standard SQL,
  -- which would skip the insert; we want to record the very first stage too).
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    INSERT INTO public.stage_history (contact_id, from_stage, to_stage, changed_at)
    VALUES (NEW.id, OLD.stage, NEW.stage, COALESCE(NEW.updated_at, now()));
  END IF;
  RETURN NEW;
END;
$$;

-- Tight ownership and grants — trigger function runs with definer privileges
-- so it can write to stage_history regardless of the caller's RLS context
-- (CRM UI writes via anon, anon doesn't have direct insert on stage_history).
REVOKE ALL ON FUNCTION public.fn_record_stage_change() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_record_stage_change() TO authenticated, anon, service_role;

-- The trigger itself — fires only on real stage changes for efficiency
CREATE TRIGGER contacts_stage_change_record
AFTER UPDATE OF stage ON public.contacts
FOR EACH ROW
WHEN (NEW.stage IS DISTINCT FROM OLD.stage)
EXECUTE FUNCTION public.fn_record_stage_change();

COMMENT ON FUNCTION public.fn_record_stage_change() IS
  'Records every contacts.stage transition into stage_history. Added 2026-04-29 so the experiment-stats edge function can compute stage-2-within-48h timing. Without this, the CRM UI updates stage directly and downstream queries lose transition timing.';
