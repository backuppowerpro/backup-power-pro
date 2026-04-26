-- BPP Supabase RLS hardening — 2026-04-23
-- Closes the CRITICAL / HIGH findings from the 2026-04-23 RLS audit:
-- every policy without a `TO` clause defaulted to PUBLIC (anon + auth +
-- service_role). Multiple policies with `USING(true)` were therefore
-- fully open to anon, exposing business secrets and allowing forged
-- writes. This migration re-creates each policy scoped to the right
-- role and explicitly REVOKEs anon privileges.
--
-- The proposals + invoices anon-direct bypass is fixed in a separate
-- migration (20260423_proposals_lockdown.sql) that is applied AFTER
-- the frontend has been migrated to edge functions, so customer-facing
-- pages keep working.

BEGIN;

-- ============================================================
-- C1: sparky_memory — was fully open to anon read/write. Business
-- secrets (pricing floor, CEO brief, strategic vision) were exposed.
-- ============================================================
DROP POLICY IF EXISTS "service_role_all" ON public.sparky_memory;
CREATE POLICY sparky_memory_service_role_all ON public.sparky_memory
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY sparky_memory_authenticated_read ON public.sparky_memory
  AS PERMISSIVE FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.sparky_memory FROM anon;

-- ============================================================
-- H1: inspections — explicit `anon all inspections FOR ALL USING(true)`
-- was an intentional broad open. Replaced with service_role + auth.
-- ============================================================
DROP POLICY IF EXISTS "anon all inspections" ON public.inspections;
DROP POLICY IF EXISTS auth_all ON public.inspections;
CREATE POLICY inspections_service_role_all ON public.inspections
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY inspections_authenticated_all ON public.inspections
  AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
REVOKE ALL ON public.inspections FROM anon;

-- ============================================================
-- H2: bpp_commands — SMS-command bridge for Key's personal texts.
-- Anyone was able to forge commands into the queue.
-- ============================================================
DROP POLICY IF EXISTS service_role_all ON public.bpp_commands;
CREATE POLICY bpp_commands_service_role_all ON public.bpp_commands
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
REVOKE ALL ON public.bpp_commands FROM anon;

-- ============================================================
-- H3: neighbor_cards — ad A/B + postcard conversion tracking.
-- ============================================================
DROP POLICY IF EXISTS service_role_full ON public.neighbor_cards;
CREATE POLICY neighbor_cards_service_role_all ON public.neighbor_cards
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY neighbor_cards_authenticated_read ON public.neighbor_cards
  AS PERMISSIVE FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.neighbor_cards FROM anon;

-- ============================================================
-- H4: sparky_inbox — agent report inbox. Had two duplicate
-- roles=public policies (run-migration + dedicated migration).
-- ============================================================
DROP POLICY IF EXISTS "service role full access" ON public.sparky_inbox;
DROP POLICY IF EXISTS service_role_all ON public.sparky_inbox;
CREATE POLICY sparky_inbox_service_role_all ON public.sparky_inbox
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY sparky_inbox_authenticated_read ON public.sparky_inbox
  AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY sparky_inbox_authenticated_update ON public.sparky_inbox
  AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
REVOKE ALL ON public.sparky_inbox FROM anon;

-- ============================================================
-- L2: sms_consent_log — legal audit trail must be append-only.
-- Authenticated should be able to read + insert but NOT update/delete.
-- ============================================================
DROP POLICY IF EXISTS bpp_authenticated_all ON public.sms_consent_log;
CREATE POLICY sms_consent_log_auth_read ON public.sms_consent_log
  AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY sms_consent_log_auth_insert ON public.sms_consent_log
  AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
-- no UPDATE or DELETE policies → default-deny → immutable for auth

-- ============================================================
-- M2: drop dup auth_all (roles=public) policies across tables.
-- Each of these tables has an auth_full_* policy (roles=authenticated)
-- which is clearer and functionally equivalent.
-- ============================================================
DROP POLICY IF EXISTS auth_all ON public.contacts;
DROP POLICY IF EXISTS auth_all ON public.permit_jurisdictions;
DROP POLICY IF EXISTS auth_all ON public.permit_people;
DROP POLICY IF EXISTS auth_all ON public.permit_stage_events;
DROP POLICY IF EXISTS auth_all ON public.schedule;
DROP POLICY IF EXISTS auth_all ON public.stage_history;
DROP POLICY IF EXISTS auth_all ON public.messages;
DROP POLICY IF EXISTS auth_all ON public.payments;
DROP POLICY IF EXISTS auth_all ON public.alex_sessions;
DROP POLICY IF EXISTS auth_all ON public.bot_conversation_outcomes;
DROP POLICY IF EXISTS auth_all ON public.bot_notes;
DROP POLICY IF EXISTS auth_all ON public.contact_photos;
DROP POLICY IF EXISTS auth_all ON public.follow_up_queue;

COMMIT;
