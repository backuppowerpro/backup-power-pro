/**
 * send-sms
 *
 * Server-side SMS sender for the BPP CRM. Routes through Twilio.
 *
 * Architecture decision (Apr 7 2026): The CRM is Twilio-only. The legacy Quo
 * (OpenPhone) auto-lead-response flow continues running independently from
 * `quo-ai-new-lead`/`quo-ai-followup`/etc, but the CRM's outbound messaging is
 * 100% Twilio. When (864) 400-5302 is ported from Quo to Twilio, the legacy
 * flows get migrated and Quo retires entirely. Until then, the CRM sends from
 * the Twilio test number (864) 863-7800.
 *
 * Request:  POST { contactId: uuid, body: string }
 *           Authorization: Bearer <SUPABASE_ANON_KEY>
 *
 * Response (success, 200):
 *   { success: true, message: { ... } }
 *
 * Response (failure, 4xx/5xx):
 *   { success: false, error: string, message?: { ... } }
 *
 * The row is ALWAYS saved to the messages table — even on a failure — with
 * status='failed' so the CRM thread always reflects what was attempted.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── TWILIO CONFIG ──────────────────────────────────────────────────────────────
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

// ── HANDLER ────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  if (req.method !== 'POST') return json(405, { success: false, error: 'method not allowed' })

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM) {
    console.error('[send-sms] missing Twilio env vars')
    return json(500, { success: false, error: 'twilio not configured' })
  }

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

  // ── SEND VIA TWILIO ──────────────────────────────────────────────────────────
  let twilioSid: string | null = null
  let sendError: string | null = null

  try {
    const formData = new URLSearchParams({ From: TWILIO_FROM, To: toPhone, Body: body })
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
      console.error('[send-sms] Twilio error:', res.status, errBody)
      // Twilio returns useful JSON on error — try to surface a clean message
      try {
        const errJson = JSON.parse(errBody)
        sendError = errJson.message || `Twilio ${res.status}`
      } catch {
        sendError = `Twilio ${res.status}`
      }
    } else {
      const data = await res.json()
      twilioSid = data?.sid ?? null
    }
  } catch (err) {
    console.error('[send-sms] Twilio fetch threw:', err)
    sendError = `network: ${(err as Error).message}`
  }

  const status: 'sent' | 'failed' = sendError ? 'failed' : 'sent'

  // ── PERSIST (always — including failures) ─────────────────────────────────────
  const { data: savedMsg, error: insertErr } = await supabase
    .from('messages')
    .insert({
      contact_id:     contact.id,
      direction:      'outbound',
      body,
      sender:         'key',
      quo_message_id: twilioSid,   // column reused for Twilio SID
      status,
    })
    .select()
    .single()

  if (insertErr) {
    console.error('[send-sms] db insert failed:', insertErr)
    return json(500, { success: false, error: 'db insert failed', dbError: insertErr.message })
  }

  if (status === 'failed') {
    return json(502, { success: false, error: sendError, message: savedMsg })
  }

  return json(200, { success: true, message: savedMsg })
})
