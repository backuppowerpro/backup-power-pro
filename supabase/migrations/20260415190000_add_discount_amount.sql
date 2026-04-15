ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS discount_amount integer NOT NULL DEFAULT 0;
