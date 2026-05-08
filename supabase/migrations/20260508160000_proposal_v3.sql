-- Proposal/Invoice Creator v3
-- Adds columns for the new creator. Existing rows stay on v2 path (creator_version
-- defaults to 'v2' for any pre-existing row, 'v3' for new rows the new UI writes).
-- Renderers (proposal.html/invoice.html) branch on creator_version so old work is untouched.

-- Default 'v2' so existing rows are safely tagged. The v3 creator code in
-- crm.html explicitly writes creator_version='v3' on every new INSERT.
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS creator_version text NOT NULL DEFAULT 'v2',
  ADD COLUMN IF NOT EXISTS length_ft int,                              -- 5..100, increments of 5
  ADD COLUMN IF NOT EXISTS include_cord boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS include_inlet boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS include_permit boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pom_offered boolean NOT NULL DEFAULT false, -- visible on client page (not pre-checked)
  ADD COLUMN IF NOT EXISTS pom_accepted boolean NOT NULL DEFAULT false,-- client opted in at sign time
  ADD COLUMN IF NOT EXISTS discount_type text,                         -- 'percent' | 'dollar' | NULL
  ADD COLUMN IF NOT EXISTS discount_value numeric(10,2),               -- numeric (% or $) depending on type
  ADD COLUMN IF NOT EXISTS extra_line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS require_deposit boolean NOT NULL DEFAULT false;


-- Validation: length must be a multiple of 5 between 5 and 100 inclusive (when set).
ALTER TABLE public.proposals DROP CONSTRAINT IF EXISTS proposals_length_ft_check;
ALTER TABLE public.proposals ADD CONSTRAINT proposals_length_ft_check
  CHECK (length_ft IS NULL OR (length_ft BETWEEN 5 AND 100 AND length_ft % 5 = 0));

ALTER TABLE public.proposals DROP CONSTRAINT IF EXISTS proposals_discount_type_check;
ALTER TABLE public.proposals ADD CONSTRAINT proposals_discount_type_check
  CHECK (discount_type IS NULL OR discount_type IN ('percent','dollar'));

CREATE INDEX IF NOT EXISTS proposals_creator_version_idx ON public.proposals (creator_version);
