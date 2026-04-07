/**
 * send-sms
 *
 * Server-side SMS sender for the BPP CRM. The browser cannot call OpenPhone
 * directly with the API key (security + we hit a wrong-field bug doing it that
 * way), so the CRM hits this edge function instead.
 *
 * Request:  POST { contactId: uuid, body: string }
 *           Authorization: Bearer <SUPABASE_ANON_KEY>
 *
 * Response (success, 200):
 *   {
 *     success: true,
 *     message: { id, contact_id, direction:'outbound', body, sender:'key',
 *                quo_message_id, status:'sent', created_at },
 *   }
 *
 * Response (failure, 4xx/5xx):
 *   { success: false, error: string, status?: number, quoBody?: any }
 *
 * The row is ALWAYS saved to the messages table — even on a Quo failure — with
 * status='failed' and quo_message_id=null, so the CRM thread always reflects
 * what Key tried to send.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const QUO_API_KEY = Deno.env.get('QUO_API_KEY')!
// (864) 400-5302 — customer-facing line. Stored as a Quo phone-number id (PNxxxxxxxx).
// The OpenPhone /v1/messages endpoint accepts EITHER an E.164 string or a PN id
// in the `from` field, but the field MUST be named `from` — not `phoneNumberId`.
const QUO_PHONE_ID = Deno.env.get('QUO_PHONE_NUMBER_ID')!

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
  const body = (payload.body || '').trim()
  if (!contactId) return json(400, { success: false, error: 'contactId required' })
  if (!body)      return json(400, { success: false, error: 'body required' })
  // OpenPhone hard-caps SMS payloads. Refuse instead of getting silently truncated.
  if (body.length > 1600) return json(400, { success: false, error: 'body exceeds 1600 chars' })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // ── LOOK UP CONTACT ─────────────────────────────────────────────────────
  const { data: contact, error: contactErr } = await supabase
    .from('contacts')
    .select('id, name, phone')
    .eq('id', contactId)
    .single()

  if (contactErr || !contact) {
    console.error('[send-sms] contact lookup failed:', contactErr)
    return json(404, { success: false, error: 'contact not found' })
  }
  if (!contact.phone) {
    return json(400, { success: false, error: 'contact has no phone number' })
  }

  // Normalize to E.164
  const digits = String(contact.phone).replace(/\D/g, '')
  let toPhone: string
  if (digits.length === 10)      toPhone = `+1${digits}`
  else if (digits.length === 11) toPhone = `+${digits}`
  else if (digits.length > 0)    toPhone = `+${digits}`
  else return json(400, { success: false, error: 'contact phone is invalid' })

  // ── SEND VIA OPENPHONE ──────────────────────────────────────────────────
  let quoMessageId: string | null = null
  let status: 'sent' | 'failed' = 'sent'
  let quoErrorText: string | null = null
  let quoErrorStatus: number | null = null
  let quoErrorBody: unknown = null

  try {
    const quoRes = await fetch('https://api.openphone.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // OpenPhone expects the raw API key — NO "Bearer " prefix.
        'Authorization': QUO_API_KEY,
      },
      body: JSON.stringify({
        from: QUO_PHONE_ID, // BUG FIX: was `phoneNumberId` in the old browser code.
        to: [toPhone],
        content: body,
      }),
    })

    if (!quoRes.ok) {
      quoErrorStatus = quoRes.status
      try { quoErrorBody = await quoRes.json() } catch { quoErrorBody = await quoRes.text() }
      quoErrorText = `OpenPhone ${quoRes.status}`
      status = 'failed'
      console.error('[send-sms] OpenPhone send failed:', quoRes.status, quoErrorBody)
    } else {
      const quoData = await quoRes.json()
      quoMessageId = quoData?.data?.id ?? null
    }
  } catch (err) {
    quoErrorText = `network error: ${(err as Error).message}`
    status = 'failed'
    console.error('[send-sms] OpenPhone fetch threw:', err)
  }

  // ── PERSIST OUTBOUND ROW (always — including failures) ──────────────────
  const { data: savedMsg, error: insertErr } = await supabase
    .from('messages')
    .insert({
      contact_id: contact.id,
      direction:  'outbound',
      body,
      sender:     'key',
      quo_message_id: quoMessageId,
      status,
    })
    .select()
    .single()

  if (insertErr) {
    console.error('[send-sms] db insert failed:', insertErr)
    // We sent (or tried to send) the SMS — but couldn't persist. Surface clearly.
    return json(500, {
      success: false,
      error: 'db insert failed',
      dbError: insertErr.message,
      quoMessageId,
      quoStatus: status,
    })
  }

  if (status === 'failed') {
    return json(502, {
      success: false,
      error: quoErrorText || 'send failed',
      status: quoErrorStatus,
      quoBody: quoErrorBody,
      message: savedMsg,
    })
  }

  return json(200, { success: true, message: savedMsg })
})
