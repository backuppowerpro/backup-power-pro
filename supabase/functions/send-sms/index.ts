/**
 * send-sms
 *
 * Server-side SMS sender for the BPP CRM. Supports both OpenPhone (Quo) and Twilio.
 * Provider is controlled by the SMS_PROVIDER environment variable:
 *   SMS_PROVIDER=openphone  → routes through OpenPhone API (default, existing Quo numbers)
 *   SMS_PROVIDER=twilio     → routes through Twilio API (new integration, test number now, port later)
 *
 * Request:  POST { contactId: uuid, body: string }
 *           Authorization: Bearer <SUPABASE_ANON_KEY>
 *
 * Response (success, 200):
 *   { success: true, message: { ... }, provider: 'openphone'|'twilio' }
 *
 * Response (failure, 4xx/5xx):
 *   { success: false, error: string }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── PROVIDER CONFIG ────────────────────────────────────────────────────────────
const SMS_PROVIDER = Deno.env.get('SMS_PROVIDER') || 'openphone'

// OpenPhone (Quo)
const QUO_API_KEY  = Deno.env.get('QUO_API_KEY') || ''
const QUO_PHONE_ID = Deno.env.get('QUO_PHONE_NUMBER_ID') || ''

// Twilio
const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID') || ''
const TWILIO_AUTH_TOKEN  = Deno.env.get('TWILIO_AUTH_TOKEN') || ''
const TWILIO_FROM        = Deno.env.get('TWILIO_PHONE_NUMBER') || ''

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })

// ── SEND VIA OPENPHONE ─────────────────────────────────────────────────────────
async function sendViaOpenPhone(to: string, body: string): Promise<{ id: string | null; error: string | null }> {
  try {
    const res = await fetch('https://api.openphone.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': QUO_API_KEY,
      },
      body: JSON.stringify({ from: QUO_PHONE_ID, to: [to], content: body }),
    })
    if (!res.ok) {
      const errBody = await res.text()
      console.error('[send-sms/openphone] error:', res.status, errBody)
      return { id: null, error: `OpenPhone ${res.status}` }
    }
    const data = await res.json()
    return { id: data?.data?.id ?? null, error: null }
  } catch (err) {
    console.error('[send-sms/openphone] threw:', err)
    return { id: null, error: `network: ${(err as Error).message}` }
  }
}

// ── SEND VIA TWILIO ────────────────────────────────────────────────────────────
async function sendViaTwilio(to: string, body: string): Promise<{ id: string | null; error: string | null }> {
  try {
    const formData = new URLSearchParams({ From: TWILIO_FROM, To: to, Body: body })
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
        },
        body: formData.toString(),
      }
    )
    if (!res.ok) {
      const errBody = await res.text()
      console.error('[send-sms/twilio] error:', res.status, errBody)
      return { id: null, error: `Twilio ${res.status}` }
    }
    const data = await res.json()
    return { id: data?.sid ?? null, error: null }
  } catch (err) {
    console.error('[send-sms/twilio] threw:', err)
    return { id: null, error: `network: ${(err as Error).message}` }
  }
}

// ── HANDLER ────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  if (req.method !== 'POST') return json(405, { success: false, error: 'method not allowed' })

  let payload: { contactId?: string; body?: string }
  try {
    payload = await req.json()
  } catch {
    return json(400, { success: false, error: 'invalid json' })
  }

  const contactId = (payload.contactId || '').trim()
  const body      = (payload.body || '').trim()
  if (!contactId) return json(400, { success: false, error: 'contactId required' })
  if (!body)      return json(400, { success: false, error: 'body required' })
  if (body.length > 1600) return json(400, { success: false, error: 'body exceeds 1600 chars' })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // ── LOOK UP CONTACT ──────────────────────────────────────────────────────────
  const { data: contact, error: contactErr } = await supabase
    .from('contacts')
    .select('id, name, phone')
    .eq('id', contactId)
    .single()

  if (contactErr || !contact) return json(404, { success: false, error: 'contact not found' })
  if (!contact.phone)         return json(400, { success: false, error: 'contact has no phone number' })

  // Normalize to E.164
  const digits = String(contact.phone).replace(/\D/g, '')
  let toPhone: string
  if (digits.length === 10)      toPhone = `+1${digits}`
  else if (digits.length >= 11)  toPhone = `+${digits}`
  else return json(400, { success: false, error: 'contact phone is invalid' })

  // ── SEND VIA SELECTED PROVIDER ────────────────────────────────────────────────
  const provider = SMS_PROVIDER === 'twilio' ? 'twilio' : 'openphone'
  console.log(`[send-sms] provider=${provider}, to=${toPhone}`)

  const { id: providerMsgId, error: sendError } = provider === 'twilio'
    ? await sendViaTwilio(toPhone, body)
    : await sendViaOpenPhone(toPhone, body)

  const status: 'sent' | 'failed' = sendError ? 'failed' : 'sent'

  // ── PERSIST (always — including failures) ─────────────────────────────────────
  const { data: savedMsg, error: insertErr } = await supabase
    .from('messages')
    .insert({
      contact_id:     contact.id,
      direction:      'outbound',
      body,
      sender:         'key',
      quo_message_id: providerMsgId,   // reused for Twilio SID too
      status,
    })
    .select()
    .single()

  if (insertErr) {
    console.error('[send-sms] db insert failed:', insertErr)
    return json(500, { success: false, error: 'db insert failed', dbError: insertErr.message })
  }

  if (status === 'failed') {
    return json(502, { success: false, error: sendError, message: savedMsg, provider })
  }

  return json(200, { success: true, message: savedMsg, provider })
})
