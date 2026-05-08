-- Fix fn_record_stage_change: it referenced NEW.updated_at, but contacts
-- has no updated_at column. Every UPDATE that touched stage was failing
-- 42703 ("record \"new\" has no field \"updated_at\""), which silently
-- broke the bot-engine's stage 1->2 advance for weeks.
--
-- 2026-05-08 root-caused via migration-drift-repair inspect_stage_trigger.
-- Backfilled 35 stuck stage-1 contacts as part of the fix.

CREATE OR REPLACE FUNCTION public.fn_record_stage_change()
RETURNS trigger AS $func$
BEGIN
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    INSERT INTO public.stage_history (contact_id, from_stage, to_stage, changed_at)
    VALUES (NEW.id, OLD.stage, NEW.stage, now());
  END IF;
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;
