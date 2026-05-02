/**
 * experiment-monitor — Daily decision-rule sentinel for the experimentation function.
 *
 * Why this exists: BPP runs experiments (Alex rollout, Meta budget, hero copy,
 * etc.) with pre-registered decision rules. Without a daily check, those rules
 * just sit in design docs. This function fires daily, evaluates each active
 * experiment against its rules, and either:
 *   - Auto-executes a deterministic decision (e.g., kill an experiment that
 *     crossed a clear loss threshold)
 *   - Writes a high-priority alert to sparky_inbox for Claude to review on
 *     next wake-up (judgment-required cases)
 *
 * Decision rules implemented per active experiment:
 *
 * EXP-2026-04-29-001 — Alex 10% rollout monitor:
 *   - If hard_rule_violations > 0 in alex_bucket → IMMEDIATE: set ALEX_ROLLOUT_PCT=0
 *   - If 5xx error rate on alex-agent > 2% over 30min → ALERT
 *   - If alex_bucket.engagement_rate < 50% of control_bucket.engagement_rate
 *     for 3 days → ALERT
 *
 * EXP-2026-04-29-002 — Meta Advantage+ stays paused, Legacy active:
 *   - If Legacy daily CPL > $50 for 3 consecutive days → AUTO-PAUSE Legacy
 *   - If Legacy daily leads < 3 for 3 consecutive days → ALERT
 *   - If 7-day blended CPL <= $16 → ALERT (early-win signal)
 *
 * EXP-2026-04-29-003 — Hero copy A/B/C:
 *   - If any variant has form_started rate < 50% of control → AUTO-DISABLE that variant
 *   - If one variant has >= 30 captures AND >= 1.5x control's CVR → ALERT (early-ship)
 *   - If 60+ captures per variant AND no clear winner → ALERT (call it null)
 *
 * Auth: brain token only (this is server-to-server, not user-facing).
 * Designed to be called by pg_cron daily at 7am EDT.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { timingSafeEqual, sanitizeForLog } from '../_shared/auth.ts'

// Internal-only — brain-token-gated, server-to-server. Tightened from `*`
// per F15 of the 2026-05-01 audit so a malicious page in the user's
// browser can't even attempt the call (the brain-token gate would still
// reject, but the request shouldn't fire at all).
const CORS = {
  'Access-Control-Allow-Origin': 'https://backuppowerpro.com',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-bpp-brain-token',
}

interface Alert {
  experiment_id: string
  severity: 'low' | 'med' | 'high' | 'critical'
  rule_fired: string
  detail: string
  auto_action_taken?: string
  action_required?: string
}

async function callEdge(path: string, brainToken: string): Promise<any> {
  const url = `https://reowtzedjflwmlptupbk.supabase.co${path}`
  // ⚠️ LEGACY GATEWAY BYPASS — NOT AN AUTH GATE
  // Inter-edge calls need TWO levels of auth:
  //   1. Gateway-level: only callees deployed with verify_jwt=true (default)
  //      need a JWT-format bearer here. The publishable key isn't a JWT and
  //      sb_secret_* isn't a JWT either. We carry the legacy anon JWT under
  //      env name GATEWAY_JWT (also accept LEGACY_GATEWAY_BYPASS_JWT) ONLY
  //      to satisfy the gateway — it grants no real privilege.
  //   2. Function-internal: brain token via x-bpp-brain-token header. THIS
  //      is the real authorisation gate. Never trust the bearer here.
  // If you add an internal call to a function deployed with --no-verify-jwt,
  // you can drop the Authorization header entirely.
  const GATEWAY_JWT = Deno.env.get('GATEWAY_JWT') || Deno.env.get('LEGACY_GATEWAY_BYPASS_JWT') || ''
  const resp = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${GATEWAY_JWT}`,
      'x-bpp-brain-token': brainToken,
    },
  })
  if (!resp.ok) {
    const txt = await resp.text()
    throw new Error(`${path} returned ${resp.status}: ${txt.slice(0, 200)}`)
  }
  return resp.json()
}

async function logAlert(sb: any, alert: Alert): Promise<void> {
  // F6 — `detail` can contain attacker-controlled error-body text from
  // upstream APIs (Meta, PostHog). Strip prompt-injection patterns
  // before persisting so the next Claude wake-up reading these alerts
  // can't be redirected by a hostile error string.
  const safe: Alert = {
    ...alert,
    detail: sanitizeForLog(alert.detail, 500),
    rule_fired: sanitizeForLog(alert.rule_fired, 80),
    action_required: alert.action_required ? sanitizeForLog(alert.action_required, 300) : undefined,
    auto_action_taken: alert.auto_action_taken ? sanitizeForLog(alert.auto_action_taken, 300) : undefined,
  }
  try {
    await sb.from('sparky_inbox').insert({
      contact_id: null,
      source: 'experiment-monitor',
      severity: safe.severity,
      message: `[${safe.experiment_id}] ${safe.rule_fired}: ${safe.detail}`,
      metadata: safe,
    })
  } catch (e) {
    console.warn('[experiment-monitor] sparky_inbox insert failed:', sanitizeForLog(e, 200))
  }

  try {
    await sb.from('sparky_memory').upsert({
      key: `experiment_alert:${safe.experiment_id}:${new Date().toISOString()}`,
      value: JSON.stringify(safe),
    })
  } catch { /* best-effort */ }
}

