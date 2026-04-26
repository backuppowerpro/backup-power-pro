/**
 * crm-stats — RLS-bypassing pipeline + activity rollup for the brain refresh.
 *
 * Replaces the `fetch-crm-stats.sh` direct REST query against the rotated
 * service-role JWT (we removed that JWT from credentials.md after the
 * 2026-04-23 leak audit). This edge function uses the SR key Supabase
 * auto-injects into Deno.env, so it can bypass RLS without leaking a JWT
 * to the local filesystem.
 *
 * Returns a JSON object consumed by `scripts/brain/fetch-crm-stats.sh`:
 *   {
 *     active_contacts, archived_contacts, dnc_contacts, total_contacts,
 *     stages: { 1: count, ..., 9: count },
 *     pipeline_value, avg_quote, won_value_30d,
 *     msgs_7d_total, msgs_7d_inbound, msgs_7d_outbound, msgs_7d_alex, msgs_7d_key,
 *     calls_7d, voicemails_7d,
 *     new_leads_30d, new_leads_7d, won_leads_30d, conversion_rate_30d,
 *     followup_pending,
 *     ai_enabled_count, ai_paused_count
 *   }
 *
 * Auth: requires a bearer matching the SUPABASE_PUBLISHABLE_KEY (or the
 * SR key — both pass). No PII in the response (counts + value rollups
 * only) so anon access is acceptable; we still gate to prevent random
 * scrapers from pulling pipeline_value. The same publishable key is
 * embedded in the brain-refresh scripts that call this endpoint.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  const url = Deno.env.get('SUPABASE_URL')!
  const sr  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Caller must present either the publishable key or the SR key as
  // bearer. The publishable key is acceptable here because the response
  // contains only count rollups, no PII. SR support kept for trusted
  // server-side callers.
  // Supabase reserves the SUPABASE_ prefix for secrets so we use BPP_.
  const PUB = Deno.env.get('BPP_PUBLISHABLE_KEY') || 'sb_publishable_4tYd9eFAYCTjnoKl1hbBBg_yyO9-vMB'
  const auth = req.headers.get('authorization') || req.headers.get('Authorization') || ''
  if (!auth.includes(sr) && (!PUB || !auth.includes(PUB))) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const sb = createClient(url, sr)

  // 7-day and 30-day cutoffs — using ISO since the contacts.created_at
  // column is timestamptz.
  const now = Date.now()
  const sevenDaysAgo  = new Date(now - 7  * 86400000).toISOString()
  const thirtyDaysAgo = new Date(now - 30 * 86400000).toISOString()

  // One read per logical bucket — Supabase routes through PostgREST so each
  // call is one round-trip. Total ~7 round-trips, ~150ms warm.
  const [
    contactsRes, msgsRes, followupRes, callsRes, newLeads30Res,
  ] = await Promise.all([
    sb.from('contacts')
      .select('id, stage, status, quote_amount, ai_enabled, ai_paused_until, do_not_contact, created_at')
      .limit(2000),
    sb.from('messages')
      .select('id, direction, sender, status, created_at')
      .gte('created_at', sevenDaysAgo)
      .limit(10000),
    sb.from('follow_up_queue')
      .select('id, scheduled_for, completed', { count: 'exact', head: true })
      .eq('completed', false),
    sb.from('messages')
      .select('id, status, created_at', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo)
      .in('status', ['call', 'voicemail', 'missed']),
    sb.from('contacts')
      .select('id, stage, status, created_at, quote_amount')
      .gte('created_at', thirtyDaysAgo)
      .limit(2000),
  ])

  if (contactsRes.error || msgsRes.error) {
    return new Response(JSON.stringify({
      error: 'query failed',
      contacts: contactsRes.error?.message,
      messages: msgsRes.error?.message,
    }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  const contacts = contactsRes.data || []
  const msgs     = msgsRes.data || []
  const newLeads = newLeads30Res.data || []

  // ── Contacts rollup ────────────────────────────────────────────────────
  let active = 0, archived = 0, dnc = 0
  let aiEnabled = 0, aiPaused = 0
  let pipelineValue = 0
  let quoteCount = 0
  let quoteSum   = 0
  const stages: Record<number, number> = {}
  for (const c of contacts) {
    if (c.do_not_contact) dnc++
    if (c.status === 'Archived') { archived++; continue }
    active++
    const s = Number(c.stage || 1)
    stages[s] = (stages[s] || 0) + 1
    if (c.ai_enabled) aiEnabled++
    if (c.ai_paused_until && new Date(c.ai_paused_until).getTime() > now) aiPaused++
    if (c.quote_amount && Number(c.quote_amount) > 0 && s < 9) {
      pipelineValue += Number(c.quote_amount)
    }
    if (c.quote_amount && Number(c.quote_amount) > 0) {
      quoteCount++
      quoteSum += Number(c.quote_amount)
    }
  }

  // ── Conversion: 30-day cohort ─────────────────────────────────────────
  let new30 = 0, new7 = 0, won30Count = 0, won30Value = 0
  for (const c of newLeads) {
    new30++
    if (new Date(c.created_at).getTime() >= now - 7 * 86400000) new7++
    if (Number(c.stage || 1) >= 9) {
      won30Count++
      won30Value += Number(c.quote_amount || 0)
    }
  }
  const conversionRate30 = new30 > 0 ? Math.round((won30Count / new30) * 1000) / 10 : 0

  // ── Messages rollup (7d) ──────────────────────────────────────────────
  let inbound = 0, outbound = 0, alexOut = 0, keyOut = 0
  for (const m of msgs) {
    if (m.direction === 'inbound') inbound++
    else if (m.direction === 'outbound') {
      outbound++
      if (m.sender === 'ai') alexOut++
      else if (m.sender === 'user' || m.sender === 'key') keyOut++
    }
  }

  return new Response(JSON.stringify({
    active_contacts: active,
    archived_contacts: archived,
    dnc_contacts: dnc,
    total_contacts: active + archived,
    stages,
    pipeline_value: pipelineValue,
    avg_quote: quoteCount > 0 ? Math.round(quoteSum / quoteCount) : 0,
    won_value_30d: won30Value,
    msgs_7d_total: msgs.length,
    msgs_7d_inbound: inbound,
    msgs_7d_outbound: outbound,
    msgs_7d_alex: alexOut,
    msgs_7d_key: keyOut,
    calls_7d: callsRes.count || 0,
    new_leads_30d: new30,
    new_leads_7d: new7,
    won_leads_30d: won30Count,
    conversion_rate_30d: conversionRate30,
    followup_pending: followupRes.count || 0,
    ai_enabled_count: aiEnabled,
    ai_paused_count: aiPaused,
    generated_at: new Date().toISOString(),
  }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
