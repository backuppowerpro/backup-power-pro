ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS price_override integer,
  ADD COLUMN IF NOT EXISTS include_permit boolean NOT NULL DEFAULT true;
