-- Add `read_at` to messages so the CRM can durably track which inbound
-- messages have been seen. Until this lands, every inbound is "unread"
-- forever (mapMessage in crm-data.js sets read_at = null because the
-- column is missing); the CRM falls back to a localStorage map for UI
-- read state. Once this column exists, the CRM persists read_at server-
-- side so a fresh device sees correct read state on first load.
--
-- Discovered 2026-05-09 when Key reported "opening a thread doesn't
-- mark messages read" — the in-memory optimistic write was correct,
-- but the .from('messages').update({ read_at }) silently failed with
-- "column messages.read_at does not exist".
--
-- Index supports the inbox-badge query: "do I have any unread inbound?"

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_messages_unread_inbound
  ON messages (contact_id)
  WHERE direction IN ('in', 'inbound') AND read_at IS NULL;
