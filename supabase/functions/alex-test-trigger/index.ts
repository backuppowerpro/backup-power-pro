/**
 * alex-test-trigger — Forces an inbound message into alex-agent's processing
 * pipeline, bypassing OpenPhone's webhook delivery.
 *
 * Built 2026-04-29 because Key's manual SMS testing wasn't reaching alex-agent
 * (signature/routing issue at OpenPhone level — under separate investigation).
 *
 * What this does:
 *   1. Forwards a properly-shaped message.received event to alex-agent
 *   2. Uses the SR bearer to bypass alex-agent's signature check (legit
 *      "internal-forward bypass" path, same one twilio-webhook uses)
 *   3. alex-agent processes as a normal inbound, fires Alex, persists, sends SMS
 *
 * Hard-gated to KEY_PHONE only — must NEVER let an attacker forge customer
 * inbounds via this endpoint.
 *
 * Auth: brain token only.
 *
 * POST /alex-test-trigger
 *   { phone: "+19414417996", body: "your test message", media?: ["url"] }
 */

import { timingSafeEqual } from '../_shared/auth.ts'

// Internal-only — brain-token + KEY_PHONE hard-gate, tightened per F15.
const CORS = {
  'Access-Control-Allow-Origin': 'https://backuppowerpro.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-bpp-brain-token',
}

const KEY_PHONE = '+19414417996' // hard-coded gate for this endpoint
const QUO_PHONE_NUMBER = '+18644005302' // the customer-facing line

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  const brainHdr = req.headers.get('x-bpp-brain-token') || ''
  const BRAIN = Deno.env.get('BPP_BRAIN_TOKEN') || ''
  if (!BRAIN || !timingSafeEqual(brainHdr, BRAIN)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  let body: any
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const phone = String(body?.phone || '').trim()
  const messageBody = String(body?.body || '').trim()
  const media = Array.isArray(body?.media) ? body.media.filter((u: any) => typeof u === 'string') : []

  // HARD GATE: only KEY_PHONE allowed
  const phoneDigits = phone.replace(/\D/g, '').slice(-10)
  const keyDigits = KEY_PHONE.replace(/\D/g, '').slice(-10)
  if (phoneDigits !== keyDigits) {
    return new Response(JSON.stringify({ error: 'phone_not_authorized', detail: 'this endpoint only accepts KEY_PHONE' }), {
      status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
  if (!messageBody) {
    return new Response(JSON.stringify({ error: 'missing_body' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Build a proper OpenPhone message.received payload
  const eventId = `test-trigger-${Date.now()}`
  const payload = {
    type: 'message.received',
    data: {
      object: {
        id: eventId,
        from: KEY_PHONE,
        to: [QUO_PHONE_NUMBER],
        direction: 'incoming',
        body: messageBody,
        media,
        createdAt: new Date().toISOString(),
      },
    },
  }

  // Forward to alex-agent. Two layers of auth:
  //   1. Gateway: Authorization Bearer <legacy_anon_jwt> from GATEWAY_JWT (or
  //      LEGACY_GATEWAY_BYPASS_JWT) secret. ⚠️ This satisfies the gateway only —
  //      it grants no real privilege; alex-agent is now deployed with
  //      --no-verify-jwt so the bearer can be the publishable key too.
  //   2. Function: x-bpp-brain-token. alex-agent's verifyWebhookSignature was
  //      updated 2026-04-29 to accept brain token as an internal-forward bypass
  //      (same security level as SR — env-only). THIS is the real gate.
  const GATEWAY_JWT = Deno.env.get('GATEWAY_JWT') || Deno.env.get('LEGACY_GATEWAY_BYPASS_JWT') || ''
  const BRAIN = Deno.env.get('BPP_BRAIN_TOKEN') || ''
  if (!BRAIN) {
    return new Response(JSON.stringify({ error: 'auth_secrets_missing', detail: 'BPP_BRAIN_TOKEN not configured' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const resp = await fetch('https://reowtzedjflwmlptupbk.supabase.co/functions/v1/alex-agent', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GATEWAY_JWT}`,
      'x-bpp-brain-token': BRAIN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const respText = await resp.text()
  let respJson: any = null
  try { respJson = JSON.parse(respText) } catch { /* not json */ }

  return new Response(JSON.stringify({
    ok: resp.ok,
    forwarded_to: 'alex-agent',
    status: resp.status,
    alex_response: respJson || respText.slice(0, 500),
    sent_payload: payload,
  }, null, 2), {
    status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
