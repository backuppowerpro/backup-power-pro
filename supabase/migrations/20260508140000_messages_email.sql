-- messages_email: log every send-email send for CRM thread continuity,
-- bounce tracking, deliverability auditing, and idempotent cron logic
-- (e.g. "did we already send the anniversary email this year?").
--
-- 2026-05-08. Created alongside scheduled-emails cron drainer.

CREATE TABLE IF NOT EXISTS public.messages_email (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id   uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  template     text NOT NULL,
  subject      text NOT NULL,
  to_email     text NOT NULL,
  -- Resend's message ID (or other provider). Used for bounce-webhook lookup.
  provider_id  text,
  -- 'sent' | 'bounced' | 'delivered' | 'failed' | 'complained'
  status       text NOT NULL DEFAULT 'sent',
  error        text,
  -- variables that went into the template render. Useful for debugging.
  vars         jsonb DEFAULT '{}'::jsonb,
  -- 'manual' | 'cron' | 'bot-engine' | 'crm-button' | 'guide-download'
  trigger      text,
  sent_at      timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  bounced_at   timestamptz,
  opened_at    timestamptz,
  clicked_at   timestamptz
);

-- For per-contact thread + dedup queries
CREATE INDEX IF NOT EXISTS messages_email_contact_idx
  ON public.messages_email (contact_id, sent_at DESC);

-- For "have we sent template X to anyone in the last hour?" cron rate-limit checks
CREATE INDEX IF NOT EXISTS messages_email_template_idx
  ON public.messages_email (template, sent_at DESC);

-- Provider webhook lookups (Resend bounce/delivery callbacks)
CREATE INDEX IF NOT EXISTS messages_email_provider_idx
  ON public.messages_email (provider_id) WHERE provider_id IS NOT NULL;

-- RLS: same pattern as the rest of the BPP tables, authenticated + service_role full access
ALTER TABLE public.messages_email ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auth_full_messages_email ON public.messages_email;
CREATE POLICY auth_full_messages_email ON public.messages_email
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_full_messages_email ON public.messages_email;
CREATE POLICY service_full_messages_email ON public.messages_email
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Helper: "has this contact already received this template within last N hours?"
-- Used by scheduled-emails to enforce idempotency without manual notes-marker juggling.
CREATE OR REPLACE FUNCTION public.fn_recent_email_send(
  p_contact_id uuid,
  p_template   text,
  p_within_hours int DEFAULT 24
) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.messages_email
    WHERE contact_id = p_contact_id
      AND template = p_template
      AND sent_at > now() - (p_within_hours || ' hours')::interval
      AND status IN ('sent', 'delivered')
  );
$$ LANGUAGE sql STABLE;

COMMENT ON TABLE public.messages_email IS
  'Log of every customer-facing email sent via supabase/functions/send-email. Used for CRM thread continuity, bounce tracking, and idempotent cron-triggered lifecycle emails.';
