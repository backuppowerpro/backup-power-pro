/**
 * cpl-watchdog — Monitors Meta ad CPL daily and auto-pauses on spike.
 *
 * Why: experiment-monitor runs daily and is the slow-loop sentinel. CPL spikes
 * can burn meaningful spend in <24h if a creative breaks or audience saturates.
 * This function runs hourly during ad-active periods, pulls last-24h spend +
 * leads, computes daily CPL, and either:
 *   - Auto-pauses any campaign with daily CPL >$50 for 2 consecutive readings
 *   - Writes alerts to sparky_inbox for less-severe deviations
 *
 * Decision rules (per EXP-2026-04-29-002 design):
 *   - CPL > $50 AND ≥2 hourly readings in row → AUTO-PAUSE (kill switch)
 *   - CPL > $30 AND <$50 → ALERT (high severity)
 *   - Daily leads = 0 AND spend > $10 → ALERT (high severity, audience problem)
 *   - CPL < $16 (early-win signal) → ALERT (low severity, info)
 *
 * Auto-pause uses meta-control's pause_campaign action with confirm:EXEC.
 * State is tracked in sparky_memory under key `cpl_watchdog:<campaign_id>`
 * so the "2 consecutive readings" rule works across hourly invocations.
 *
 * Auth: brain token only (server-to-server).
 * Designed for pg_cron hourly invocation during business hours.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { timingSafeEqual, sanitizeForLog } from '../_shared/auth.ts'

// Internal-only — brain-token-gated server-to-server, tightened per F15.
const CORS = {
  'Access-Control-Allow-Origin': 'https://backuppowerpro.com',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-bpp-brain-token',
}

const ACCOUNT_ID = 'act_923542753352966'
const META_API_BASE = 'https://graph.facebook.com/v21.0'

const KILL_CPL_THRESHOLD = 50.0     // $/lead — pause campaign if exceeded for 2+ readings
const ALERT_CPL_THRESHOLD = 30.0    // $/lead — high alert if exceeded
const EARLY_WIN_CPL = 16.0          // $/lead — info alert if blended is this good

interface Reading {
  campaign_id: string
  campaign_name: string
  spend: number
  leads: number
  cpl: number
  ts: string
}

async function metaGet(path: string, token: string): Promise<any> {
  const url = `${META_API_BASE}${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Meta API ${resp.status}: ${(await resp.text()).slice(0, 200)}`)
  return resp.json()
}

async function callEdge(path: string, body: any, brainToken: string, opts: { confirmExec?: boolean } = {}): Promise<any> {
  const GATEWAY_JWT = Deno.env.get('GATEWAY_JWT') || Deno.env.get('LEGACY_GATEWAY_BYPASS_JWT') || ''
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${GATEWAY_JWT}`,
    'x-bpp-brain-token': brainToken,
    'Content-Type': 'application/json',
  }
  // F14 — confirm sentinel travels in a header, not the body, so callers
  // have to make a deliberate two-step decision to authorise a write.
  if (opts.confirmExec) headers['x-bpp-confirm'] = 'EXEC'
  const resp = await fetch(`https://reowtzedjflwmlptupbk.supabase.co${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  if (!resp.ok) throw new Error(`${path}: ${resp.status} ${(await resp.text()).slice(0, 200)}`)
  return resp.json()
}

// F2 — Meta object IDs are numeric. Reject anything that contains a
// path separator, query split, or non-digit. This guards against any
// future bug where insights returns a malformed `campaign_id`.
const META_ID_RE = /^[0-9]{6,32}$/

async function logAlert(sb: any, alert: any): Promise<void> {
  try {
    await sb.from('sparky_inbox').insert({
      contact_id: null,
      source: 'cpl-watchdog',
      severity: alert.severity,
      message: alert.message,
      metadata: alert,
    })
  } catch (e) {
    console.warn('[cpl-watchdog] sparky_inbox failed:', String(e).slice(0, 200))
  }
  try {
    await sb.from('sparky_memory').upsert({
      key: `cpl_watchdog_alert:${new Date().toISOString()}`,
      value: JSON.stringify(alert),
    })
  } catch { /* best-effort */ }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  // ── Auth ────────────────────────────────────────────────────────────────
  const brainHdr = req.headers.get('x-bpp-brain-token') || ''
  const BRAIN = Deno.env.get('BPP_BRAIN_TOKEN') || ''
  if (!BRAIN || !timingSafeEqual(brainHdr, BRAIN)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const META_TOKEN = Deno.env.get('META_ACCESS_TOKEN') || Deno.env.get('FB_ACCESS_TOKEN') || ''
  if (!META_TOKEN) {
    return new Response(JSON.stringify({ error: 'META_ACCESS_TOKEN not configured' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // 1. Get last-24h campaign-level insights
  let insights: any[] = []
  try {
    const data = await metaGet(
      `/${ACCOUNT_ID}/insights?level=campaign&fields=campaign_id,campaign_name,spend,actions&date_preset=yesterday`,
      META_TOKEN,
    )
    insights = data?.data || []
  } catch (e) {
    return new Response(JSON.stringify({ error: 'meta_insights_failed', detail: String(e).slice(0, 500) }), {
      status: 502, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const readings: Reading[] = []
  const alerts: any[] = []
  const ts = new Date().toISOString()

  for (const ins of insights) {
    // Defence-in-depth: campaign_id flows from Meta's response into URL
    // paths and into meta-control bodies. Validate before trusting it.
    if (!META_ID_RE.test(String(ins.campaign_id || ''))) {
      console.warn('[cpl-watchdog] dropping insight with malformed campaign_id:', String(ins.campaign_id || '').slice(0, 80))
      continue
    }
    const spend = parseFloat(ins.spend || '0')
    if (spend === 0) continue // campaign wasn't running

    // Find lead count from actions array
    const actions = ins.actions || []
    let leads = 0
    for (const a of actions) {
      const t = String(a.action_type || '')
      if (t === 'lead' || t === 'leadgen.other' || t.startsWith('offsite_conversion.fb_pixel_lead') || t === 'onsite_conversion.lead_grouped') {
        leads = Math.max(leads, parseInt(a.value || '0'))
      }
    }
    const cpl = leads > 0 ? spend / leads : Infinity
    const reading: Reading = {
      campaign_id: ins.campaign_id,
      campaign_name: ins.campaign_name,
      spend, leads,
      cpl: Number.isFinite(cpl) ? Math.round(cpl * 100) / 100 : -1,
      ts,
    }
    readings.push(reading)

    // Persist this reading + check prior reading for the 2-in-a-row rule
    const memKey = `cpl_watchdog:${ins.campaign_id}`
    let priorReading: Reading | null = null
    try {
      const { data: prior } = await sb.from('sparky_memory').select('value').eq('key', memKey).maybeSingle()
      if (prior?.value) priorReading = JSON.parse(prior.value)
    } catch { /* no prior */ }

    // Save current reading
    try {
      await sb.from('sparky_memory').upsert({ key: memKey, value: JSON.stringify(reading) })
    } catch (e) {
      console.warn('[cpl-watchdog] memory upsert failed:', String(e).slice(0, 200))
    }

    // Apply rules
    const ZEROES_AND_SPEND = leads === 0 && spend > 10
    const KILL = reading.cpl > KILL_CPL_THRESHOLD && priorReading && priorReading.cpl > KILL_CPL_THRESHOLD
    const HIGH_CPL = reading.cpl > ALERT_CPL_THRESHOLD && reading.cpl <= KILL_CPL_THRESHOLD
    const EARLY_WIN = reading.cpl > 0 && reading.cpl <= EARLY_WIN_CPL && leads >= 5

    if (KILL) {
      // AUTO-PAUSE the campaign via meta-control
      let pauseResult: any = null
      try {
        pauseResult = await callEdge('/functions/v1/meta-control', {
          action: 'pause_campaign',
          campaign_id: ins.campaign_id,
        }, BRAIN, { confirmExec: true })
      } catch (e) {
        // Sanitise — Meta API error bodies can carry attacker-influenced
        // text and this lands in sparky_inbox.metadata for Claude to read.
        pauseResult = { error: sanitizeForLog(e, 200) }
      }
      const a = {
        severity: 'critical',
        rule: 'auto_pause_cpl_kill',
        campaign_id: ins.campaign_id,
        campaign_name: sanitizeForLog(ins.campaign_name, 80),
        message: `[CPL WATCHDOG] AUTO-PAUSED ${sanitizeForLog(ins.campaign_name, 80)} — daily CPL $${reading.cpl} for 2 consecutive readings (kill threshold $${KILL_CPL_THRESHOLD}). Pause result: ${sanitizeForLog(JSON.stringify(pauseResult), 200)}`,
        reading, priorReading,
      }
      alerts.push(a)
      await logAlert(sb, a)
    } else if (HIGH_CPL) {
      const a = {
        severity: 'high',
        rule: 'cpl_alert_threshold',
        campaign_id: ins.campaign_id,
        campaign_name: ins.campaign_name,
        message: `[CPL WATCHDOG] ${ins.campaign_name} daily CPL $${reading.cpl} (>${ALERT_CPL_THRESHOLD} alert threshold). One more reading at this level → auto-pause.`,
        reading,
      }
      alerts.push(a)
      await logAlert(sb, a)
    } else if (ZEROES_AND_SPEND) {
      const a = {
        severity: 'high',
        rule: 'zero_leads_with_spend',
        campaign_id: ins.campaign_id,
        campaign_name: ins.campaign_name,
        message: `[CPL WATCHDOG] ${ins.campaign_name} spent $${spend} yesterday with 0 leads. Audience saturation, broken creative, or tracking issue.`,
        reading,
      }
      alerts.push(a)
      await logAlert(sb, a)
    } else if (EARLY_WIN) {
      const a = {
        severity: 'low',
        rule: 'early_win_cpl',
        campaign_id: ins.campaign_id,
        campaign_name: ins.campaign_name,
        message: `[CPL WATCHDOG] ${ins.campaign_name} early-win signal — daily CPL $${reading.cpl} on ${leads} leads. Healthy.`,
        reading,
      }
      alerts.push(a)
      // Don't log low-severity to sparky_inbox — just memory
      try {
        await sb.from('sparky_memory').upsert({
          key: `cpl_watchdog_info:${new Date().toISOString()}`,
          value: JSON.stringify(a),
        })
      } catch { /* best-effort */ }
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    generated_at: ts,
    readings,
    alerts,
    actions_taken: alerts.filter(a => a.rule === 'auto_pause_cpl_kill').length,
  }, null, 2), {
    status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
