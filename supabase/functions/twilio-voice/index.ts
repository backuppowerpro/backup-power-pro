/**
 * twilio-voice
 *
 * TwiML webhook for the BPP CRM Voice integration. Handles TWO flows:
 *
 *   OUTBOUND (browser → real phone):
 *     - Device.connect({ params: { To: '+18641234567' } })
 *     - Twilio POSTs here with From=client:key, To=+18641234567
 *     - Returns <Dial> TwiML with recording enabled
 *
 *   INBOUND (real phone → browser):
 *     - Someone calls (864) 863-7800
 *     - Returns <Dial><Client>key</Client></Dial> with voicemail fallback
 *
 *   RECORDING STATUS CALLBACK (?event=recording-complete):
 *     - Twilio posts after recording finishes with RecordingUrl + CallSid
 *     - We update the matching messages row with the recording URL
 *
 * Deploy with --no-verify-jwt so Twilio can POST without Authorization.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER') || '+18648637800'
const TWILIO_ACCOUNT_SID  = Deno.env.get('TWILIO_ACCOUNT_SID') || ''
const TWILIO_AUTH_TOKEN   = Deno.env.get('TWILIO_AUTH_TOKEN') || ''

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

function xesc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

// Fetch ALL contacts and match by last-10 normalized digits.
// ilike('%digits%') fails when phone is formatted "(864) 863-7800" because
// the literal digit run "8648637800" doesn't appear as a substring.
async function findContactByPhone(supabase: any, phone: string): Promise<any | null> {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 10) return null
  const last10 = digits.slice(-10)
  const { data } = await supabase.from('contacts').select('id, name, phone')
  if (!data) return null
  return data.find((c: any) => (c.phone || '').replace(/\D/g, '').slice(-10) === last10) ?? null
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
  if (req.method === 'GET')     return twiml('')
  if (req.method !== 'POST')    return new Response('Method not allowed', { status: 405 })

  const url = new URL(req.url)
  const event = url.searchParams.get('event') || ''

  let params: URLSearchParams
  try {
    params = new URLSearchParams(await req.text())
  } catch {
    return twiml('<Say>Invalid request.</Say><Hangup/>')
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // ── RECORDING STATUS CALLBACK ────────────────────────────
  // Twilio posts this after a call recording finishes.
  // We find the matching message by CallSid and attach the recording URL.
  if (event === 'recording-complete') {
    const callSid      = params.get('CallSid') || ''
    const recordingSid = params.get('RecordingSid') || ''
    const duration     = params.get('RecordingDuration') || ''

    if (callSid && recordingSid && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
      // Construct the MP3 URL — append .mp3 so browsers can play it directly
      const recordingUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Recordings/${recordingSid}.mp3`
      try {
        await supabase
          .from('messages')
          .update({ recording_url: recordingUrl, duration_seconds: parseInt(duration) || null })
          .eq('quo_message_id', callSid)
          .eq('status', 'call')
        console.log(`[twilio-voice] Recording attached: ${recordingSid} → callSid ${callSid}`)
      } catch (err) {
        console.error('[twilio-voice] recording update failed:', err)
      }
    }
    return new Response('OK', { status: 200, headers: CORS_HEADERS })
  }

  const from      = params.get('From') || ''
  const to        = params.get('To') || ''
  const callSid   = params.get('CallSid') || ''
  const toParam   = params.get('To') || ''

  console.log(`[twilio-voice] CallSid=${callSid} From=${from} To=${to}`)

  // Build the recording status callback URL (same function, ?event=recording-complete)
  const recordingCallback = `${url.origin}${url.pathname}?event=recording-complete`

  // ── OUTBOUND (browser → real phone) ─────────────────────
  if (from.startsWith('client:')) {
    const target = (toParam || '').trim()
    if (!target || !target.startsWith('+')) {
      return twiml('<Say>Invalid phone number.</Say><Hangup/>')
    }

    const contact = await findContactByPhone(supabase, target)
    const name = contact?.name || target
    logCall(supabase, contact?.id ?? null, 'outbound', `Called ${name}`, callSid).catch(() => {})

    return twiml(
      `<Dial callerId="${xesc(TWILIO_PHONE_NUMBER)}" answerOnBridge="true" timeout="30" ` +
        `record="record-from-answer" recordingStatusCallback="${xesc(recordingCallback)}" recordingStatusCallbackMethod="POST">` +
        `<Number>${xesc(target)}</Number>` +
      `</Dial>`
    )
  }

  // ── INBOUND (real phone → browser) ──────────────────────
  const contact = await findContactByPhone(supabase, from)
  const name = contact?.name || from
  logCall(supabase, contact?.id ?? null, 'inbound', `Incoming call from ${name}`, callSid).catch(() => {})

  return twiml(
    `<Dial timeout="25" answerOnBridge="true" ` +
      `record="record-from-answer" recordingStatusCallback="${xesc(recordingCallback)}" recordingStatusCallbackMethod="POST">` +
      `<Client>key</Client>` +
    `</Dial>` +
    `<Say voice="alice">Sorry, we missed your call. Please leave a message after the beep.</Say>` +
    `<Record maxLength="90" playBeep="true" finishOnKey="#" trim="trim-silence"/>` +
    `<Say voice="alice">Thanks. We'll call you back soon. Goodbye.</Say>` +
    `<Hangup/>`
  )
})
