/**
 * quo-ashley-webhook
 *
 * Receives inbound SMS from OpenPhone (864) 400-5302, routes through
 * ashley-v2, and sends the reply back via OpenPhone API.
 *
 * Used as the test channel while Twilio number verification is pending.
 * Once Twilio (864) 863-7800 is verified, real customers go through
 * twilio-webhook instead; this function can remain for Quo testing.
 *
 * Webhook URL to configure in OpenPhone console for (864) 400-5302:
 *   https://reowtzedjflwmlptupbk.supabase.co/functions/v1/quo-ashley-webhook
 * Event: message.received
 *
 * Auth: OpenPhone signature verification via QUO_WEBHOOK_SECRET.
 *   If QUO_WEBHOOK_SECRET is not set, requests are accepted (test mode).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyOpenPhoneSignature } from '../_shared/auth.ts'

const QUO_API_KEY         = Deno.env.get('QUO_API_KEY')!
const QUO_PHONE_NUMBER_ID = Deno.env.get('QUO_PHONE_NUMBER_ID')!  // (864) 400-5302
const QUO_WEBHOOK_SECRET  = Deno.env.get('QUO_WEBHOOK_SECRET') || ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, openphone-signature',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST')   return new Response('ok', { status: 200 })

  const rawBody = await req.text()

  // Signature check — if secret not set, let through with a warning (setup mode)
  if (QUO_WEBHOOK_SECRET) {
    const sigOk = await verifyOpenPhoneSignature(req, rawBody, QUO_WEBHOOK_SECRET)
    if (!sigOk) {
      console.warn('[quo-ashley-webhook] signature FAILED')
      return new Response('forbidden', { status: 403, headers: CORS })
    }
  } else {
    console.warn('[quo-ashley-webhook] QUO_WEBHOOK_SECRET not set — skipping sig check')
  }

  let payload: any
  try { payload = JSON.parse(rawBody) } catch {
    return new Response('ok', { status: 200 })
  }

  // OpenPhone wraps events as { data: { object: {...}, type: "..." } }
  const event = payload?.data || payload
  const msg   = event?.object || event

  const direction = msg?.direction
  const from      = msg?.from as string | undefined
  const content   = (msg?.body || msg?.content || '') as string
  const mediaUrls: string[] = (msg?.media || [])
    .map((m: any) => m?.url).filter(Boolean)

  if (direction !== 'incoming' || !from) {
    return new Response('ok', { status: 200, headers: CORS })
  }

  console.log(`[quo-ashley-webhook] inbound from=${from} body=${content.slice(0,80)}`)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SR_KEY       = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const sb           = createClient(SUPABASE_URL, SR_KEY)

  // Look up contact by phone (digit-normalized)
  const { data: allContacts } = await sb.from('contacts')
    .select('id, name, phone, bot_state, bot_disabled, do_not_contact, ai_enabled, ai_paused_until')

  const digits = from.replace(/\D/g, '')
  const last10 = digits.slice(-10)
  const contact = allContacts?.find(
    (c: any) => (c.phone || '').replace(/\D/g, '').slice(-10) === last10
  ) ?? null

  if (!contact) {
    console.log(`[quo-ashley-webhook] unknown sender ${from}`)
    return new Response('ok', { status: 200, headers: CORS })
  }

  // Guards
  if (contact.bot_disabled || contact.do_not_contact || contact.ai_enabled === false) {
    console.log(`[quo-ashley-webhook] bot off for ${contact.name}`)
    return new Response('ok', { status: 200, headers: CORS })
  }
  if (contact.ai_paused_until && new Date(contact.ai_paused_until) > new Date()) {
    console.log(`[quo-ashley-webhook] paused for ${contact.name}`)
    return new Response('ok', { status: 200, headers: CORS })
  }

  // Save inbound to DB (ashley-v2 reads history from DB)
  const msgBody = mediaUrls.length > 0
    ? mediaUrls.map(u => `[media:${u}]`).join(' ') + (content ? ' ' + content : '')
    : (content || '[Empty message]')

  const { error: insertErr } = await sb.from('messages').insert({
    contact_id:   contact.id,
    direction:    'inbound',
    body:         msgBody,
    sender:       'lead',
    sender_phone: from,
    status:       'received',
  })
  if (insertErr) {
    console.error('[quo-ashley-webhook] db insert failed:', insertErr.message)
    return new Response('ok', { status: 200, headers: CORS })
  }

  // Call ashley-v2 with dojo_mode=true so it skips Twilio send;
  // we handle the outbound send below via OpenPhone API.
  let outboundText: string | null = null
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/ashley-v2`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SR_KEY}`,
        apikey: SR_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contact_id:   contact.id,
        message_body: content,
        media_urls:   mediaUrls.length > 0 ? mediaUrls : undefined,
        dojo_mode:    true,
      }),
    })
    if (r.ok) {
      const d = await r.json()
      outboundText = d?.outbound_text ?? null
      console.log(`[quo-ashley-webhook] ashley-v2 ok state=${d?.next_state}`)
    } else {
      console.error('[quo-ashley-webhook] ashley-v2 error', r.status)
    }
  } catch (e) {
    console.error('[quo-ashley-webhook] ashley-v2 exception', e)
  }

  // Send reply via OpenPhone
  if (outboundText) {
    try {
      const opResp = await fetch('https://api.openphone.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: QUO_API_KEY,
        },
        body: JSON.stringify({
          from:    QUO_PHONE_NUMBER_ID,
          to:      [from],
          content: outboundText,
        }),
      })
      if (!opResp.ok) {
        const errText = await opResp.text()
        console.error('[quo-ashley-webhook] openphone send error', opResp.status, errText.slice(0, 200))
      } else {
        console.log(`[quo-ashley-webhook] reply sent to ${from}: ${outboundText.slice(0, 60)}`)
        // Update the outbound message status to 'sent'
        await sb.from('messages').update({ status: 'sent' })
          .eq('contact_id', contact.id)
          .eq('direction', 'outbound')
          .eq('status', 'queued')
          .order('created_at', { ascending: false })
          .limit(1)
      }
    } catch (e) {
      console.error('[quo-ashley-webhook] openphone send exception', e)
    }
  }

  return new Response('ok', { status: 200, headers: CORS })
})
