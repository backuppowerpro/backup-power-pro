-- Add `pinned` to contacts so starred contacts sync between desktop and
-- mobile. Before this column existed, pins lived in localStorage only —
-- per-device, no cross-device sync. Discovered 2026-05-09 when Key
-- noticed his phone's pinned contacts didn't show on desktop.
--
-- Architecture: contacts.pinned is the source of truth. The CRM's
-- usePinned() hook derives its Set from CRM.contacts.filter(c=>c.pinned)
-- instead of from localStorage. togglePin writes to the DB; the
-- contacts realtime channel echoes the change to every tab/device.
-- localStorage is kept only as a one-time backfill source on first
-- load after this ships.

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE;

-- Index supports the "all pinned" query, which the contact list runs
-- to surface starred rows to the top of every left-pane lens.
CREATE INDEX IF NOT EXISTS idx_contacts_pinned
  ON contacts (id) WHERE pinned = TRUE;
