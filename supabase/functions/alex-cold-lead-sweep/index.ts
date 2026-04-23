/**
 * alex-cold-lead-sweep — scheduled sweeper.
 *
 * Runs daily. Finds `alex_sessions` rows that:
 *   - are still status='active'
 *   - had their last customer message ≥ 30 days ago
 *   - have NOT already been post-mortem'd for 'cold' outcome
 * and fires alex-postmortem with outcome='cold' for each.
 *
 * This closes the learning loop on dead leads — Alex learns what
 * sequences precede drop-off, not just what precedes a booking.
 *
 * Idempotent via `cold_postmortem_at` timestamp on alex_sessions
 * (column added by schedule-alex-cold-cron migration).
 *
 * GET or POST — service-role gated.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireServiceRole } from '../_shared/auth.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
}

const COLD_WINDOW_DAYS = 30

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  const gate = requireServiceRole(req); if (gate) return gate

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const cutoff = new Date(Date.now() - COLD_WINDOW_DAYS * 86400000).toISOString()

  // Find candidate sessions. Conservative limit so a backlog doesn't
  // fan out 500 Claude calls at once; we'll eat through them on
  // successive daily runs until cleared.
  const { data: sessions, error } = await sb
    .from('alex_sessions')
    .select('session_id, phone, customer_last_msg_at, cold_postmortem_at, status, alex_active')
    .lte('customer_last_msg_at', cutoff)
    .is('cold_postmortem_at', null)
    .limit(25)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const results: any[] = []
  const sr = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  for (const s of sessions || []) {
    try {
      const resp = await fetch('https://reowtzedjflwmlptupbk.supabase.co/functions/v1/alex-postmortem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sr}` },
        body: JSON.stringify({
          sessionId: s.session_id,
          outcome: 'cold',
          note: `No customer reply for ${COLD_WINDOW_DAYS}+ days (last inbound ${s.customer_last_msg_at}).`,
        }),
      })
      const j = await resp.json().catch(() => ({}))
      // Mark so we don't re-run.
      await sb.from('alex_sessions').update({ cold_postmortem_at: new Date().toISOString() }).eq('session_id', s.session_id)
      results.push({ session_id: s.session_id, ok: resp.ok, toolCalls: j.toolCalls, note: (j.result || '').slice(0, 120) })
    } catch (e) {
      results.push({ session_id: s.session_id, ok: false, error: String(e).slice(0, 200) })
    }
  }

  return new Response(JSON.stringify({ success: true, candidates: (sessions || []).length, results }, null, 2), {
    status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
