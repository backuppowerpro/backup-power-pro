/**
 * brain-write — allowlisted sparky_memory upsert for brain-refresh scripts.
 *
 * Replaces the prior pattern where `scripts/brain/synthesize-ceo-brief.sh`
 * called the PostgREST endpoint directly with the service-role JWT pulled
 * from credentials.md — that JWT was rotated in the 2026-04-23 leak audit
 * and removed from credentials, breaking the daily refresh.
 *
 * This function accepts an allowlisted set of memory keys (so the
 * publishable-key path can't be turned into an arbitrary database write
 * surface) and writes them via SR auth that Supabase auto-injects.
 *
 * Auth: caller must present EITHER (a) the SR key as bearer, OR (b) a
 * valid `x-bpp-brain-token` header (32-byte random secret stored in
 * supabase secrets + ~/.claude/credentials.md). The publishable key
 * alone is NOT enough — it's in the website source, so anyone could
 * vandalize the brief.
 *
 * POST /brain-write  { key: "ceo_morning_brief", value: "<text>" }
 *
 * Allowlist intentionally narrow — every new key earns its way in.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { timingSafeEqual, allowRate } from '../_shared/auth.ts'

// CORS: scoped to production origin only. This is a server-to-server
// endpoint (brain refresh + supabase callers), not browser-cross-origin.
const CORS = {
  'Access-Control-Allow-Origin': 'https://backuppowerpro.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info, x-bpp-brain-token',
  'Vary': 'Origin',
}

// Keys this endpoint is allowed to write. Adding a key here is an
// explicit security decision — it means scripts/brain or any caller
// holding the publishable key can clobber that memory entry. PII keys
// (contact:* per-person memory) are NOT allowed here; those go through
// alex-agent's write_memory tool which scrubs PII first.
const ALLOWED_KEYS = new Set([
  'ceo_morning_brief',
  'ceo_brief_sms',
  'metrics_snapshot',
  // Daily metric snapshots written by refresh-brain. Allowed so the
  // history accumulates without needing SR creds locally.
])

const ALLOWED_KEY_PREFIXES = [
  'metrics_',  // metrics_2026-04-26 etc.
]

function keyAllowed(k: string): boolean {
  if (ALLOWED_KEYS.has(k)) return true
  for (const prefix of ALLOWED_KEY_PREFIXES) {
    if (k.startsWith(prefix)) return true
  }
  return false
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const url = Deno.env.get('SUPABASE_URL')!
  const sr  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // ── Auth (timing-safe + fail-closed) ────────────────────────────────────
  // SECURITY: prior version used `auth.includes(sr)` which is exploitable
  // when `sr` is empty during deploy/rotation (`"x".includes("")` === true).
  // Now both halves of the OR fail closed when the secret env var is empty.
  // Both comparisons are timing-safe.
  const BRAIN_TOKEN = Deno.env.get('BPP_BRAIN_TOKEN') || ''
  const authHdr = req.headers.get('authorization') || req.headers.get('Authorization') || ''
  const apiKey  = req.headers.get('apikey') || ''
  const bearer  = authHdr.toLowerCase().startsWith('bearer ') ? authHdr.slice(7).trim() : ''
  const sentToken = req.headers.get('x-bpp-brain-token') || ''

  const srMatches    = !!sr && (timingSafeEqual(bearer, sr) || timingSafeEqual(apiKey, sr))
  const tokenMatches = !!BRAIN_TOKEN && timingSafeEqual(sentToken, BRAIN_TOKEN)

  if (!srMatches && !tokenMatches) {
    console.warn('[brain-write] auth failed', { hasAuth: !!authHdr, hasToken: !!sentToken })
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Per-IP rate limit. Brain refresh writes once a day so 30/min is generous.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!allowRate(`brain-write:${ip}`, 30)) {
    return new Response(JSON.stringify({ error: 'rate limited' }), {
      status: 429, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const { key, value } = body || {}
  if (!key || typeof key !== 'string' || typeof value !== 'string') {
    return new Response(JSON.stringify({ error: 'key and value (string) required' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Length-cap the key so a malformed caller can't bloat sparky_memory or
  // OOM the postgrest pipeline. Same allowlist below still applies — this
  // is just defense in depth.
  if (key.length > 128) {
    return new Response(JSON.stringify({ error: 'key too long (>128 chars)' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  if (!keyAllowed(key)) {
    return new Response(JSON.stringify({ error: `key ${key} not in allowlist` }), {
      status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Cap value size so a runaway script can't blow up the table.
  if (value.length > 64 * 1024) {
    return new Response(JSON.stringify({ error: 'value too large (>64KB)' }), {
      status: 413, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const sb = createClient(url, sr)
  const { error } = await sb
    .from('sparky_memory')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true, key, bytes: value.length }), {
    status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
