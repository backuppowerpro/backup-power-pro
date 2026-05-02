-- 2026-05-02 — One-shot cleanup of dojo test contacts (+1800555xxxx)
-- and the FK on sms_consent_log that blocks it.
--
-- Why the FK drop is needed:
--   sms_consent_log has a Postgres RULE that makes it append-only for
--   TCPA compliance. Its FK to contacts (ON DELETE SET NULL) cannot
--   actually update consent rows, so any contact DELETE referenced by
--   sms_consent_log fails with "referential integrity query gave
--   unexpected result". The FK never should have existed on an
--   immutable audit table — consent records are independent legal
--   records that stand on their own even if the contact is removed.
--
-- After this migration: sms_consent_log keeps the dojo phone records
-- (preserving any TCPA-relevant history) but the contact_id column
-- becomes a soft pointer that may reference deleted contacts.
--
-- Apply with:
--   /Users/keygoodson/local/node-v22.15.0-darwin-arm64/bin/supabase db push --project-ref reowtzedjflwmlptupbk

BEGIN;

-- 1. Drop the FK so the contact delete can proceed.
ALTER TABLE public.sms_consent_log
  DROP CONSTRAINT IF EXISTS sms_consent_log_contact_id_fkey;

-- 2. Null out contact_id on the SET NULL tables (so we don't leave
--    orphans referencing deleted contacts).
DO $$
DECLARE test_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO test_ids FROM public.contacts
  WHERE phone LIKE '+1800555%' OR phone LIKE '1800555%' OR phone LIKE '8005550%' OR phone LIKE '8005551%';

  IF test_ids IS NOT NULL THEN
    UPDATE public.invoices       SET contact_id = NULL WHERE contact_id = ANY(test_ids);
    UPDATE public.proposals      SET contact_id = NULL WHERE contact_id = ANY(test_ids);
    UPDATE public.schedule       SET contact_id = NULL WHERE contact_id = ANY(test_ids);
    UPDATE public.sparky_inbox   SET contact_id = NULL WHERE contact_id = ANY(test_ids);
    UPDATE public.neighbor_cards SET contact_id = NULL WHERE contact_id = ANY(test_ids);
  END IF;
END $$;

-- 3. Delete the test contacts. CASCADE FKs handle messages/photos/etc.
DELETE FROM public.contacts
WHERE phone LIKE '+1800555%' OR phone LIKE '1800555%' OR phone LIKE '8005550%' OR phone LIKE '8005551%';

COMMIT;
