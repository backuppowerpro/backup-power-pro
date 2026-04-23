-- Smart Pricing v1 — tier + A/B variant scaffold.
--
-- pricing_tier on contacts lets us bucket leads into Standard / Premium /
-- Premium+ so the QuickQuote modal can present tier-appropriate prices.
-- Default 'standard' — everyone starts there, Key (or the heuristic) can
-- promote. Text enum instead of a Postgres enum so we can add tiers later
-- without a migration; constrained via CHECK.
--
-- pricing_variant on proposals records which A/B arm a given proposal
-- belongs to (baseline vs one-tier-up uplift within the same tier). Over
-- ~30–50 deals we compare close rate × price to see the actual elasticity
-- at each tier.
--
-- Idempotent.

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS pricing_tier text NOT NULL DEFAULT 'standard';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contacts_pricing_tier_check'
  ) THEN
    ALTER TABLE contacts
      ADD CONSTRAINT contacts_pricing_tier_check
      CHECK (pricing_tier IN ('standard', 'premium', 'premium_plus'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS contacts_pricing_tier_idx ON contacts (pricing_tier);

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS pricing_tier text,
  ADD COLUMN IF NOT EXISTS pricing_variant text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'proposals_pricing_variant_check'
  ) THEN
    ALTER TABLE proposals
      ADD CONSTRAINT proposals_pricing_variant_check
      CHECK (pricing_variant IS NULL OR pricing_variant IN ('A', 'B'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS proposals_pricing_tier_idx ON proposals (pricing_tier);
