-- messages.sender_phone — preserves the original from-phone of every
-- inbound message, even when no contact match exists.
--
-- Apr 27 phone+SMS audit (P0 #6): inbound from unknown numbers saved with
-- contact_id=null and the inbox loader explicitly filters those out
-- (`if (!m.contact_id) continue` in LiveMessages). Result: cold-inbound
-- texts vanish from the CRM. With this column, the orphan inbox can group
-- those rows by raw sender phone and surface them as "Unknown sender" rows
-- with a Match Contact / Create New action.
--
-- Why a separate column rather than overloading body: keeping body clean
-- preserves Alex's transcript-friendliness and avoids grep brittleness.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS sender_phone text;

CREATE INDEX IF NOT EXISTS messages_sender_phone_orphan_idx
  ON public.messages (sender_phone, created_at DESC)
  WHERE contact_id IS NULL AND direction = 'inbound';

COMMENT ON COLUMN public.messages.sender_phone IS 'Original sender phone (E.164) — populated on inbound for orphan-thread grouping when contact_id is NULL.';
