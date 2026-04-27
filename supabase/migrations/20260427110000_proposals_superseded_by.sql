-- Auto-supersede prior open proposals when a new one is created for the same
-- contact. Customer-facing risk caught Apr 27 in the visual audit: Sarah
-- Mitchell had three open quotes ($1,197, $1,197, $1,443) all live; if she
-- finally clicked the OLDEST link she'd pay the wrong price.
--
-- Pattern:
--   1. New row: `superseded_by` and `superseded_at` start NULL.
--   2. On INSERT for contact_id X (new proposal), the trigger marks any
--      prior proposals for X that are still open (status in Sent/Viewed/
--      Created/Copied AND signed_at IS NULL AND superseded_by IS NULL) as
--      superseded by the new id.
--   3. proposal-view edge fn + proposal.html will refuse to show or accept
--      payment on a superseded proposal — sends the customer to the latest.
--
-- The exception is for proposals that have already been signed. Those never
-- get auto-superseded because the customer is locked in at that price.
-- (Deposit-paid is downstream of signed via linked invoice; signed_at is the
-- canonical lock-in marker on the proposal row.)

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS superseded_by uuid REFERENCES public.proposals(id),
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz;

CREATE INDEX IF NOT EXISTS proposals_superseded_idx
  ON public.proposals (contact_id, superseded_by)
  WHERE superseded_by IS NULL AND signed_at IS NULL;

COMMENT ON COLUMN public.proposals.superseded_by IS 'When a newer proposal supersedes this one, points at the new id. Customer-facing pages refuse to render or accept payment on a superseded row.';
COMMENT ON COLUMN public.proposals.superseded_at IS 'Timestamp the row was superseded (for audit / how-old-was-the-old-quote queries).';

-- Trigger: on INSERT of a new proposal for contact X, mark prior open
-- proposals for X as superseded by the new one. Skips proposals where the
-- deposit has been paid (customer locked in at that price). Skips proposals
-- already in a terminal state.
CREATE OR REPLACE FUNCTION public.proposals_supersede_prior()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.contact_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.proposals
  SET superseded_by = NEW.id,
      superseded_at = now()
  WHERE contact_id = NEW.contact_id
    AND id <> NEW.id
    AND superseded_by IS NULL
    AND signed_at IS NULL
    AND status IN ('Sent', 'Viewed', 'Created', 'Copied');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS proposals_supersede_prior_trigger ON public.proposals;
CREATE TRIGGER proposals_supersede_prior_trigger
AFTER INSERT ON public.proposals
FOR EACH ROW
EXECUTE FUNCTION public.proposals_supersede_prior();