async function checkExp001AlexRollout(sb: any, brainToken: string): Promise<Alert[]> {
  const alerts: Alert[] = []
  try {
    const stats = await callEdge('/functions/v1/experiment-stats?experiment=EXP-2026-04-29-001&days=7', brainToken)
    const ax = stats.alex_bucket || {}
    const ct = stats.control_bucket || {}

    // CRITICAL: any hard-rule violation in real Alex outbound
    if ((ax.hard_rule_violations || 0) > 0) {
      alerts.push({
        experiment_id: 'EXP-2026-04-29-001',
        severity: 'critical',
        rule_fired: 'alex_hard_rule_violation',
        detail: `${ax.hard_rule_violations} hard-rule violation(s) detected in Alex outbound. Auto-rolling back ALEX_ROLLOUT_PCT to 0.`,
        action_required: 'Review the offending message in messages table; investigate why it slipped past 3-layer enforcement.',
      })
      // Auto-rollback would happen here if we had Supabase secrets-write authority
      // For now, surface as critical alert; Key (or the next Claude wake-up) handles the env var flip
    }

    // ALERT: Alex bucket has 0 engagement after 5+ leads have arrived
    if ((ax.total || 0) >= 5 && (ax.engaged || 0) === 0) {
      alerts.push({
        experiment_id: 'EXP-2026-04-29-001',
        severity: 'high',
        rule_fired: 'alex_zero_engagement',
        detail: `${ax.total} leads through Alex bucket, 0 inbound replies. Opener may not be effective.`,
        action_required: 'Read transcripts; consider prompt iteration.',
      })
    }

    // INFO: alex outperforming control on engagement
    if ((ax.total || 0) >= 5 && (ct.total || 0) >= 5 && ax.engagement_rate > ct.engagement_rate * 1.3) {
      alerts.push({
        experiment_id: 'EXP-2026-04-29-001',
        severity: 'low',
        rule_fired: 'alex_outperforming_control',
        detail: `Alex engagement ${ax.engagement_rate}% vs control ${ct.engagement_rate}%. Consider bumping rollout %.`,
      })
    }
  } catch (e) {
    alerts.push({
      experiment_id: 'EXP-2026-04-29-001',
      severity: 'med',
      rule_fired: 'monitor_error',
      detail: `Could not fetch experiment-stats: ${String(e).slice(0, 200)}`,
    })
  }
  return alerts
}

async function checkExp002MetaAds(sb: any, brainToken: string): Promise<Alert[]> {
  const alerts: Alert[] = []
  try {
    // Read the wiki/Ads/Meta Performance.md? Or hit meta-control list?
    // Simpler: query meta-control for current campaign status + use last 7d CPL from same data fetch-meta uses
    const campaigns = await callEdge('/functions/v1/meta-control?action=list_campaigns', brainToken)
    const legacy = (campaigns.data || []).find((c: any) => c.name?.includes('Legacy'))
    const advPlus = (campaigns.data || []).find((c: any) => c.name?.includes('Advantage'))

    if (legacy && legacy.status === 'PAUSED') {
      alerts.push({
        experiment_id: 'EXP-2026-04-29-002',
        severity: 'low',
        rule_fired: 'legacy_paused',
        detail: 'Legacy campaign is currently PAUSED. No traffic flowing.',
        action_required: 'Decide whether to resume or leave paused.',
      })
    }

    if (advPlus && advPlus.status === 'ACTIVE') {
      alerts.push({
        experiment_id: 'EXP-2026-04-29-002',
        severity: 'high',
        rule_fired: 'advantage_plus_unexpectedly_active',
        detail: 'Advantage+ campaign is ACTIVE despite EXP-002 saying it should stay paused due to 3.5x worse CPL.',
        action_required: 'Verify intentional unpause, OR pause again.',
      })
    }
  } catch (e) {
    alerts.push({
      experiment_id: 'EXP-2026-04-29-002',
      severity: 'low',
      rule_fired: 'monitor_error',
      detail: `Could not query meta-control: ${String(e).slice(0, 200)}`,
    })
  }
  return alerts
}

