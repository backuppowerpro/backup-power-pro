-- Adds 4 missing columns the CRM code already writes to. Each one was
-- silently failing with PostgREST "column not found" errors that the
-- supabase-js client wrapped as a generic non-2xx, so the bugs hid in
-- fire-and-forget update chains. Discovered 2026-05-09 during a full
-- schema-drift audit.
--
-- 1. calendar_events.status         — the cancel-event/undo flow flips
--    this to 'cancelled' / 'scheduled'. Without the column the soft-
--    delete write 400'd and the in-memory mutation diverged from DB.
-- 2. contacts.archived              — the archive-contact flow + bulk
--    archive write this. Today the code ALSO writes contacts.status =
--    'Archived' as a parallel signal, but the mapper reads `archived`
--    so reading the row back rehydrates as not-archived.
-- 3. proposals.sent_at              — recorded when Key sends a proposal.
-- 4. proposals.approved_at          — recorded when the customer approves.
--    `signed_at` exists too; we keep both because legacy rows populate
--    `signed_at` and new code populates `approved_at`. Mapper falls back
--    in that order.

ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'cancelled', 'completed'));

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill the archived flag from the existing status='Archived' rows
-- so the new column matches the historical state.
UPDATE contacts SET archived = TRUE
  WHERE archived = FALSE AND status = 'Archived';

CREATE INDEX IF NOT EXISTS idx_contacts_active
  ON contacts (id) WHERE archived = FALSE;

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Backfill approved_at from signed_at for legacy rows so the
-- ContactOverview "latestSigned" sort works on day one.
UPDATE proposals SET approved_at = signed_at
  WHERE approved_at IS NULL AND signed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_proposals_recent_sent
  ON proposals (contact_id, sent_at DESC) WHERE sent_at IS NOT NULL;
