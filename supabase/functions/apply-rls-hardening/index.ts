/**
 * Applies 20260423_rls_hardening.sql — closes the CRITICAL/HIGH RLS
 * findings on sparky_memory, sparky_inbox, inspections, bpp_commands,
 * neighbor_cards + tightens sms_consent_log + cleans duplicate policies.
 * Idempotent. Delete this function after it's run.
 */

import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js'
import { requireServiceRole } from '../_shared/auth.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
}

const MIGRATION_SQL = `
DROP POLICY IF EXISTS "service_role_all" ON public.sparky_memory;
DROP POLICY IF EXISTS sparky_memory_service_role_all ON public.sparky_memory;
CREATE POLICY sparky_memory_service_role_all ON public.sparky_memory
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS sparky_memory_authenticated_read ON public.sparky_memory;
CREATE POLICY sparky_memory_authenticated_read ON public.sparky_memory
  AS PERMISSIVE FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.sparky_memory FROM anon;

DROP POLICY IF EXISTS "anon all inspections" ON public.inspections;
DROP POLICY IF EXISTS auth_all ON public.inspections;
DROP POLICY IF EXISTS inspections_service_role_all ON public.inspections;
DROP POLICY IF EXISTS inspections_authenticated_all ON public.inspections;
CREATE POLICY inspections_service_role_all ON public.inspections
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY inspections_authenticated_all ON public.inspections
  AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
REVOKE ALL ON public.inspections FROM anon;

DROP POLICY IF EXISTS service_role_all ON public.bpp_commands;
DROP POLICY IF EXISTS bpp_commands_service_role_all ON public.bpp_commands;
CREATE POLICY bpp_commands_service_role_all ON public.bpp_commands
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
REVOKE ALL ON public.bpp_commands FROM anon;

DROP POLICY IF EXISTS service_role_full ON public.neighbor_cards;
DROP POLICY IF EXISTS neighbor_cards_service_role_all ON public.neighbor_cards;
DROP POLICY IF EXISTS neighbor_cards_authenticated_read ON public.neighbor_cards;
CREATE POLICY neighbor_cards_service_role_all ON public.neighbor_cards
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY neighbor_cards_authenticated_read ON public.neighbor_cards
  AS PERMISSIVE FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.neighbor_cards FROM anon;

DROP POLICY IF EXISTS "service role full access" ON public.sparky_inbox;
DROP POLICY IF EXISTS service_role_all ON public.sparky_inbox;
DROP POLICY IF EXISTS sparky_inbox_service_role_all ON public.sparky_inbox;
DROP POLICY IF EXISTS sparky_inbox_authenticated_read ON public.sparky_inbox;
DROP POLICY IF EXISTS sparky_inbox_authenticated_update ON public.sparky_inbox;
CREATE POLICY sparky_inbox_service_role_all ON public.sparky_inbox
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY sparky_inbox_authenticated_read ON public.sparky_inbox
  AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY sparky_inbox_authenticated_update ON public.sparky_inbox
  AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
REVOKE ALL ON public.sparky_inbox FROM anon;

DROP POLICY IF EXISTS bpp_authenticated_all ON public.sms_consent_log;
DROP POLICY IF EXISTS sms_consent_log_auth_read ON public.sms_consent_log;
DROP POLICY IF EXISTS sms_consent_log_auth_insert ON public.sms_consent_log;
CREATE POLICY sms_consent_log_auth_read ON public.sms_consent_log
  AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY sms_consent_log_auth_insert ON public.sms_consent_log
  AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

-- Table-level immutability: even a misbehaving edge function using the
-- service role can no longer modify or delete existing consent records.
-- PostgreSQL RULEs run before policy checks and drop the operation
-- entirely. This is TCPA-level defense-in-depth.
REVOKE UPDATE, DELETE ON public.sms_consent_log FROM PUBLIC;
REVOKE UPDATE, DELETE ON public.sms_consent_log FROM anon, authenticated;
CREATE OR REPLACE RULE sms_consent_log_no_update AS ON UPDATE TO public.sms_consent_log DO INSTEAD NOTHING;
CREATE OR REPLACE RULE sms_consent_log_no_delete AS ON DELETE TO public.sms_consent_log DO INSTEAD NOTHING;

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
`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  const gate = requireServiceRole(req); if (gate) return gate

  const dbUrl = Deno.env.get('SUPABASE_DB_URL')
  if (!dbUrl) {
    return new Response(JSON.stringify({ error: 'SUPABASE_DB_URL not available' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const sql = postgres(dbUrl, { max: 1 })
  try {
    await sql.unsafe(MIGRATION_SQL)
    await sql.end()
    return new Response(JSON.stringify({ success: true, message: 'RLS hardening applied.' }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    await sql.end()
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
