-- Three tables the CRM v3 UI has been pretending exist for weeks. Every
-- permit advance, jurisdiction edit, material status flip, and call log
-- has been mutating in-memory React state with NO Supabase write —
-- refresh = work disappears. Discovered 2026-05-09 audit; biggest hidden
-- data-loss surface in the business.
--
-- Schema choices match the in-memory shape used by:
--   crm-right.jsx PermitStatusActions, JurisdictionEditor, PermitsCard.addPermit
--   crm-right.jsx MaterialRow, InstallSpecCard
--   crm-left.jsx CallsList (today: read-only inferred from messages — empty)
--
-- The UI optimistically mutates the JS object then bumpData(). After this
-- migration lands, each mutation gets paired with an awaited Supabase
-- update + rollback on error (separate code commit).

-- ── permits ───────────────────────────────────────────────────────────
-- One permit per contact-jurisdiction pair (a contact can technically
-- have multiple permits if they're in two jurisdictions, but in practice
-- it's 1:1 — UI supports the multi-permit case via PermitsCard.map).

CREATE TABLE IF NOT EXISTS permits (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id           UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  -- jurisdiction_id FK keeps the link to the portal/login info on
  -- permit_jurisdictions; jurisdiction_name is denormalized so the UI
  -- can render without a join (matches the existing in-memory shape).
  jurisdiction_id      INTEGER REFERENCES permit_jurisdictions(id) ON DELETE SET NULL,
  jurisdiction_name    TEXT,
  permit_number        TEXT NOT NULL DEFAULT 'PENDING',
  status               TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started','submitted','waiting','approved','blocked','rejected')),
  submitted_at         DATE,
  approved_at          DATE,
  cost_cents           INTEGER NOT NULL DEFAULT 0 CHECK (cost_cents >= 0),
  blocker_note         TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_permits_by_contact ON permits (contact_id);
CREATE INDEX IF NOT EXISTS idx_permits_active
  ON permits (contact_id, status)
  WHERE status NOT IN ('approved','rejected');

ALTER TABLE permits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "key_full_access_permits" ON permits;
CREATE POLICY "key_full_access_permits" ON permits
  FOR ALL TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS permits_set_updated_at ON permits;
CREATE TRIGGER permits_set_updated_at
  BEFORE UPDATE ON permits
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── materials ────────────────────────────────────────────────────────
-- Three permanent kinds (inlet, interlock, cord) always render on the
-- InstallSpecCard as placeholders even when no row exists; ad-hoc kinds
-- (breaker, whip, surge, other) get explicit rows. The UI's "permanent"
-- vs "extra" distinction is enforced in JS — DB stores all kinds the
-- same way.

CREATE TABLE IF NOT EXISTS materials (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id      UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL
    CHECK (kind IN ('inlet','interlock','cord','breaker','whip','surge','other')),
  status          TEXT NOT NULL DEFAULT 'not_ordered'
    CHECK (status IN ('not_ordered','ordered','received','installed')),
  ordered_at      DATE,
  received_at     DATE,
  installed_at    DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A contact can have at most one row per permanent kind (the UI
  -- treats inlet/interlock/cord as singular). Extras (other, breaker,
  -- whip, surge) can repeat.
  CONSTRAINT one_permanent_per_contact
    UNIQUE NULLS NOT DISTINCT (contact_id, kind)
);

-- Drop the unique constraint for non-permanent kinds via a partial
-- index workaround: the constraint above blocks ALL duplicates, but we
-- want to allow duplicates of breaker/whip/surge/other. Replace with
-- a partial unique index limited to the three permanent kinds.
ALTER TABLE materials DROP CONSTRAINT IF EXISTS one_permanent_per_contact;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_permanent_material_per_contact
  ON materials (contact_id, kind)
  WHERE kind IN ('inlet','interlock','cord');

CREATE INDEX IF NOT EXISTS idx_materials_by_contact
  ON materials (contact_id, created_at);

ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "key_full_access_materials" ON materials;
CREATE POLICY "key_full_access_materials" ON materials
  FOR ALL TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

DROP TRIGGER IF EXISTS materials_set_updated_at ON materials;
CREATE TRIGGER materials_set_updated_at
  BEFORE UPDATE ON materials
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── calls ────────────────────────────────────────────────────────────
-- Twilio voice webhook target. listened_at clears the voicemail badge
-- on view (same pattern as messages.read_at). twilio_call_sid is unique
-- so the webhook is idempotent.

CREATE TABLE IF NOT EXISTS calls (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Calls survive a contact delete so the audit record stays intact
  -- (especially matters if a customer was DNC'd then deleted — their
  -- call history needs to be referencable for compliance).
  contact_id           UUID REFERENCES contacts(id) ON DELETE SET NULL,
  direction            TEXT NOT NULL
    CHECK (direction IN ('in','out','missed')),
  started_at           TIMESTAMPTZ NOT NULL,
  ended_at             TIMESTAMPTZ,
  duration_sec         INTEGER CHECK (duration_sec IS NULL OR duration_sec >= 0),
  -- Voicemail fields are NULL on completed calls; populated when the
  -- recipient didn't pick up and Twilio captured a message.
  voicemail_url        TEXT,
  voicemail_duration   INTEGER,
  voicemail_transcript TEXT,
  listened_at          TIMESTAMPTZ,
  -- Twilio identifiers for webhook idempotency + cross-reference.
  twilio_call_sid      TEXT UNIQUE,
  recording_sid        TEXT,
  from_phone           TEXT,
  to_phone             TEXT,
  status               TEXT, -- twilio call status: completed, busy, no-answer, failed, etc.
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calls_by_contact ON calls (contact_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_unlistened_voicemails
  ON calls (contact_id)
  WHERE voicemail_url IS NOT NULL AND listened_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_calls_recent
  ON calls (started_at DESC);

ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "key_full_access_calls" ON calls;
CREATE POLICY "key_full_access_calls" ON calls
  FOR ALL TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

DROP TRIGGER IF EXISTS calls_set_updated_at ON calls;
CREATE TRIGGER calls_set_updated_at
  BEFORE UPDATE ON calls
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Enable realtime for all three tables so cross-tab sync works.
-- (Realtime publication membership is idempotent — re-running this
-- migration is safe.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'permits'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE permits';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'materials'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE materials';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'calls'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE calls';
  END IF;
END $$;
