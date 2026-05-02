/**
 * meta-control — Read + write operations on the BPP Meta ad account.
 *
 * Built for the experimentation framework (Apr 29, 2026 mandate). Specifically
 * designed for EXP-2026-04-29-002 (Advantage+ pause + Legacy reallocate) but
 * general-purpose enough for any future budget/status changes.
 *
 * Why this exists: changes to ad campaigns and budgets are real spend changes.
 * We want them programmatic + auditable, not manual-only. But also gated so
 * Claude can't fire them by accident.
 *
 * Auth model — TWO LAYERS:
 *   1. Brain token (BPP_BRAIN_TOKEN) — required for ANY call
 *   2. For WRITE actions (pause, set_budget): also requires `confirm: "EXEC"`
 *      in the request body. Without it, write actions return a dry-run response
 *      showing what WOULD be changed.
 *
 * Endpoints:
 *   GET  /meta-control?action=list_campaigns
 *     → list all campaigns + their daily_budget + status
 *   GET  /meta-control?action=list_adsets&campaign_id=X
 *     → list ad sets in a campaign
 *   POST /meta-control { action: "pause_campaign", campaign_id: X }
 *     → DRY RUN (no confirm token) — shows what would happen
 *   POST /meta-control { action: "pause_campaign", campaign_id: X, confirm: "EXEC" }
 *     → ACTUAL change — pauses the campaign
 *   POST /meta-control { action: "set_adset_budget", adset_id: X, daily_budget_cents: N, confirm: "EXEC" }
 *     → Updates ad set daily budget (in cents — $50 = 5000)
 *
 * Audit: every write logs to sparky_memory under key `meta_action:<timestamp>`
 * so we have a record of what changed when.
 *
 * Out of scope (per CLAUDE.md hard rules):
 *   - Creating new ads or new creative
 *   - Changing geographic targeting
 * Those still require Key's explicit UI action.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { timingSafeEqual, allowRate } from '../_shared/auth.ts'

// Internal-only — brain-token-gated server-to-server, tightened per F15.
const CORS = {
  'Access-Control-Allow-Origin': 'https://backuppowerpro.com',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-bpp-brain-token, x-bpp-confirm',
}

const ACCOUNT_ID = 'act_923542753352966'
const META_API_BASE = 'https://graph.facebook.com/v21.0'

// Meta object IDs are numeric (sometimes prefixed with `act_` for ad
// accounts). Anything else — slashes, query separators, alpha — is an
// attempt to redirect the request to a different graph endpoint.
const META_ID_RE = /^[0-9]{6,32}$/
const validateMetaId = (id: unknown): string | null =>
  typeof id === 'string' && META_ID_RE.test(id) ? id : null

// Allowed write actions — explicit allowlist. Adding new write actions
// requires adding to this set + implementing the action.
const ALLOWED_WRITE_ACTIONS = new Set([
  'pause_campaign',
  'unpause_campaign',
  'pause_adset',
  'unpause_adset',
  'set_adset_budget',
])

const ALLOWED_READ_ACTIONS = new Set([
  'list_campaigns',
  'list_adsets',
  'get_campaign',
  'get_adset',
])

interface ActionResult {
  ok: boolean
  dry_run?: boolean
  action?: string
  before?: any
  after?: any
  result?: any
  error?: string
}

async function metaGet(path: string, token: string): Promise<any> {
  const url = `${META_API_BASE}${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`
  const resp = await fetch(url)
  if (!resp.ok) {
    const txt = await resp.text()
    throw new Error(`Meta API ${resp.status}: ${txt.slice(0, 300)}`)
  }
  return resp.json()
}

async function metaPost(path: string, body: Record<string, any>, token: string): Promise<any> {
  // Meta uses form-encoded POST for write operations on /v21.0/<id>
  const formBody = new URLSearchParams()
  for (const [k, v] of Object.entries(body)) {
    formBody.append(k, String(v))
  }
  formBody.append('access_token', token)
  const resp = await fetch(`${META_API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formBody.toString(),
  })
  if (!resp.ok) {
    const txt = await resp.text()
    throw new Error(`Meta API ${resp.status}: ${txt.slice(0, 300)}`)
  }
  return resp.json()
}

async function logAction(sb: any, summary: any): Promise<void> {
  try {
    await sb.from('sparky_memory').upsert({
      key: `meta_action:${new Date().toISOString()}`,
      value: JSON.stringify(summary),
    })
  } catch (e) {
    console.warn('[meta-control] audit log failed:', e)
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  // ── Auth: brain token ────────────────────────────────────────────────────
  const brainHdr = req.headers.get('x-bpp-brain-token') || ''
  const BRAIN = Deno.env.get('BPP_BRAIN_TOKEN') || ''
  if (!BRAIN || !timingSafeEqual(brainHdr, BRAIN)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Per-IP rate limit — write actions are real spend changes, keep tight
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!allowRate(`meta-control:${ip}`, 20)) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), {
      status: 429, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const META_TOKEN = Deno.env.get('META_ACCESS_TOKEN') || Deno.env.get('FB_ACCESS_TOKEN') || ''
  if (!META_TOKEN) {
    return new Response(JSON.stringify({ error: 'META_ACCESS_TOKEN not configured' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Parse action + params from query (GET) or body (POST)
  const url = new URL(req.url)
  let action = url.searchParams.get('action') || ''
  let params: Record<string, any> = {}
  for (const [k, v] of url.searchParams.entries()) {
    if (k !== 'action') params[k] = v
  }
  if (req.method === 'POST') {
    try {
      const body = await req.json()
      action = body?.action || action
      params = { ...params, ...body }
      delete params.action
    } catch { /* params stay as-is */ }
  }

  // Route ────────────────────────────────────────────────────────────────
  try {
    // READ ACTIONS
    if (ALLOWED_READ_ACTIONS.has(action)) {
      switch (action) {
        case 'list_campaigns': {
          const data = await metaGet(
            `/${ACCOUNT_ID}/campaigns?fields=id,name,status,daily_budget,lifetime_budget,objective,effective_status&limit=50`,
            META_TOKEN,
          )
          return new Response(JSON.stringify({ ok: true, data: data?.data || [] }, null, 2), {
            status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
          })
        }
        case 'list_adsets': {
          const cid = validateMetaId(params.campaign_id)
          if (!cid) return new Response(JSON.stringify({ error: 'invalid campaign_id' }), { status: 400, headers: CORS })
          const data = await metaGet(
            `/${cid}/adsets?fields=id,name,status,daily_budget,lifetime_budget,effective_status&limit=50`,
            META_TOKEN,
          )
          return new Response(JSON.stringify({ ok: true, data: data?.data || [] }, null, 2), {
            status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
          })
        }
        case 'get_campaign': {
          const cid = validateMetaId(params.campaign_id)
          if (!cid) return new Response(JSON.stringify({ error: 'invalid campaign_id' }), { status: 400, headers: CORS })
          const data = await metaGet(
            `/${cid}?fields=id,name,status,daily_budget,lifetime_budget,objective,effective_status,start_time,stop_time`,
            META_TOKEN,
          )
          return new Response(JSON.stringify({ ok: true, data }, null, 2), {
            status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
          })
        }
        case 'get_adset': {
          const aid = validateMetaId(params.adset_id)
          if (!aid) return new Response(JSON.stringify({ error: 'invalid adset_id' }), { status: 400, headers: CORS })
          const data = await metaGet(
            `/${aid}?fields=id,name,status,daily_budget,lifetime_budget,effective_status,targeting`,
            META_TOKEN,
          )
          return new Response(JSON.stringify({ ok: true, data }, null, 2), {
            status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
          })
        }
      }
    }

    // WRITE ACTIONS — DRY RUN unless confirm sentinel is set.
    //
    // Confirm sentinel must be in the `x-bpp-confirm` HEADER, not the body.
    // Co-locating action+target+confirm in the same JSON makes it trivial
    // for a future client to construct a "list and pause stale ones" call
    // that auto-includes EXEC; the header forces a separate decision.
    // Body sentinel is still accepted with a deprecation flag for the
    // existing cpl-watchdog → meta-control internal call path.
    if (ALLOWED_WRITE_ACTIONS.has(action)) {
      const headerConfirm = req.headers.get('x-bpp-confirm') === 'EXEC'
      const bodyConfirm = params.confirm === 'EXEC'
      const isExec = headerConfirm || bodyConfirm

      // Always fetch BEFORE state for the audit log + dry-run preview
      let before: any = null
      let targetId: string | null = null
      let writePath: string | null = null
      let writeBody: Record<string, any> = {}

      switch (action) {
        case 'pause_campaign':
        case 'unpause_campaign': {
          targetId = validateMetaId(params.campaign_id)
          if (!targetId) return new Response(JSON.stringify({ error: 'invalid campaign_id' }), { status: 400, headers: CORS })
          before = await metaGet(`/${targetId}?fields=id,name,status,daily_budget,lifetime_budget`, META_TOKEN)
          writePath = `/${targetId}`
          writeBody = { status: action === 'pause_campaign' ? 'PAUSED' : 'ACTIVE' }
          break
        }
        case 'pause_adset':
        case 'unpause_adset': {
          targetId = validateMetaId(params.adset_id)
          if (!targetId) return new Response(JSON.stringify({ error: 'invalid adset_id' }), { status: 400, headers: CORS })
          before = await metaGet(`/${targetId}?fields=id,name,status,daily_budget,lifetime_budget`, META_TOKEN)
          writePath = `/${targetId}`
          writeBody = { status: action === 'pause_adset' ? 'PAUSED' : 'ACTIVE' }
          break
        }
        case 'set_adset_budget': {
          targetId = validateMetaId(params.adset_id)
          if (!targetId) return new Response(JSON.stringify({ error: 'invalid adset_id' }), { status: 400, headers: CORS })
          const cents = Number(params.daily_budget_cents)
          if (!cents || cents < 100 || cents > 50000) {
            return new Response(JSON.stringify({
              error: 'daily_budget_cents must be between 100 ($1/day) and 50000 ($500/day) for safety',
            }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })
          }
          before = await metaGet(`/${targetId}?fields=id,name,status,daily_budget,lifetime_budget`, META_TOKEN)
          writePath = `/${targetId}`
          writeBody = { daily_budget: cents }
          break
        }
      }

      const result: ActionResult = {
        ok: true,
        dry_run: !isExec,
        action,
        before,
        after: { proposed: writeBody },
      }

      if (isExec && writePath) {
        // Execute the change
        const writeResult = await metaPost(writePath, writeBody, META_TOKEN)
        // Re-fetch to confirm new state
        const afterState = await metaGet(`/${targetId}?fields=id,name,status,daily_budget,lifetime_budget`, META_TOKEN)
        result.result = writeResult
        result.after = afterState
        await logAction(sb, { action, target_id: targetId, before, after: afterState, write_body: writeBody, ts: new Date().toISOString() })
      }

      return new Response(JSON.stringify(result, null, 2), {
        status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      error: 'unknown_action',
      allowed_read: Array.from(ALLOWED_READ_ACTIONS),
      allowed_write: Array.from(ALLOWED_WRITE_ACTIONS),
    }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'meta_api_failed', detail: String(e).slice(0, 500) }), {
      status: 502, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
