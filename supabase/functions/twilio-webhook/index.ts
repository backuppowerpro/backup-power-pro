/**
 * twilio-webhook
 *
 * Receives inbound SMS/MMS from Twilio for the BPP test number (864) 863-7800.
 * Twilio sends form-encoded POST data (not JSON):
 *   From, To, Body, MessageSid, NumMedia, MediaUrl0, AccountSid, etc.
 *
 * This function:
 * 1. Parses the inbound message
 * 2. Looks up the sender's contact by phone number (digit-normalized match)
 * 3. Saves the message to the `messages` table
 *    - MMS: body stored as "[media:URL] optional text" for inline image rendering
 * 4. Returns a valid TwiML <Response/> so Twilio marks delivery success
 *
 * Webhook URL to configure in Twilio console:
 *   https://reowtzedjflwmlptupbk.supabase.co/functions/v1/twilio-webhook
 * Method: HTTP POST
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyTwilioSignature } from '../_shared/auth.ts'

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
  let rawBody = ''
  let params: URLSearchParams
  try {
    rawBody = await req.text()
    params = new URLSearchParams(rawBody)
  } catch {
    console.error('[twilio-webhook] failed to parse body')
    return twiml()
  }

  // ── TWILIO SIGNATURE VERIFICATION ──────────────────────────────────────────
  // Reject any POST whose X-Twilio-Signature doesn't HMAC-SHA1 match
  // (AUTH_TOKEN + absolute URL + sorted form pairs). Without this, anyone
  // can POST a fake inbound SMS and pollute the CRM / fire Alex replies
  // to attacker-controlled numbers.
  const twAuth = Deno.env.get('TWILIO_AUTH_TOKEN')
  const sigOk = await verifyTwilioSignature(req, rawBody, twAuth)
  if (!sigOk) {
    console.warn('[twilio-webhook] signature verification FAILED — rejecting')
    return new Response('forbidden', { status: 403 })
  }

  const from       = params.get('From') || ''
  const body       = params.get('Body') || ''
  const messageSid = params.get('MessageSid') || ''
  const numMedia   = parseInt(params.get('NumMedia') || '0', 10)
  // Apr 27 audit: prior code only kept MediaUrl0. If a customer sent 4
  // panel photos in one MMS, 3 were silently lost. Now we collect every
  // MediaUrlN and join with newlines so they all render in the thread.
  const mediaUrls: string[] = []
  for (let i = 0; i < numMedia; i++) {
    const u = params.get(`MediaUrl${i}`)
    if (u) mediaUrls.push(u)
  }
  const mediaUrl0  = mediaUrls[0] || ''

  console.log(`[twilio-webhook] from=${from} sid=${messageSid} media=${numMedia}`)

  // Skip if no content
  if (!from) {
    console.warn('[twilio-webhook] missing From — skipping')
    return twiml()
  }

  // Normalize phone — strip non-digits, compare last 10
  const digits = from.replace(/\D/g, '')
  const last10 = digits.slice(-10)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // ── LOOK UP CONTACT (digit-normalized match) ──────────────────────────────
  // ilike('%digits%') fails for formatted numbers like "(941) 441-7996"
  // because the digit run doesn't appear as a substring. Fetch all and match in JS.
  const { data: allContacts, error: contactsErr } = await supabase
    .from('contacts')
    .select('id, name, phone')

  if (contactsErr) {
    console.error('[twilio-webhook] contacts fetch failed:', contactsErr.message)
    // Return TwiML without saving — better to lose the message than save as a false orphan
    return twiml()
  }

  const contact = allContacts?.find(
    (c: any) => (c.phone || '').replace(/\D/g, '').slice(-10) === last10
  ) ?? null

  // Build the stored body — MMS gets [media:URL] prefix for inline rendering
  // Build body with all media tags so multi-photo MMS doesn't lose attachments.
  const msgBody = mediaUrls.length > 0
    ? mediaUrls.map(u => `[media:${u}]`).join(' ') + (body ? ' ' + body : '')
    : (body || '[Empty message]')

  if (!contact) {
    // Unknown number — still save the message with no contact_id
    // so Key can see it in the inbox and match it manually. Apr 27:
    // also populate sender_phone so the orphan-inbox UI can group by
    // who sent it. Prior code lost the sender phone entirely.
    console.log(`[twilio-webhook] unknown sender ${from} — saving as orphan`)
    await supabase.from('messages').insert({
      contact_id:     null,
      direction:      'inbound',
      body:           msgBody,
      sender:         'lead',
      sender_phone:   from,
      quo_message_id: messageSid,
      status:         'received',
    })
    return twiml()
  }

  // ── SAVE INBOUND MESSAGE ───────────────────────────────────────────────────
  // sender_phone is populated for known contacts too — useful for audit
  // queries (was this from the canonical phone or an alt?) and for the
  // smart-extract path below.
  const { error: insertErr } = await supabase.from('messages').insert({
    contact_id:     contact.id,
    direction:      'inbound',
    body:           msgBody,
    sender:         'lead',
    sender_phone:   from,
    quo_message_id: messageSid,
    status:         'received',
  })

  if (insertErr) {
    console.error('[twilio-webhook] db insert failed:', insertErr)
    // Still return valid TwiML — don't let Twilio retry forever
    return twiml()
  }

  console.log(`[twilio-webhook] saved inbound from ${contact.name || contact.id}`)

  // v10.1.30 — Ashley gated routing. If the sender is on the Ashley
  // allowlist AND has an active bot_state, dispatch to bot-engine instead
  // of falling through to alex-agent. Purely additive: when the gate is
  // closed or the contact isn't bot-active, the existing flow continues.
  try {
    const ASHLEY_ALLOWED_PHONES = (Deno.env.get('ASHLEY_ALLOWED_PHONES') || '')
      .split(',').map(s => s.trim()).filter(Boolean)
    const ashleyEnabled = ASHLEY_ALLOWED_PHONES.includes('*')
      || ASHLEY_ALLOWED_PHONES.includes(from)
    if (ashleyEnabled) {
      const { data: botContact } = await supabase.from('contacts')
        .select('id, bot_state, bot_disabled')
        .eq('id', contact.id)
        .maybeSingle()
      if (botContact?.bot_state && !botContact.bot_disabled) {
        const { tryAcquireMessageLock, recordProcessed } = await import('../_shared/bot-idempotency.ts')
        const acquired = await tryAcquireMessageLock(messageSid)
        if (!acquired) {
          // Duplicate webhook — just ack, don't re-process or fall through.
          return twiml()
        }
        try {
          const SUPABASE_URL_LOCAL = Deno.env.get('SUPABASE_URL')!
          const SUPABASE_SERVICE_KEY_LOCAL = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          await fetch(`${SUPABASE_URL_LOCAL}/functions/v1/bot-engine`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${SUPABASE_SERVICE_KEY_LOCAL}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              trigger: 'inbound_message',
              contact_id: botContact.id,
              message_sid: messageSid,
              message_body: body,
              media_urls: numMedia > 0 ? mediaUrls : undefined,
            }),
          })
          await recordProcessed(messageSid, 'replied', botContact.id)
          return twiml()
        } catch (e) {
          console.error('[ashley-route]', e)
          try {
            await recordProcessed(messageSid, 'error', botContact.id, String(e).slice(0, 200))
          } catch (_) { /* ignore */ }
          // fall through to existing flow on error so message isn't lost
        }
      }
    }
  } catch (e) {
    console.error('[ashley-route] gate eval failed', e)
    // fall through
  }

  // ── SMART AUTO-EXTRACT CONTACT INFO ────────────────────────────────────────
  // Regex-scan inbound body for email + address. If the contact's current
  // value is empty (or a generic placeholder), auto-patch. This runs on
  // every inbound — not just when Alex is active — so we catch cases where
  // the customer texts their email late in the flow or after opt-out.
  // Dupes + overwrites are guarded so we never clobber real data.
  if (body) {
    try {
      const { data: full } = await supabase
        .from('contacts')
        .select('id, name, email, address')
        .eq('id', contact.id)
        .maybeSingle()
      if (full) {
        const patch: Record<string, string> = {}
        const isGeneric = (v: string) => !v || /^(lead|new\s*lead|unknown|customer|test)$/i.test(v.trim())

        // Email — single token match, must have a TLD and @ with at least 2 parts
        const emailMatch = body.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/)
        if (emailMatch && isGeneric(String(full.email || ''))) {
          patch.email = emailMatch[0]
        }

        // US-ish street address — number + street token ending in a common
        // suffix (Rd, St, Ave, Blvd, Dr, Ln, Ct, Way, etc.) with an optional
        // city/state tail. Conservative to avoid false positives on things
        // like "300 watts" or a random number.
        const addressMatch = body.match(/\b\d{1,6}\s+[A-Za-z0-9.'\s]{2,40}\s+(?:Rd|Road|St|Street|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Ln|Lane|Ct|Court|Way|Pl|Place|Ter|Terrace|Hwy|Highway|Pkwy|Parkway|Cir|Circle)\b(?:[\s,]+[A-Za-z\s]{2,30})?/i)
        if (addressMatch && (isGeneric(String(full.address || '')) || (String(full.address || '').length + 10 < addressMatch[0].length))) {
          patch.address = addressMatch[0].trim()
        }

        if (Object.keys(patch).length > 0) {
          await supabase.from('contacts').update(patch).eq('id', contact.id)
          console.log('[twilio-webhook] smart-extract patched:', JSON.stringify(patch))
        }
      }
    } catch (err) {
      // Non-fatal — message is already saved.
      console.error('[twilio-webhook] smart-extract failed:', err)
    }
  }

  // ── FORWARD TO ALEX (fire-and-forget) ─────────────────────────────────────
  // Before the Quo→Twilio port, OpenPhone webhooked alex-agent directly.
  // After the port, inbounds land here and Alex never saw them. Bridge the
  // gap by POSTing an OpenPhone-shaped payload to alex-agent, so the same
  // code path (TEST_MODE, DNC, frustration detector, memory briefing,
  // turn-reflection, vision classification, etc.) runs regardless of carrier.
  //
  // We don't await this — the webhook returns TwiML immediately so Twilio
  // doesn't retry. Alex's reply goes out through Alex's own send path.
  try {
    const mediaArr = numMedia > 0
      ? Array.from({ length: numMedia }).map((_, i) => ({
          url: params.get(`MediaUrl${i}`) || '',
          type: params.get(`MediaContentType${i}`) || 'image/jpeg',
        })).filter(m => m.url)
      : undefined

    const forwardPayload = {
      type: 'message.received',
      data: {
        object: {
          from:      from,
          to:        [params.get('To') || ''],
          body:      body || '',
          id:        messageSid,
          createdAt: new Date().toISOString(),
          ...(mediaArr && mediaArr.length > 0 ? { media: mediaArr } : {}),
        },
      },
    }
    const sr = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    fetch('https://reowtzedjflwmlptupbk.supabase.co/functions/v1/alex-agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sr}` },
      body: JSON.stringify(forwardPayload),
    }).catch((e) => console.error('[twilio-webhook] alex forward failed:', e))
  } catch (err) {
    console.error('[twilio-webhook] alex forward construction failed:', err)
  }

  // Return empty TwiML — no auto-reply (Alex handles replies async above)
  return twiml()
})
