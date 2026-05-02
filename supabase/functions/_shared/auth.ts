/**
 * Shared auth + signature-verification helpers for BPP edge functions.
 *
 * Usage:
 *   import { requireServiceRole, verifyTwilioSignature, verifyOpenPhoneSignature,
 *            jsonUnauthorized } from '../_shared/auth.ts'
 *
 *   Deno.serve(async (req) => {
 *     const gate = requireServiceRole(req)
 *     if (gate) return gate
 *     // ...your handler...
 *   })
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
}

export function jsonUnauthorized(msg: string = 'unauthorized'): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status: 401,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// Timing-safe string compare. Returns true only when `a` and `b` are the
// same length and every byte matches. Prevents auth-header length/byte
// leakage via response-time side channels.
export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// Accept either a Bearer token in Authorization OR an apikey header, and
// match it against SUPABASE_SERVICE_ROLE_KEY. Returns a 401 Response if
// the check fails, or null when the caller is authorized to proceed.
export function requireServiceRole(req: Request): Response | null {
  const expected = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!expected) {
    // Server misconfigured — fail closed.
    return new Response(JSON.stringify({ error: 'server misconfig' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
  const auth = req.headers.get('authorization') || ''
  const apikey = req.headers.get('apikey') || ''
  const bearer = auth.replace(/^Bearer\s+/i, '').trim()
  if (timingSafeEqual(bearer, expected)) return null
  if (timingSafeEqual(apikey, expected)) return null
  return jsonUnauthorized()
}

// Accept either the publishable key OR service_role (for server-to-server).
// Use on endpoints that must be callable from the browser (CRM / public
// pages) but should still reject random internet traffic without any key.
// BPP_PUBLISHABLE_KEY is the rotated-in sb_publishable_ value; the legacy
// SUPABASE_ANON_KEY is the old JWT which was disabled 2026-04-23 but we
// still accept it defensively in case Supabase ever re-enables it, so
// this function's behavior matches the publicly-documented contract.
export function requireAnonOrServiceRole(req: Request): Response | null {
  const anon = Deno.env.get('SUPABASE_ANON_KEY') || ''
  const pub  = Deno.env.get('BPP_PUBLISHABLE_KEY') || ''
  const svc  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const auth = req.headers.get('authorization') || ''
  const apikey = req.headers.get('apikey') || ''
  const bearer = auth.replace(/^Bearer\s+/i, '').trim()
  for (const k of [anon, pub, svc]) {
    if (!k) continue
    if (timingSafeEqual(bearer, k) || timingSafeEqual(apikey, k)) return null
  }
  return jsonUnauthorized()
}

// Verify a Twilio HMAC-SHA1 signature on an inbound webhook.
// Twilio signs (absoluteUrl + concat of sorted form key/value pairs) with
// your account's AUTH_TOKEN. The body text must be the ORIGINAL
// URL-encoded form payload exactly as Twilio sent it — don't re-encode.
//
// https://www.twilio.com/docs/usage/webhooks/webhooks-security
export async function verifyTwilioSignature(
  req: Request,
  rawBody: string,
  authToken: string | undefined,
): Promise<boolean> {
  if (!authToken) return false
  const signature = req.headers.get('x-twilio-signature') || ''
  if (!signature) return false

  // Twilio uses the full URL the request was POSTed to. Reconstruct from
  // the incoming Request URL (already absolute on Deno deploy).
  const url = req.url

  // Parse the raw form-encoded body and sort keys.
  const params = new URLSearchParams(rawBody)
  const keys = [...params.keys()].sort()
  let data = url
  for (const k of keys) data += k + (params.get(k) ?? '')

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(authToken),
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign'],
    )
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
    const computed = btoa(String.fromCharCode(...new Uint8Array(sig)))
    return timingSafeEqual(computed, signature)
  } catch {
    return false
  }
}

// Verify an OpenPhone webhook signature. OpenPhone uses an HMAC-SHA256
// over the raw request body with a signing key configured per-webhook.
// Header format: `openphone-signature: hmac;version=1;timestamp=<ms>;<base64-sig>`
// A 5-minute clock skew window prevents replay.
//
// https://www.openphone.com/docs/mdx/api-reference/webhooks/about-webhook-payloads
export async function verifyOpenPhoneSignature(
  req: Request,
  rawBody: string,
  signingKey: string | undefined,
): Promise<boolean> {
  if (!signingKey) return false
  const sigHeader = req.headers.get('openphone-signature')
    || req.headers.get('x-openphone-signature')
    || ''
  if (!sigHeader) return false

  // Parse "hmac;version=1;timestamp=<ms>;<base64sig>"
  const parts = sigHeader.split(';')
  const kv: Record<string, string> = {}
  let sigB64 = ''
  for (const p of parts) {
    if (p.startsWith('hmac')) continue
    if (p.includes('=')) {
      const [k, v] = p.split('=')
      kv[k.trim()] = (v || '').trim()
    } else if (/^[A-Za-z0-9+/=]+$/.test(p.trim())) {
      sigB64 = p.trim()
    }
  }
  const ts = Number(kv.timestamp || '0')
  if (!ts || !sigB64) return false
  // Reject if outside a 5-minute window (handles both forward + backward skew).
  const now = Date.now()
  if (Math.abs(now - ts) > 5 * 60 * 1000) return false

  try {
    // OpenPhone signs `${timestamp}.${rawBody}` with base64-decoded signingKey.
    let keyBytes: Uint8Array
    try {
      keyBytes = Uint8Array.from(atob(signingKey), c => c.charCodeAt(0))
    } catch {
      keyBytes = new TextEncoder().encode(signingKey)
    }
    const key = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const data = new TextEncoder().encode(`${ts}.${rawBody}`)
    const sig = await crypto.subtle.sign('HMAC', key, data)
    const computed = btoa(String.fromCharCode(...new Uint8Array(sig)))
    return timingSafeEqual(computed, sigB64)
  } catch {
    return false
  }
}

// Escape PostgREST ilike wildcards. PostgREST treats %, _, and \ as
// special in LIKE/ILIKE filters — if user input contains a %, it matches
// every row. Call this before string-concatenating into `.ilike()` or
// `.or('col.ilike.%...)'` expressions.
export function escapeIlike(input: string): string {
  return String(input).replace(/([\\%_])/g, '\\$1')
}

// Strip prompt-injection patterns from strings that will be persisted
// into sparky_inbox.metadata / sparky_memory.value, where future Claude
// wake-ups read them as authoritative business state. The risk is that
// an attacker-controlled API response body (Meta error, PostHog 5xx,
// Google review text) lands in `String(e).slice(0, N)` and then gets
// surfaced verbatim to the LLM on the next session.
//
// Mirrors the patterns `quo-ai-new-lead` already uses on form input.
// Trims to `maxLen` after sanitisation.
export function sanitizeForLog(input: unknown, maxLen = 500): string {
  let s = String(input ?? '').slice(0, maxLen * 2)
  // Strip XML-style instruction tags Claude treats as boundaries
  s = s.replace(/\[(END|INTERNAL|\/|SYSTEM|ASSISTANT|USER)/gi, '[REDACTED-')
  s = s.replace(/<\/?(system|assistant|user|instructions?)>/gi, '')
  // Strip "ignore previous instructions" attack patterns
  s = s.replace(/ignore\s+(all\s+)?previous\s+(instructions?|directions?)/gi, '[REDACTED]')
  s = s.replace(/disregard\s+(all\s+)?previous/gi, '[REDACTED]')
  s = s.replace(/forget\s+(all\s+)?(previous|prior|earlier)/gi, '[REDACTED]')
  // Collapse whitespace so a malicious newline-burst can't visually
  // separate injected instructions from surrounding error text.
  s = s.replace(/\s+/g, ' ').trim()
  return s.slice(0, maxLen)
}

// Cheap in-memory token bucket per key (IP, phone, etc). Not distributed
// — each edge-function instance has its own counter — but good enough to
// throttle the pathological single-attacker case. Returns true when the
// request is allowed, false when it should be rate-limited.
const _buckets = new Map<string, { tokens: number; last: number }>()
export function allowRate(key: string, maxPerMinute: number): boolean {
  const now = Date.now()
  const b = _buckets.get(key) || { tokens: maxPerMinute, last: now }
  // Refill proportional to elapsed time
  const refill = ((now - b.last) / 60_000) * maxPerMinute
  b.tokens = Math.min(maxPerMinute, b.tokens + refill)
  b.last = now
  if (b.tokens < 1) {
    _buckets.set(key, b)
    return false
  }
  b.tokens -= 1
  _buckets.set(key, b)
  return true
}
