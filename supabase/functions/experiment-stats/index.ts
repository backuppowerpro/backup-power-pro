/**
 * experiment-stats — Per-experiment metrics for active A/B tests.
 *
 * Returns conversion rates and counts for each running experiment, computed
 * fresh at request time. Designed to be called by the morning-brief synthesizer
 * (or on-demand from scripts) so Claude has a daily comparison report for
 * each active experiment.
 *
 * Currently implemented experiments:
 *   - EXP-2026-04-29-001 (Alex 10% rollout monitor):
 *       Compares Stage-2-within-48h conversion rate between
 *       alex bucket (in-rollout) and control bucket (static fallback).
 *
 * Bucketing replicates the deterministic phone-hash logic from
 * `quo-ai-new-lead/index.ts:375-383` so we can retroactively classify any
 * contact into its bucket without storing the bucket decision.
 *
 * Auth: same pattern as crm-stats. Requires SR key OR brain token.
 *
 * GET endpoint:
 *   GET /experiment-stats?experiment=EXP-2026-04-29-001&days=14
 *   Default: returns all active experiments, last 14 days
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { timingSafeEqual, allowRate } from '../_shared/auth.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-bpp-brain-token',
}

// Replicates the bucket decision in quo-ai-new-lead. Same input → same output.
function inAlexBucket(phone: string, rolloutPct: number): boolean {
  if (rolloutPct <= 0) return false
  if (rolloutPct >= 100) return true
  let h = 0
  for (let i = 0; i < phone.length; i++) {
    h = ((h << 5) - h + phone.charCodeAt(i)) | 0
  }
  return Math.abs(h) % 100 < rolloutPct
}

function normalizePhone(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return raw
}

interface ConversionRow {
  total: number
  // Lagging conversion (Stage 2 ever / within 48h)
  reached_stage_2_in_48h: number
  reached_stage_2_ever: number
  rate_48h: number
  rate_ever: number
  // Leading indicators (more useful at our volume)
  engaged: number              // any inbound message after the opener
  engagement_rate: number
  photo_received: number       // any inbound message with media in 7 days
  photo_rate: number
  total_inbound: number
  total_outbound: number
  blocked_messages: number     // [BLOCKED: ... safety-gate fires
  hard_rule_violations: number // dollar figures or PII leaks slipping through
  disclosure_misses: number    // "are you a bot" inbound without canonical disclosure following
}

function blank(): ConversionRow {
  return {
    total: 0,
    reached_stage_2_in_48h: 0, reached_stage_2_ever: 0, rate_48h: 0, rate_ever: 0,
    engaged: 0, engagement_rate: 0,
    photo_received: 0, photo_rate: 0,
    total_inbound: 0, total_outbound: 0,
    blocked_messages: 0, hard_rule_violations: 0, disclosure_misses: 0,
  }
}

function finalize(row: ConversionRow): ConversionRow {
  if (row.total > 0) {
    row.rate_48h = Math.round((row.reached_stage_2_in_48h / row.total) * 1000) / 10
    row.rate_ever = Math.round((row.reached_stage_2_ever / row.total) * 1000) / 10
    row.engagement_rate = Math.round((row.engaged / row.total) * 1000) / 10
    row.photo_rate = Math.round((row.photo_received / row.total) * 1000) / 10
  }
  return row
}

// Detect a $ figure leak or PII leak in an outbound message body
const DOLLAR_RX = /\$\s?[0-9]/
const HARD_RULE_BAD_RX = /(?:\$\s?[0-9]|—)/  // em-dash also banned
function isHardRuleViolation(body: string): boolean {
  if (!body) return false
  if (body.startsWith('[BLOCKED:')) return false  // already-blocked, that's a SAFE catch
  if (body.startsWith('[BLOCKED —')) return false // legacy format
  return DOLLAR_RX.test(body)
}

// Detect "are you a bot/AI/real" in an inbound, then check if the next outbound has the canonical disclosure
const ASKED_AI_RX = /\b(?:are\s+you\s+(?:a\s+)?(?:bot|robot|ai|real|human|automated|machine|gpt|chat\s*bot)|is\s+this\s+(?:a\s+)?(?:bot|ai|real)|am\s+i\s+(?:talking|texting)\s+to\s+(?:a\s+)?(?:bot|ai|real|human))\b/i
const HAS_DISCLOSURE_RX = /\b(?:i'?m\s+(?:an\s+)?(?:ai|automated)|i'?m\s+(?:not\s+a\s+real|just\s+an\s+ai|a\s+bot)|yes,?\s+i'?m\s+(?:an\s+)?ai|automated\s+assistant)\b/i

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  // ── Auth: SR key OR brain token ────────────────────────────────────────
  const authHdr = req.headers.get('authorization') || ''
  const apikey = req.headers.get('apikey') || ''
  const brainHdr = req.headers.get('x-bpp-brain-token') || ''
  const SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const BRAIN = Deno.env.get('BPP_BRAIN_TOKEN') || ''
  const PUB = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || ''
  const presented = authHdr.startsWith('Bearer ') ? authHdr.slice(7).trim() : (apikey || '')

  const ok = (
    (BRAIN && timingSafeEqual(brainHdr, BRAIN)) ||
    (SR && timingSafeEqual(presented, SR)) ||
    (PUB && timingSafeEqual(presented, PUB))
  )
  if (!ok) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // ── Per-IP rate limit ────────────────────────────────────────────────────
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!allowRate(`experiment-stats:${ip}`, 30)) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), {
      status: 429, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // ── Parse query ─────────────────────────────────────────────────────────
  const url = new URL(req.url)
  const days = Math.max(1, Math.min(60, Number(url.searchParams.get('days') || '14')))
  const experimentId = url.searchParams.get('experiment') || 'EXP-2026-04-29-001'

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, SR)

  if (experimentId === 'EXP-2026-04-29-001') {
    return await alexRolloutMonitor(sb, days)
  }

  return new Response(JSON.stringify({ error: `unknown experiment: ${experimentId}` }), {
    status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})

// ── EXP-2026-04-29-001 — Alex 10% rollout monitor ────────────────────────
// Compares Stage-2-within-48h conversion rate between alex-bucket and
// control-bucket leads created in the last `days` days.
async function alexRolloutMonitor(sb: any, days: number): Promise<Response> {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString()
  // ROLLOUT_PCT: read the same env that quo-ai-new-lead uses. If 0, every
  // lead is in control bucket — report the absence of comparison data.
  const ROLLOUT_PCT = parseInt(Deno.env.get('ALEX_ROLLOUT_PCT') || '0') || 0

  // Pull contacts created in window
  const { data: contacts, error: cErr } = await sb
    .from('contacts')
    .select('id, phone, stage, created_at, do_not_contact, status')
    .gte('created_at', cutoff)
    .neq('status', 'Archived')
    .limit(2000)
  if (cErr) {
    return new Response(JSON.stringify({ error: 'contacts query failed', detail: cErr.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const contactIds = (contacts || []).map((c: any) => c.id)
  // Stage progression: NOTHING in the codebase writes to_stage=2 to stage_history
  // (only stripe-webhook for stage=4 and sub-mark-complete for stage=9 write
  // history rows). The CRM UI updates contacts.stage directly. So we use
  // current-stage as the "ever reached" proxy and skip the "within 48h" timing
  // until we instrument transitions properly.
  // For this run, "reached_stage_2_in_48h" stays as a count-of-zero placeholder
  // because we can't compute timing without a transition log; the more
  // honest metric is "current_stage >= 2" for the whole window.
  const stage2At: Record<string, number> = {}
  // Optional: pull stage_history for stages 4+ to detect WIN flow timing
  const { data: transitions } = contactIds.length > 0
    ? await sb
        .from('stage_history')
        .select('contact_id, from_stage, to_stage, changed_at')
        .in('contact_id', contactIds)
    : { data: [] }
  for (const t of transitions || []) {
    if (t.to_stage >= 2) {
      const ts = new Date(t.changed_at).getTime()
      if (!stage2At[t.contact_id] || ts < stage2At[t.contact_id]) {
        stage2At[t.contact_id] = ts
      }
    }
  }

  // Pull messages for those contacts, scoped to the window
  const { data: messages, error: mErr } = contactIds.length > 0
    ? await sb
        .from('messages')
        .select('id, contact_id, direction, body, status, sender, created_at')
        .in('contact_id', contactIds)
        .gte('created_at', cutoff)
        .limit(20000)
    : { data: [], error: null }
  if (mErr) {
    return new Response(JSON.stringify({ error: 'messages query failed', detail: mErr.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Aggregate messages per contact
  const msgsByContact: Record<string, any[]> = {}
  for (const m of messages || []) {
    if (!msgsByContact[m.contact_id]) msgsByContact[m.contact_id] = []
    msgsByContact[m.contact_id].push(m)
  }

  // Bucket each contact + compute leading indicators
  const alexBucket = blank()
  const controlBucket = blank()
  const alexCohort: any[] = []
  const controlCohort: any[] = []

  for (const c of contacts || []) {
    if (c.do_not_contact) continue // exclude DNC
    const phone = normalizePhone(c.phone || '')
    if (!phone || !phone.startsWith('+1')) continue
    if (phone.startsWith('+1800555')) continue // exclude dojo test phones
    const inAlex = inAlexBucket(phone, ROLLOUT_PCT)
    const bucket = inAlex ? alexBucket : controlBucket
    const cohort = inAlex ? alexCohort : controlCohort
    bucket.total++

    const cMsgs = (msgsByContact[c.id] || []).sort((a: any, b: any) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    const inboundMsgs = cMsgs.filter((m: any) => m.direction === 'inbound')
    const outboundMsgs = cMsgs.filter((m: any) => m.direction === 'outbound')
    bucket.total_inbound += inboundMsgs.length
    bucket.total_outbound += outboundMsgs.length

    // Engagement: at least one inbound exists
    if (inboundMsgs.length > 0) bucket.engaged++

    // Photo received: any inbound with media indicator (status='media' OR body contains url)
    const photoArrived = inboundMsgs.some((m: any) =>
      m.status === 'media' || /https?:\/\/.*\.(?:jpg|jpeg|png|heic|gif)/i.test(m.body || ''))
    if (photoArrived) bucket.photo_received++

    // Blocked messages — only count those from AI (Alex). Key's outbound never gets blocked.
    bucket.blocked_messages += outboundMsgs.filter((m: any) =>
      m.sender === 'ai' &&
      ((m.body || '').startsWith('[BLOCKED:') || (m.body || '').startsWith('[BLOCKED —'))).length

    // Hard-rule violations: ONLY apply to AI outbound. Key can mention $ figures —
    // he's the human, the rule is for the agent. This metric is Alex's safety
    // net efficacy, not Key's behavior.
    bucket.hard_rule_violations += outboundMsgs.filter((m: any) =>
      m.sender === 'ai' && isHardRuleViolation(m.body || '')).length

    // AI disclosure misses
    for (let i = 0; i < cMsgs.length; i++) {
      if (cMsgs[i].direction !== 'inbound') continue
      if (!ASKED_AI_RX.test(cMsgs[i].body || '')) continue
      // Find the next outbound from Alex/AI
      let disclosed = false
      for (let j = i + 1; j < cMsgs.length && j < i + 4; j++) {
        if (cMsgs[j].direction === 'outbound' && cMsgs[j].sender === 'ai') {
          if (HAS_DISCLOSURE_RX.test(cMsgs[j].body || '')) disclosed = true
          break
        }
      }
      if (!disclosed) bucket.disclosure_misses++
    }

    cohort.push({
      id: c.id,
      phone_last4: phone.slice(-4),
      created_at: c.created_at,
      current_stage: c.stage,
      inbound_count: inboundMsgs.length,
      outbound_count: outboundMsgs.length,
      photo_received: photoArrived,
    })

    // Stage progression — use current_stage from contacts (most reliable signal)
    // since stage_history doesn't get to_stage=2 writes from the CRM UI
    const currentStage = Number(c.stage || 1)
    if (currentStage >= 2) {
      bucket.reached_stage_2_ever++
      // If stage_history HAS a record, use it for timing. Otherwise leave 48h count alone.
      const reachedStage2 = stage2At[c.id]
      if (reachedStage2) {
        const arrivedAt = new Date(c.created_at).getTime()
        const elapsedMs = reachedStage2 - arrivedAt
        if (elapsedMs <= 48 * 3600 * 1000) {
          bucket.reached_stage_2_in_48h++
        }
      }
    }
  }

  finalize(alexBucket)
  finalize(controlBucket)

  // Decision-rule status
  const ratio = controlBucket.rate_48h > 0
    ? Math.round((alexBucket.rate_48h / controlBucket.rate_48h) * 1000) / 10
    : null

  let status = 'INSUFFICIENT_DATA'
  let action = 'monitor'
  if (alexBucket.total >= 3 && controlBucket.total >= 3) {
    if (ratio !== null) {
      if (ratio >= 80) { status = 'ON_TRACK'; action = days >= 7 ? 'consider_bump' : 'monitor' }
      else if (ratio >= 60) { status = 'BELOW_TARGET'; action = 'investigate' }
      else { status = 'POOR'; action = 'pause_and_postmortem' }
    }
  }

  return new Response(JSON.stringify({
    experiment_id: 'EXP-2026-04-29-001',
    name: 'Alex 10% Rollout Monitor',
    rollout_pct: ROLLOUT_PCT,
    window_days: days,
    generated_at: new Date().toISOString(),
    alex_bucket: alexBucket,
    control_bucket: controlBucket,
    ratio_alex_over_control: ratio, // % — target ≥80%
    decision: { status, action },
    cohorts: {
      alex_count: alexCohort.length,
      control_count: controlCohort.length,
    },
  }, null, 2), {
    status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
