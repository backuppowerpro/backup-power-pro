/**
 * posthog-stats — PostHog HogQL-backed stats for landing-page experiments.
 *
 * Why this exists: experiment-monitor needs per-variant conversion data for
 * landing-page tests (EXP-003 hero copy, EXP-005 CTA copy, etc.) but that
 * data lives in PostHog, not Supabase. This function wraps PostHog's HogQL
 * query API so other edge functions can query it without juggling PostHog
 * API keys themselves.
 *
 * Auth: brain token only (server-to-server).
 *
 * Endpoints:
 *   GET /posthog-stats?experiment=meta-hero-v1&days=30
 *     → returns per-variant counts: pageviews, form_starts, captures, delivered, scroll_depth
 *     → returns lift relative to control variant
 *     → returns decision-rule status (early_win | early_kill | running | inconclusive)
 *
 *   GET /posthog-stats?action=channel_funnel&days=7
 *     → returns the per-channel funnel (baseline / meta / google / organic)
 *     → same data fetch-posthog.sh writes to wiki, but as JSON for programmatic use
 */

import { timingSafeEqual } from '../_shared/auth.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-bpp-brain-token',
}

const POSTHOG_HOST = 'https://us.posthog.com'
const PROJECT_ID = '356571'

async function hogql(query: string, apiKey: string): Promise<any> {
  const resp = await fetch(`${POSTHOG_HOST}/api/projects/${PROJECT_ID}/query/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
  })
  if (!resp.ok) {
    const txt = await resp.text()
    throw new Error(`PostHog ${resp.status}: ${txt.slice(0, 200)}`)
  }
  return resp.json()
}

async function variantStats(experimentKey: string, days: number, apiKey: string): Promise<any> {
  // The flag fires `$feature_flag_called` with $feature_flag and $feature_flag_response.
  // Variants are also registered as a person/session property called `hero_variant`
  // (for meta-hero-v1) — but to keep this generic, we use the $feature_flag_called event.
  //
  // For each variant, count:
  //   - exposures (people who saw the flag fire)
  //   - lead_form_started (engagement)
  //   - lead_captured (conversion)
  //   - lead_captured AND properties.delivered = true (delivered conversion)
  // Then compute lift relative to the variant named "control".
  // PostHog's $feature_flag_called events store the flag key + variant as
  // PROPERTIES, not bare columns. Access via properties.$feature_flag etc.
  const q = `
    SELECT
      properties.$feature_flag_response AS variant,
      count() AS exposures
    FROM events
    WHERE timestamp >= now() - INTERVAL ${days} DAY
      AND event = '$feature_flag_called'
      AND properties.$feature_flag = '${experimentKey}'
    GROUP BY variant
    ORDER BY exposures DESC
  `
  // First get exposures per variant
  const expData = await hogql(q.trim(), apiKey)
  const exposures: Record<string, number> = {}
  for (const r of expData.results || []) {
    if (r[0]) exposures[r[0]] = r[1]
  }

  // Now query distinct_ids per variant for downstream conversion lookup.
  // PostHog's HogQL doesn't easily join exposure → conversion via flag, so
  // we use the registered property `hero_variant` (set via posthog.register())
  // on subsequent events for this person. That ties downstream events back
  // to the variant they were bucketed into.
  const convQ = `
    SELECT
      properties.hero_variant AS variant,
      countIf(event = 'lead_form_started') AS form_starts,
      countIf(event = 'lead_captured') AS captures,
      countIf(event = 'lead_captured' AND properties.delivered = true) AS delivered,
      uniqIf(distinct_id, event = 'lead_form_started') AS uniq_form_starters,
      uniqIf(distinct_id, event = 'lead_captured') AS uniq_capturers
    FROM events
    WHERE timestamp >= now() - INTERVAL ${days} DAY
      AND properties.hero_variant IS NOT NULL
    GROUP BY variant
  `
  const convData = await hogql(convQ.trim(), apiKey)
  const conv: Record<string, any> = {}
  for (const r of convData.results || []) {
    if (r[0]) {
      conv[r[0]] = {
        form_starts: r[1] || 0,
        captures: r[2] || 0,
        delivered: r[3] || 0,
        uniq_form_starters: r[4] || 0,
        uniq_capturers: r[5] || 0,
      }
    }
  }

  // Build per-variant rollup
  const variants: any[] = []
  const allKeys = new Set([...Object.keys(exposures), ...Object.keys(conv)])
  for (const k of allKeys) {
    const e = exposures[k] || 0
    const c = conv[k] || { form_starts: 0, captures: 0, delivered: 0, uniq_form_starters: 0, uniq_capturers: 0 }
    variants.push({
      variant: k,
      exposures: e,
      form_starts: c.form_starts,
      captures: c.captures,
      delivered: c.delivered,
      capture_rate: e > 0 ? Math.round((c.captures / e) * 1000) / 10 : 0,
      delivered_rate: e > 0 ? Math.round((c.delivered / e) * 1000) / 10 : 0,
      form_start_rate: e > 0 ? Math.round((c.form_starts / e) * 1000) / 10 : 0,
    })
  }

  // Compute lift relative to control
  const control = variants.find(v => v.variant === 'control')
  for (const v of variants) {
    if (control && control.capture_rate > 0) {
      v.lift_vs_control_pct = Math.round(((v.capture_rate - control.capture_rate) / control.capture_rate) * 1000) / 10
    } else {
      v.lift_vs_control_pct = null
    }
  }

  // Decision-rule status (matches EXP-003 design rules)
  let decision_status = 'INSUFFICIENT_DATA'
  let recommended_action = 'continue_running'

  if (variants.length === 0) {
    decision_status = 'NO_DATA_YET'
    recommended_action = 'wait_for_traffic'
  } else {
    const minCaptures = Math.min(...variants.map(v => v.captures))
    const winner = variants.find(v => v.lift_vs_control_pct !== null && v.lift_vs_control_pct >= 50 && v.captures >= 30)
    const breaker = variants.find(v => control && v.form_start_rate < control.form_start_rate * 0.5 && v.exposures >= 50)

    if (breaker) {
      decision_status = 'BROKEN_VARIANT'
      recommended_action = `disable_variant:${breaker.variant}`
    } else if (winner) {
      decision_status = 'EARLY_WIN'
      recommended_action = `ship_variant:${winner.variant}`
    } else if (minCaptures >= 60) {
      const lifter = variants.find(v => v.lift_vs_control_pct !== null && v.lift_vs_control_pct >= 30)
      if (lifter) {
        decision_status = 'WINNER_FOUND'
        recommended_action = `ship_variant:${lifter.variant}`
      } else if (minCaptures >= 120) {
        decision_status = 'NULL_RESULT'
        recommended_action = 'keep_control'
      } else {
        decision_status = 'RUNNING'
      }
    } else {
      decision_status = 'RUNNING'
    }
  }

  return {
    experiment_key: experimentKey,
    window_days: days,
    variants,
    decision: { status: decision_status, action: recommended_action },
  }
}

async function channelFunnel(days: number, apiKey: string): Promise<any> {
  const q = `
    SELECT
      coalesce(properties.channel, 'baseline') AS channel,
      countIf(event = '$pageview') AS pageviews,
      countIf(event = 'lead_form_started') AS form_starts,
      countIf(event = 'lead_captured') AS captures,
      countIf(event = 'lead_captured' AND properties.delivered = true) AS delivered,
      countIf(event = 'lead_submit_failed') AS failures
    FROM events
    WHERE timestamp >= now() - INTERVAL ${days} DAY
    GROUP BY channel
    ORDER BY pageviews DESC
  `
  const data = await hogql(q.trim(), apiKey)
  return (data.results || []).map((r: any) => ({
    channel: r[0],
    pageviews: r[1],
    form_starts: r[2],
    captures: r[3],
    delivered: r[4],
    failures: r[5],
    capture_rate_pct: r[1] > 0 ? Math.round((r[3] / r[1]) * 1000) / 10 : 0,
    delivered_rate_pct: r[3] > 0 ? Math.round((r[4] / r[3]) * 1000) / 10 : 0,
    form_completion_pct: r[2] > 0 ? Math.round((r[3] / r[2]) * 1000) / 10 : null,
  }))
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  // Auth: brain token only
  const brainHdr = req.headers.get('x-bpp-brain-token') || ''
  const BRAIN = Deno.env.get('BPP_BRAIN_TOKEN') || ''
  if (!BRAIN || !timingSafeEqual(brainHdr, BRAIN)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const PH_KEY = Deno.env.get('POSTHOG_API_KEY') || Deno.env.get('POSTHOG_PERSONAL_API_KEY') || ''
  if (!PH_KEY) {
    return new Response(JSON.stringify({ error: 'POSTHOG_API_KEY not configured' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const url = new URL(req.url)
  const action = url.searchParams.get('action') || 'experiment'
  const days = Math.max(1, Math.min(90, Number(url.searchParams.get('days') || '30')))

  try {
    if (action === 'channel_funnel') {
      const data = await channelFunnel(days, PH_KEY)
      return new Response(JSON.stringify({ ok: true, window_days: days, channels: data }, null, 2), {
        status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    // Default: experiment variant stats
    const experimentKey = url.searchParams.get('experiment') || 'meta-hero-v1'
    // HogQL has no parameter binding, so guard the literal: lowercase
    // alphanumerics, hyphens, underscores only. Anything else is rejected
    // before string-concat into the WHERE clause.
    if (!/^[a-z0-9_-]{1,64}$/.test(experimentKey)) {
      return new Response(JSON.stringify({ error: 'bad experiment key' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    const data = await variantStats(experimentKey, days, PH_KEY)
    return new Response(JSON.stringify({ ok: true, ...data }, null, 2), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({
      error: 'posthog_query_failed',
      detail: String(e).slice(0, 500),
    }), { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
})
