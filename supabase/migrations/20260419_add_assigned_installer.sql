-- Sub-labor prep, phase 1.
-- Adds an installer assignment column to contacts so Key can start tracking
-- which installs belong to him vs a subcontractor. Free-text for now (e.g.
-- 'Key', 'Marcus', 'Diego') — a proper installers table can come later when
-- we need login accounts + per-sub dashboards.
--
-- Also logs a default pay rate per-job so margin analysis works. Nullable
-- because most existing rows are pre-sub.

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS assigned_installer text,
  ADD COLUMN IF NOT EXISTS installer_pay numeric;

CREATE INDEX IF NOT EXISTS contacts_installer_idx
  ON contacts (assigned_installer)
  WHERE assigned_installer IS NOT NULL;
