/**
 * send-sms
 *
 * Server-side SMS/MMS sender for the BPP CRM. Routes through Twilio.
 *
 * Architecture decision (Apr 7 2026): The CRM is Twilio-only. The legacy Quo
 * (OpenPhone) auto-lead-response flow continues running independently from
 * `quo-ai-new-lead`/`quo-ai-followup`/etc, but the CRM's outbound messaging is
 * 100% Twilio. When (864) 400-5302 is ported from Quo to Twilio, the legacy
 * flows get migrated and Quo retires entirely. Until then, the CRM sends from
 * the Twilio test number (864) 863-7800.
 *
 * Request:  POST { contactId: uuid, body: string, mediaUrl?: string }
 *           Authorization: Bearer <SUPABASE_ANON_KEY>
 *
 * MMS: if mediaUrl is provided, Twilio sends a picture message.
 *      Body can be empty when sending media-only.
 *      The saved message body is prefixed: "[media:URL] optional caption"
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
import { requireAnonOrServiceRole, allowRate } from '../_shared/auth.ts'

// ── TWILIO CONFIG ──────────────────────────────────────────────────────────────
const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID') || ''
const TWILIO_AUTH_TOKEN  = Deno.env.get('TWILIO_AUTH_TOKEN') || ''
const TWILIO_FROM        = Deno.env.get('TWILIO_PHONE_NUMBER') || ''

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
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

  // Auth gate — accept the publishable key (CRM) or service role (server).
  // Without this, any internet caller can fire SMS on Key's Twilio bill.
  const gate = requireAnonOrServiceRole(req); if (gate) return gate

  // Apr 27 audit (HIGH-1): rate limit the SMS path — without it a leaked
  // publishable key could be weaponized to spam Key's customers (each
  // request is a $0.008-0.02 Twilio bill). Per-IP 30/min, plus per-contact
  // 5/min — the per-contact cap is the meaningful one because it limits
  // how badly any one customer can be harassed before the gate trips.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!allowRate(`send-sms:${ip}`, 30)) {
    return json(429, { success: false, error: 'rate limited (30/min)' })
  }

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM) {
    console.error('[send-sms] missing Twilio env vars')
    return json(500, { success: false, error: 'twilio not configured' })
  }

  let payload: { contactId?: string; body?: string; mediaUrl?: string; idempotencyKey?: string }
  try {
    payload = await req.json()
  } catch {
    return json(400, { success: false, error: 'invalid json' })
  }

  const contactId = (payload.contactId || '').trim()
  const body      = (payload.body || '').trim()
  const mediaUrl  = (payload.mediaUrl || '').trim()
  const idemKey   = (payload.idempotencyKey || '').trim()

  // Apr 27 audit: prevent double-click duplicates. If client passes the
  // same idempotencyKey within 30s, return the prior result instead of
  // firing a second Twilio API call. Per-IP allowRate already caps abuse;
  // this just protects accidental double-clicks where the spinner UI was
  // too slow to register the first click.
  if (idemKey) {
    if (!allowRate(`send-sms:idem:${idemKey}`, 1)) {
      return json(409, { success: false, error: 'duplicate request — same idempotencyKey already in flight' })
    }
  }

  if (!contactId)           return json(400, { success: false, error: 'contactId required' })
  if (!body && !mediaUrl)   return json(400, { success: false, error: 'body or mediaUrl required' })
  if (body.length > 1600)   return json(400, { success: false, error: 'body exceeds 1600 chars' })

  // Per-contact cap (Apr 27): caps any one customer's harassability at
  // 5 SMS/min, even if the IP cap was bypassed via a botnet. The IP cap
  // limits the attacker; this cap protects each individual customer.
  if (!allowRate(`send-sms:contact:${contactId}`, 5)) {
    return json(429, { success: false, error: 'rate limited per contact (5/min)' })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // ── LOOK UP CONTACT ──────────────────────────────────────────────────────────
  const { data: contact, error: contactErr } = await supabase
    .from('contacts')
    .select('id, name, phone, do_not_contact')
    .eq('id', contactId)
    .single()

  if (contactErr || !contact) return json(404, { success: false, error: 'contact not found' })
  if (!contact.phone)         return json(400, { success: false, error: 'contact has no phone number' })

  // ── TCPA DNC GATE ────────────────────────────────────────────────────────────
  // CLAUDE.md hard rule: any outbound SMS checks contacts.do_not_contact first.
  // alex-followup, alex-agent, alex-ghost, proposal-nudge already enforce this;
  // CRM's primary outbound surface (this file) was missing the check until
  // 2026-04-27. Twilio will also 21610 if the recipient texted STOP at the
  // carrier level — but we shouldn't even attempt the API call if Key's CRM
  // already has the contact flagged DNC.
  if (contact.do_not_contact) {
    console.warn(`[send-sms] DNC blocked: contact ${contactId} (${contact.name || 'unnamed'})`)
    return json(403, {
      success: false,
      error: 'Contact is marked Do Not Contact. Unflag in CRM if this is wrong.',
    })
  }

  // Normalize to E.164
  const digits = String(contact.phone).replace(/\D/g, '')
  let toPhone: string
  if (digits.length === 10)      toPhone = `+1${digits}`
  else if (digits.length >= 11)  toPhone = `+${digits}`
  else return json(400, { success: false, error: 'contact phone is invalid' })

  // ── SEND VIA TWILIO ──────────────────────────────────────────────────────────
  let twilioSid: string | null = null
  let sendError: string | null = null

  // v10.1.31 — OpenPhone bypass while Twilio A2P 10DLC is in carrier review.
  // If the recipient is on ASHLEY_OPENPHONE_TEST_PHONES, route via OpenPhone
  // (5302 line) instead of Twilio (7800). Same DB persistence path.
  const OP_TEST_PHONES = (Deno.env.get('ASHLEY_OPENPHONE_TEST_PHONES') || '')
    .split(',').map(s => s.trim()).filter(Boolean)
  const useOpenPhone = OP_TEST_PHONES.includes('*') || OP_TEST_PHONES.includes(toPhone)

  if (useOpenPhone) {
    try {
      const QUO_API_KEY = Deno.env.get('QUO_API_KEY')!
      const QUO_PHONE_ID = Deno.env.get('QUO_PHONE_NUMBER_ID')!
      const opRes = await fetch('https://api.openphone.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': QUO_API_KEY },
        body: JSON.stringify({
          from: QUO_PHONE_ID,
          to: [toPhone],
          content: body,
        }),
      })
      if (!opRes.ok) {
        const t = await opRes.text()
        console.error('[send-sms] OpenPhone error:', opRes.status, t)
        sendError = `openphone ${opRes.status}: ${t.slice(0, 150)}`
      } else {
        const opData = await opRes.json()
        twilioSid = opData.data?.id || `openphone-${Date.now()}`
      }
    } catch (err) {
      console.error('[send-sms] OpenPhone fetch threw:', err)
      sendError = `openphone network: ${(err as Error).message}`
    }
  } else try {
    const statusCbUrl = (Deno.env.get('SUPABASE_URL') || '') + '/functions/v1/twilio-status-callback'
    const formData = new URLSearchParams({ From: TWILIO_FROM, To: toPhone, Body: body, StatusCallback: statusCbUrl })
    if (mediaUrl) formData.set('MediaUrl', mediaUrl)

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
      try {
        const errJson = JSON.parse(errBody)
        // Apr 27 audit: pass through Twilio's real reason. The prior
        // generic "Twilio 400" left Key guessing whether it was a bad
        // number, A2P unregistered, quota issue, etc. Twilio's `message`
        // field is human-readable. Most useful Twilio codes:
        //   21610 → recipient opted out (texted STOP)
        //   30007/30034 → A2P 10DLC carrier filter (unregistered brand)
        //   21408 → permission to send to that region not enabled
        //   21614 → To number is not a valid mobile number
        const code = String(errJson.code ?? '')
        const msg = String(errJson.message || '').slice(0, 200)
        if (code === '21610') {
          sendError = 'Contact has opted out (replied STOP). Unflag in CRM if intentional.'
        } else if (code === '30007' || code === '30034') {
          sendError = `Carrier blocked (A2P 10DLC unregistered). Register the BPP brand + campaign in Twilio Console → Messaging → Regulatory Compliance, then retry. (code ${code})`
        } else if (code === '21614') {
          sendError = `Twilio rejected — phone number is not a valid mobile number. Check the contact's phone field.`
        } else if (code === '21408') {
          sendError = `Twilio rejected — permission to send to that region not enabled in Geo Permissions.`
        } else if (msg) {
          sendError = `${msg}${code ? ` (code ${code})` : ''}`
        } else {
          sendError = `Twilio ${res.status}`
        }
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

  // DB body: prefix with [media:URL] so CRM can render inline image
  const dbBody = mediaUrl
    ? `[media:${mediaUrl}]${body ? ' ' + body : ''}`
    : body

  // ── PERSIST (always — including failures) ─────────────────────────────────────
  const { data: savedMsg, error: insertErr } = await supabase
    .from('messages')
    .insert({
      contact_id:     contact.id,
      direction:      'outbound',
      body:           dbBody,
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
