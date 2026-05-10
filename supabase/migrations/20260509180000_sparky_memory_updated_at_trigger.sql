-- Audit-2026-05-09 M3 — sparky_memory had updated_at column but no
-- trigger. Every UPSERT from the sparky-memory edge function left
-- updated_at frozen at the original insert time, so the CEO morning
-- brief's "staleness" scoring couldn't tell which memories were
-- fresh. Adding the trigger now that H2's set_updated_at is properly
-- schema-qualified with a fixed search_path.
--
-- Idempotent: DROP IF EXISTS first.

BEGIN;

DROP TRIGGER IF EXISTS sparky_memory_set_updated_at ON public.sparky_memory;

CREATE TRIGGER sparky_memory_set_updated_at
  BEFORE UPDATE ON public.sparky_memory
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMIT;
