-- Add stripe_session_id column to payments table.
-- The stripe-webhook edge function references this column when:
--   (1) checking idempotency via the Stripe checkout session ID
--   (2) inserting a new payment row after successful checkout
-- Without this column, every Stripe checkout completion would fail to record
-- a payment — invoice gets marked paid but the payments table stays empty,
-- which kills reconciliation.
--
-- Idempotent. Safe to run multiple times. Preserves the legacy
-- stripe_payment_id column for any in-person tap-to-pay / historical
-- records that used it.

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS stripe_session_id text;

CREATE INDEX IF NOT EXISTS payments_stripe_session_id_idx
  ON payments (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;
