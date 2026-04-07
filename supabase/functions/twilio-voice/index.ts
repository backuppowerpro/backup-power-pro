/**
 * twilio-voice
 *
 * TwiML webhook for the BPP CRM Voice integration. Handles TWO flows from
 * the same URL, distinguished by the `From` field:
 *
 *   OUTBOUND (browser → real phone):
 *     - Key clicks a contact's phone number in the CRM
 *     - Device.connect({ params: { To: '+18641234567' } })
 *     - Twilio POSTs here with From=client:key, To=+18641234567
 *     - We return <Response><Dial callerId="+18648637800"><Number>+18641234567</Number></Dial></Response>
 *     - Twilio dials the real phone and bridges the browser audio
 *
 *   INBOUND (real phone → browser):
 *     - Someone calls (864) 863-7800
 *     - Twilio POSTs here with From=+1..., To=+18648637800
 *     - We return <Response><Dial timeout="25"><Client>key</Client></Dial></Response>
 *     - Twilio rings Key's browser client; audio flows when he answers
 *     - If he doesn't answer in 25s, Twilio continues past the <Dial>.
 *       We add a voicemail fallback: <Record> to capture a voicemail and
 *       email a transcription later (basic version: just record).
 *
 * Also logs both call legs to the `messages` table so call history appears
 * inline in the CRM thread alongside SMS messages.
 *
 * Deploy with --no-verify-jwt so Twilio can POST without an Authorization
 * header.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER') || '+18648637800'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const twiml = (xml: string) =>
  new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${xml}</Response>`, {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'text/xml' },
  })

// Escape XML entities in TwiML content
function xesc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

async function findContactByPhone(supabase: any, phone: string): Promise<any | null> {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 10) return null
  const last10 = digits.slice(-10)
  const { data } = await supabase
    .from('contacts')
    .select('id, name, phone')
    .ilike('phone', `%${last10}%`)
    .limit(1)
  return data?.[0] ?? null
}

async function logCall(
  supabase: any,
  contactId: string | null,
  direction: 'outbound' | 'inbound',
  body: string,
  callSid: string,
) {
  try {
    await supabase.from('messages').insert({
      contact_id: contactId,
      direction,
      body,
      sender: direction === 'outbound' ? 'key' : 'lead',
      quo_message_id: callSid,
      status: 'call',
    })
  } catch (err) {
    console.error('[twilio-voice] log failed:', err)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  if (req.method === 'GET')     return twiml('') // Twilio may GET to validate
  if (req.method !== 'POST')    return new Response('Method not allowed', { status: 405 })

  // Twilio sends form-encoded bodies
  let params: URLSearchParams
  try {
    params = new URLSearchParams(await req.text())
  } catch {
    return twiml('<Say>Invalid request.</Say><Hangup/>')
  }

  const from      = params.get('From') || ''
  const to        = params.get('To') || ''
  const callSid   = params.get('CallSid') || ''
  const direction = params.get('Direction') || ''
  // For outbound from browser, Twilio forwards custom params we passed via Device.connect
  const toParam   = params.get('To') || ''

  console.log(`[twilio-voice] CallSid=${callSid} From=${from} To=${to} Direction=${direction}`)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // ── DISPATCH ────────────────────────────────────────────────────────────
  // If From starts with "client:", this is an OUTBOUND call from the browser.
  // Dial the target phone and bridge the two legs.
  if (from.startsWith('client:')) {
    const target = (toParam || '').trim()
    if (!target || !target.startsWith('+')) {
      return twiml('<Say>Invalid phone number.</Say><Hangup/>')
    }

    // Log the outbound call attempt
    const contact = await findContactByPhone(supabase, target)
    const name = contact?.name || target
    logCall(supabase, contact?.id ?? null, 'outbound', `📞 Called ${name}`, callSid).catch(() => {})

    return twiml(
      `<Dial callerId="${xesc(TWILIO_PHONE_NUMBER)}" answerOnBridge="true" timeout="30">` +
        `<Number>${xesc(target)}</Number>` +
      `</Dial>`
    )
  }

  // Otherwise it's an INBOUND call from a real phone to our Twilio number.
  // Ring Key's browser client. If he doesn't pick up, record a voicemail.
  const contact = await findContactByPhone(supabase, from)
  const name = contact?.name || from
  logCall(supabase, contact?.id ?? null, 'inbound', `📞 Incoming call from ${name}`, callSid).catch(() => {})

  // <Dial> to the browser client, then if no answer fall through to voicemail
  return twiml(
    `<Dial timeout="25" answerOnBridge="true">` +
      `<Client>key</Client>` +
    `</Dial>` +
    `<Say voice="alice">Sorry, we missed your call. Please leave a message after the beep.</Say>` +
    `<Record maxLength="90" playBeep="true" finishOnKey="#" trim="trim-silence"/>` +
    `<Say voice="alice">Thanks. We'll call you back soon. Goodbye.</Say>` +
    `<Hangup/>`
  )
})
