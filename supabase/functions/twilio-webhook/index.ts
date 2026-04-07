/**
 * twilio-webhook
 *
 * Receives inbound SMS from Twilio for the BPP test number (864) 863-7800.
 * Twilio sends form-encoded POST data (not JSON):
 *   From, To, Body, MessageSid, NumMedia, AccountSid, etc.
 *
 * This function:
 * 1. Parses the inbound message
 * 2. Looks up the sender's contact by phone number
 * 3. Saves the message to the `messages` table
 * 4. Returns a valid TwiML <Response/> so Twilio marks delivery success
 *
 * Webhook URL to configure in Twilio console:
 *   https://reowtzedjflwmlptupbk.supabase.co/functions/v1/twilio-webhook
 * Method: HTTP POST
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Twilio-Signature',
}

// Twilio expects TwiML (XML) responses, even when we take no action
const twiml = (msg = '') =>
  new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${msg}</Response>`, {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'text/xml' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })

  // Twilio sends GET when validating webhook URL in console — just return 200
  if (req.method === 'GET') return twiml()

  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  // ── PARSE FORM-ENCODED BODY ────────────────────────────────────────────────
  let params: URLSearchParams
  try {
    const text = await req.text()
    params = new URLSearchParams(text)
  } catch {
    console.error('[twilio-webhook] failed to parse body')
    return twiml()
  }

  const from       = params.get('From') || ''
  const body       = params.get('Body') || ''
  const messageSid = params.get('MessageSid') || ''
  const numMedia   = parseInt(params.get('NumMedia') || '0', 10)

  console.log(`[twilio-webhook] from=${from} sid=${messageSid} media=${numMedia}`)

  // Skip if no content
  if (!from) {
    console.warn('[twilio-webhook] missing From — skipping')
    return twiml()
  }

  // Normalize phone to E.164
  const digits = from.replace(/\D/g, '')
  const normalizedFrom = digits.length === 10 ? `+1${digits}` : `+${digits}`
  const last10 = normalizedFrom.slice(-10)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // ── LOOK UP CONTACT ────────────────────────────────────────────────────────
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, name, phone')
    .ilike('phone', `%${last10}%`)
    .limit(1)

  const contact = contacts?.[0] ?? null

  if (!contact) {
    // Unknown number — still save the message with no contact_id
    // so Key can see it in the inbox and match it manually
    console.log(`[twilio-webhook] unknown sender ${normalizedFrom} — saving as orphan`)
    await supabase.from('messages').insert({
      contact_id:     null,
      direction:      'inbound',
      body:           body || (numMedia > 0 ? '[Media message]' : '[Empty message]'),
      sender:         'lead',
      quo_message_id: messageSid,
      status:         'received',
    })
    return twiml()
  }

  // ── SAVE INBOUND MESSAGE ───────────────────────────────────────────────────
  const msgBody = body || (numMedia > 0 ? '[Media message]' : '[Empty message]')

  const { error: insertErr } = await supabase.from('messages').insert({
    contact_id:     contact.id,
    direction:      'inbound',
    body:           msgBody,
    sender:         'lead',
    quo_message_id: messageSid,
    status:         'received',
  })

  if (insertErr) {
    console.error('[twilio-webhook] db insert failed:', insertErr)
    // Still return valid TwiML — don't let Twilio retry forever
    return twiml()
  }

  console.log(`[twilio-webhook] saved inbound from ${contact.name || contact.id}`)

  // Return empty TwiML — no auto-reply (Key handles replies from CRM)
  return twiml()
})
