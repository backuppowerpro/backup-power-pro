-- Adds nudge tracking to proposals so the new proposal-nudge edge function
-- can mark which proposals have been nudged and when.
--
-- Two columns:
--   nudge_count    — total auto-nudges fired for this proposal (cap at 2)
--   nudge_last_at  — timestamp of the most recent nudge (for 48h backoff)
--
-- The proposal-nudge cron fires daily at 11am EDT and skips any proposal
-- where nudge_last_at is within the last 48h, so customers don't get
-- pestered.

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS nudge_count   smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nudge_last_at timestamptz;

CREATE INDEX IF NOT EXISTS proposals_nudge_eligible_idx
  ON public.proposals (status, created_at, nudge_last_at)
  WHERE status IN ('Sent', 'Viewed', 'Created', 'Copied') AND signed_at IS NULL;

COMMENT ON COLUMN public.proposals.nudge_count   IS 'Auto-nudge count (proposal-nudge edge fn); capped at 2.';
COMMENT ON COLUMN public.proposals.nudge_last_at IS 'When proposal-nudge last fired for this row (48h backoff).';