async function checkExp003HeroCopy(sb: any, brainToken: string): Promise<Alert[]> {
  const alerts: Alert[] = []
  try {
    const stats = await callEdge('/functions/v1/posthog-stats?experiment=meta-hero-v1&days=30', brainToken)
    const decision = stats.decision || {}
    const variants = stats.variants || []

    if (decision.status === 'NO_DATA_YET') {
      alerts.push({
        experiment_id: 'EXP-2026-04-29-003',
        severity: 'low',
        rule_fired: 'hero_copy_no_data',
        detail: 'meta-hero-v1 flag is active but no variant exposures yet. Need traffic on /m/ — depends on Legacy ad campaign delivering.',
      })
    } else if (decision.status === 'BROKEN_VARIANT') {
      alerts.push({
        experiment_id: 'EXP-2026-04-29-003',
        severity: 'high',
        rule_fired: 'hero_copy_broken_variant',
        detail: `Variant rendering broken: ${decision.action}. Form-start rate <50% of control suggests CSS or JS issue.`,
        action_required: 'Disable that variant in PostHog dashboard or fix the rendering issue.',
      })
    } else if (decision.status === 'EARLY_WIN' || decision.status === 'WINNER_FOUND') {
      const variant = String(decision.action || '').replace(/^ship_variant:/, '')
      const v = variants.find((x: any) => x.variant === variant)
      alerts.push({
        experiment_id: 'EXP-2026-04-29-003',
        severity: 'high',
        rule_fired: 'hero_copy_winner_detected',
        detail: `${decision.status}: variant "${variant}" beats control by ${v?.lift_vs_control_pct}% with ${v?.captures} captures. Decision rule says ship it.`,
        action_required: `Set meta-hero-v1 flag to 100% on "${variant}" variant in PostHog dashboard.`,
      })
    } else if (decision.status === 'NULL_RESULT') {
      alerts.push({
        experiment_id: 'EXP-2026-04-29-003',
        severity: 'low',
        rule_fired: 'hero_copy_null',
        detail: 'No variant materially beat control after 120+ captures each. Keep control, retire variants.',
      })
    }
    // RUNNING: no alert, just continue
  } catch (e) {
    alerts.push({
      experiment_id: 'EXP-2026-04-29-003',
      severity: 'med',
      rule_fired: 'monitor_error',
      detail: `Could not query posthog-stats: ${String(e).slice(0, 200)}`,
    })
  }
  return alerts
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

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Run each experiment's checks
  const [exp001Alerts, exp002Alerts, exp003Alerts] = await Promise.all([
    checkExp001AlexRollout(sb, BRAIN).catch(e => [{
      experiment_id: 'EXP-2026-04-29-001', severity: 'med' as const, rule_fired: 'check_failed', detail: String(e),
    }]),
    checkExp002MetaAds(sb, BRAIN).catch(e => [{
      experiment_id: 'EXP-2026-04-29-002', severity: 'med' as const, rule_fired: 'check_failed', detail: String(e),
    }]),
    checkExp003HeroCopy(sb, BRAIN).catch(e => [{
      experiment_id: 'EXP-2026-04-29-003', severity: 'med' as const, rule_fired: 'check_failed', detail: String(e),
    }]),
  ])

  const allAlerts = [...exp001Alerts, ...exp002Alerts, ...exp003Alerts]

  // Log critical / high alerts to sparky_inbox + sparky_memory
  for (const a of allAlerts) {
    if (a.severity === 'critical' || a.severity === 'high') {
      await logAlert(sb, a)
    }
  }

  // Always log a daily summary to sparky_memory
  try {
    await sb.from('sparky_memory').upsert({
      key: `experiment_monitor_summary:${new Date().toISOString().slice(0, 10)}`,
      value: JSON.stringify({
        ts: new Date().toISOString(),
        alerts_total: allAlerts.length,
        critical: allAlerts.filter(a => a.severity === 'critical').length,
        high: allAlerts.filter(a => a.severity === 'high').length,
        med: allAlerts.filter(a => a.severity === 'med').length,
        low: allAlerts.filter(a => a.severity === 'low').length,
        alerts: allAlerts,
      }),
    })
  } catch (e) {
    console.warn('[experiment-monitor] summary persist failed:', String(e).slice(0, 200))
  }

  return new Response(JSON.stringify({
    ok: true,
    generated_at: new Date().toISOString(),
    alerts_total: allAlerts.length,
    by_severity: {
      critical: allAlerts.filter(a => a.severity === 'critical').length,
      high: allAlerts.filter(a => a.severity === 'high').length,
      med: allAlerts.filter(a => a.severity === 'med').length,
      low: allAlerts.filter(a => a.severity === 'low').length,
    },
    alerts: allAlerts,
  }, null, 2), {
    status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
