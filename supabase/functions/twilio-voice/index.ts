/**
 * twilio-voice
 *
 * TwiML webhook for the BPP CRM Voice integration. Handles these flows:
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
 *   ?event=recording-complete — answered call recording
 *     - Twilio posts after a Dial recording finishes with RecordingUrl + CallSid
 *     - We update the matching messages row with the recording URL
 *
 *   ?event=voicemail-complete — voicemail recording
 *     - Twilio posts after the <Record> voicemail finishes
 *     - We update the messages row: attach recording URL, mark as voicemail,
 *       store transcription text if available
 *
 *   ?event=call-status — call end status (answered vs missed)
 *     - Twilio posts when the <Dial> ends with DialCallStatus
 *     - We mark unanswered calls as missed in the DB
 *
 * Deploy with --no-verify-jwt so Twilio can POST without Authorization.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyTwilioSignature } from '../_shared/auth.ts'

const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER') || '+18648637800'
const TWILIO_ACCOUNT_SID  = Deno.env.get('TWILIO_ACCOUNT_SID') || ''
const TWILIO_AUTH_TOKEN   = Deno.env.get('TWILIO_AUTH_TOKEN') || ''

// Voicemail greeting — override via Supabase secret VOICEMAIL_GREETING.
// Until Key records his own audio (cued in the Visual Consistency Audit), we
// use Polly.Matthew-Neural which is dramatically more natural than the
// default Alice TTS. Apr 27: rewrote the script to sound like Key vs a
// generic answering machine.
const VOICEMAIL_GREETING = Deno.env.get('VOICEMAIL_GREETING')
  || "Hey, you've reached Key with Backup Power Pro. I'm probably on a roof or under a panel. Leave your name and what you're working on after the beep and I'll call you back today."

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

async function findContactByPhone(supabase: any, phone: string): Promise<any | null> {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 10) return null
  const last10 = digits.slice(-10)
  const { data, error } = await supabase.from('contacts').select('id, name, phone')
  if (error) {
    console.error('[twilio-voice] contacts fetch failed:', error.message)
    return null
  }
  if (!data) return null
  return data.find((c: any) => (c.phone || '').replace(/\D/g, '').slice(-10) === last10) ?? null
}

async function logCall(
  supabase: any,
  contactId: string | null,
  direction: 'outbound' | 'inbound',
  body: string,
  callSid: string,
  callType: string = 'call',
) {
  try {
    await supabase.from('messages').insert({
      contact_id: contactId,
      direction,
      body,
      sender: direction === 'outbound' ? 'key' : 'lead',
      quo_message_id: callSid,
      status: callType, // 'call' | 'missed' | 'voicemail'
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

  let rawBody = ''
  let params: URLSearchParams
  try {
    rawBody = await req.text()
    params = new URLSearchParams(rawBody)
  } catch {
    return twiml('<Say>Invalid request.</Say><Hangup/>')
  }

  // ── TWILIO SIGNATURE VERIFICATION ──────────────────────────
  // Without this, unauthenticated callers can POST forged `From`/`To`
  // values and the function returns <Dial><Number>...</Number></Dial>
  // TwiML that bills outbound calls on Key's Twilio account.
  const twAuth = Deno.env.get('TWILIO_AUTH_TOKEN')
  const sigOk = await verifyTwilioSignature(req, rawBody, twAuth)
  if (!sigOk) {
    console.warn('[twilio-voice] signature verification FAILED — rejecting')
    return new Response('forbidden', { status: 403 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // ── ANSWERED CALL RECORDING ──────────────────────────────
  // Twilio posts this after a Dial recording finishes.
  if (event === 'recording-complete') {
    const callSid      = params.get('CallSid') || ''
    const recordingSid = params.get('RecordingSid') || ''
    const duration     = params.get('RecordingDuration') || ''

    if (callSid && recordingSid && TWILIO_ACCOUNT_SID) {
      const recordingUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Recordings/${recordingSid}.mp3`
      try {
        await supabase
          .from('messages')
          .update({ recording_url: recordingUrl, duration_seconds: parseInt(duration) || null })
          .eq('quo_message_id', callSid)
          .eq('status', 'call')
        console.log(`[twilio-voice] Call recording attached: ${recordingSid}`)
      } catch (err) {
        console.error('[twilio-voice] recording update failed:', err)
      }
    }
    return new Response('OK', { status: 200, headers: CORS_HEADERS })
  }

  // ── VOICEMAIL RECORDING ──────────────────────────────────
  // Twilio posts after the <Record> voicemail finishes.
  // We store the recording URL and transcription, mark as voicemail.
  if (event === 'voicemail-complete') {
    const callSid         = params.get('CallSid') || ''
    const recordingSid    = params.get('RecordingSid') || ''
    const duration        = params.get('RecordingDuration') || ''
    const transcription   = params.get('TranscriptionText') || ''
    const transStatus     = params.get('TranscriptionStatus') || ''

    if (callSid && recordingSid && TWILIO_ACCOUNT_SID) {
      const recordingUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Recordings/${recordingSid}.mp3`

      // Find the call to get contact name for the body label
      const { data: msg } = await supabase
        .from('messages')
        .select('contact_id')
        .eq('quo_message_id', callSid)
        .in('status', ['call', 'missed'])
        .maybeSingle()

      let callerName = 'Unknown caller'
      if (msg?.contact_id) {
        const { data: contact } = await supabase
          .from('contacts').select('name').eq('id', msg.contact_id).single()
        if (contact?.name) callerName = contact.name
      }

      const transcriptText = (transStatus === 'completed' && transcription)
        ? transcription
        : null

      try {
        await supabase
          .from('messages')
          .update({
            recording_url: recordingUrl,
            duration_seconds: parseInt(duration) || null,
            status: 'voicemail',
            body: transcriptText
              ? `Voicemail from ${callerName}: ${transcriptText}`
              : `Voicemail from ${callerName}`,
          })
          .eq('quo_message_id', callSid)
          .in('status', ['call', 'missed'])
        console.log(`[twilio-voice] Voicemail stored: ${recordingSid} from ${callerName}`)
      } catch (err) {
        console.error('[twilio-voice] voicemail update failed:', err)
      }
    }
    return new Response('OK', { status: 200, headers: CORS_HEADERS })
  }

  // ── CALL STATUS (answered vs missed) ─────────────────────
  // Twilio posts when the <Dial> ends. DialCallStatus tells us if it was answered.
  if (event === 'call-status') {
    const callSid        = params.get('CallSid') || ''
    const dialCallStatus = (params.get('DialCallStatus') || '').toLowerCase()

    // If not answered and we already logged the call → mark as missed
    if (callSid && (dialCallStatus === 'no-answer' || dialCallStatus === 'busy' || dialCallStatus === 'failed')) {
      try {
        await supabase
          .from('messages')
          .update({ status: 'missed' })
          .eq('quo_message_id', callSid)
          .eq('status', 'call')
          .eq('direction', 'inbound')
        console.log(`[twilio-voice] Marked missed: ${callSid} (${dialCallStatus})`)
      } catch (err) {
        console.error('[twilio-voice] missed call update failed:', err)
      }
      // Fall through to return voicemail TwiML
      return twiml(
        `<Say voice="Polly.Matthew-Neural">${xesc(VOICEMAIL_GREETING)}</Say>` +
        `<Record maxLength="120" playBeep="true" finishOnKey="#" trim="trim-silence" ` +
          `transcribe="true" ` +
          `recordingStatusCallback="${xesc(url.origin + url.pathname + '?event=voicemail-complete')}" ` +
          `recordingStatusCallbackMethod="POST"/>` +
        `<Say voice="Polly.Matthew-Neural">Thank you. Goodbye.</Say>` +
        `<Hangup/>`
      )
    }

    return new Response('OK', { status: 200, headers: CORS_HEADERS })
  }

  const from      = params.get('From') || ''
  const to        = params.get('To') || ''
  const callSid   = params.get('CallSid') || ''
  const toParam   = params.get('To') || ''

  console.log(`[twilio-voice] CallSid=${callSid} From=${from} To=${to}`)

  // Build callback URLs
  const baseUrl          = `${url.origin}${url.pathname}`
  const recordingCallback = `${baseUrl}?event=recording-complete`
  const callStatusCallback = `${baseUrl}?event=call-status`
  const voicemailCallback  = `${baseUrl}?event=voicemail-complete`

  // ── OUTBOUND (browser → real phone) ─────────────────────
  if (from.startsWith('client:')) {
    const target = (toParam || '').trim()
    if (!target || !target.startsWith('+')) {
      return twiml('<Say>Invalid phone number.</Say><Hangup/>')
    }

    const contact = await findContactByPhone(supabase, target)
    const name = contact?.name || target
    await logCall(supabase, contact?.id ?? null, 'outbound', `Called ${name}`, callSid)

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
  await logCall(supabase, contact?.id ?? null, 'inbound', `Incoming call from ${name}`, callSid)

  // Use action callback to detect missed calls cleanly.
  // When the <Dial> ends (answered or not), Twilio POSTs to ?event=call-status
  // with DialCallStatus. If no-answer/busy/failed, that handler returns voicemail TwiML.
  // If answered (completed), it returns empty <Response/> and we're done.
  return twiml(
    `<Dial timeout="25" answerOnBridge="true" action="${xesc(callStatusCallback)}" method="POST" ` +
      `record="record-from-answer" recordingStatusCallback="${xesc(recordingCallback)}" recordingStatusCallbackMethod="POST">` +
      `<Client>key</Client>` +
    `</Dial>`
  )
})
