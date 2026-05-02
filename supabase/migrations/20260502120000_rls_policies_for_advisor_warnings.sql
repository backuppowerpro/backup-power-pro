-- 2026-05-02 — RLS policies on 7 tables flagged by Supabase Security
-- Advisor as "RLS enabled, no policies."
--
-- "RLS on with no policies" locks out everyone except service_role
-- (which bypasses). For most of these that's the intent (internal
-- bot/queue tables only edge functions should touch), but `messages`
-- and `contact_photos` are read by the CRM frontend with the
-- authenticated role — those queries silently return zero rows today.
-- This adds the explicit policies so:
--   1. Advisor goes green (no more weekly emails).
--   2. CRM authenticated reads/writes work as designed.
--   3. Each grant is intentional + documented vs the "RLS bypass via
--      no-policies" footgun.
--
-- All policies are additive — `service_role` already has bypass; we're
-- only granting `authenticated` (Key signed in to the CRM) where the
-- frontend actually needs it.

-- ── alex_sessions — Alex agent run state. Edge-function only ────────
DROP POLICY IF EXISTS "service_role manages alex_sessions" ON public.alex_sessions;
CREATE POLICY "service_role manages alex_sessions"
  ON public.alex_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── bot_conversation_outcomes — Alex postmortems. Edge only ─────────
DROP POLICY IF EXISTS "service_role manages bot_conversation_outcomes" ON public.bot_conversation_outcomes;
CREATE POLICY "service_role manages bot_conversation_outcomes"
  ON public.bot_conversation_outcomes FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── bot_notes — Alex internal notes. Edge only ──────────────────────
DROP POLICY IF EXISTS "service_role manages bot_notes" ON public.bot_notes;
CREATE POLICY "service_role manages bot_notes"
  ON public.bot_notes FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── follow_up_queue — auto-followup cron queue. Edge only ───────────
DROP POLICY IF EXISTS "service_role manages follow_up_queue" ON public.follow_up_queue;
CREATE POLICY "service_role manages follow_up_queue"
  ON public.follow_up_queue FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── payments — Stripe webhook writes; CRM reads ─────────────────────
-- CRM v3 surfaces Stripe payments in the Finance pane (when wired up).
-- Authenticated users (Key) read; service_role writes (webhook).
DROP POLICY IF EXISTS "service_role manages payments" ON public.payments;
CREATE POLICY "service_role manages payments"
  ON public.payments FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated reads payments" ON public.payments;
CREATE POLICY "authenticated reads payments"
  ON public.payments FOR SELECT TO authenticated USING (true);

-- ── contact_photos — CRM v3 reads + writes (Photos card) ────────────
DROP POLICY IF EXISTS "service_role manages contact_photos" ON public.contact_photos;
CREATE POLICY "service_role manages contact_photos"
  ON public.contact_photos FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated manages contact_photos" ON public.contact_photos;
CREATE POLICY "authenticated manages contact_photos"
  ON public.contact_photos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── messages — CRM v3 reads/writes; Twilio webhook + send-sms write ─
-- CRITICAL: without this policy the Inbox tab is empty for Key. Service
-- role bypass (used by edge fns) was the only path that worked before;
-- the CRM's authenticated reads silently returned zero rows.
DROP POLICY IF EXISTS "service_role manages messages" ON public.messages;
CREATE POLICY "service_role manages messages"
  ON public.messages FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated manages messages" ON public.messages;
CREATE POLICY "authenticated manages messages"
  ON public.messages FOR ALL TO authenticated USING (true) WITH CHECK (true);
