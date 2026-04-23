/**
 * quo-ai-webhook
 * Receives all inbound SMS pings from Quo for (864) 863-7155.
 * If the sender is Key's personal number, stores it as a bpp_command for Claude to execute.
 * Immediately ACKs with a 200 so Quo doesn't retry.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyOpenPhoneSignature } from '../_shared/auth.ts'

const KEY_PERSONAL_NUMBER = '+19414417996'
const QUO_API_KEY = Deno.env.get('QUO_API_KEY')!
const QUO_INTERNAL_PHONE_ID = Deno.env.get('QUO_INTERNAL_PHONE_ID') || 'PNPhgKi0ua' // (864) 863-7155
const QUO_SIGNING_KEY = Deno.env.get('QUO_SIGNING_KEY') || ''

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  if (req.method !== 'POST') return new Response('ok', { status: 200, headers: CORS_HEADERS })

  // Read body text once so we can verify signature before parsing.
  const rawBody = await req.text()

  // OpenPhone signature verification — rejects forged `from: +19414417996`
  // payloads that would otherwise insert attacker-controlled rows into
  // bpp_commands. If QUO_SIGNING_KEY is not configured, fail CLOSED to
  // avoid silently accepting anything.
  const sigOk = await verifyOpenPhoneSignature(req, rawBody, QUO_SIGNING_KEY)
  if (!sigOk) {
    console.warn('[quo-ai-webhook] signature verification FAILED — rejecting')
    return new Response('forbidden', { status: 403, headers: CORS_HEADERS })
  }

  let body: any
  try { body = JSON.parse(rawBody) } catch { return new Response('ok', { status: 200, headers: CORS_HEADERS }) }

  // Quo webhook sends event objects — handle both direct and wrapped formats
  const event = body?.data || body
  const msgType = event?.type || body?.type
  const msg = event?.object || event

  // Only care about inbound messages
  const direction = msg?.direction
  const from = msg?.from
  const content = msg?.body || msg?.content || ''

  if (direction !== 'incoming' || !from || !content) {
    return new Response('ok', { status: 200, headers: CORS_HEADERS })
  }

  // Normalize phone number for comparison
  const normalizedFrom = from.replace(/\D/g, '')
  const normalizedKey = KEY_PERSONAL_NUMBER.replace(/\D/g, '')

  if (!normalizedFrom.endsWith(normalizedKey.slice(-10))) {
    // Not from Key — ignore (leads handled by their own flow)
    return new Response('ok', { status: 200, headers: CORS_HEADERS })
  }

  console.log('[bpp-command] received from Key:', content)

  // Store command in Supabase
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  await supabase.from('bpp_commands').insert({
    from_number: KEY_PERSONAL_NUMBER,
    message: content.trim(),
    status: 'pending',
  })

  // Acknowledge immediately so Key knows Claude got it
  await fetch('https://api.openphone.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': QUO_API_KEY },
    body: JSON.stringify({
      from: QUO_INTERNAL_PHONE_ID,
      to: [KEY_PERSONAL_NUMBER],
      content: `Got it. On it now — I'll text you when done.`,
    }),
  })

  return new Response('ok', { status: 200, headers: CORS_HEADERS })
})
