/**
 * quo-ai-new-lead
 * Called by get-quote.html when a form is submitted.
 * Replaces Zapier: creates contact in Supabase CRM, fires Facebook CAPI Lead event,
 * sends AI-crafted first text to lead, notifies Key, queues follow-up.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const QUO_API_KEY        = Deno.env.get('QUO_API_KEY')!
const QUO_PHONE_ID       = Deno.env.get('QUO_PHONE_NUMBER_ID')!          // (864) 400-5302 — customer-facing
const QUO_INTERNAL_PHONE_ID = Deno.env.get('QUO_INTERNAL_PHONE_ID') || 'PNPhgKi0ua'  // (864) 863-7155 — Key notifications
const KEY_PHONE          = '+19414417996'                                  // Key's personal cell
const FB_ACCESS_TOKEN    = Deno.env.get('FB_ACCESS_TOKEN')!               // Meta CAPI system user token
const FB_PIXEL_ID        = '1389648775800936'                             // Meta Pixel / Dataset ID

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// ── FACEBOOK CAPI ─────────────────────────────────────────────────────────────
// Sends a server-side Lead event to Meta for accurate attribution.
// All PII is pre-hashed SHA-256 by the browser before being sent here.
async function fireMetaCAPI(payload: any): Promise<void> {
  if (!FB_ACCESS_TOKEN) {
    console.warn('[CAPI] FB_ACCESS_TOKEN not set — skipping')
    return
  }

  const {
    eventId, eventTimestamp, pageUrl, actionSource,
    hashedPhone, hashedEmail, hashedFirstName, hashedLastName,
    hashedCity, hashedState, hashedZip, hashedCountry,
    clientIpAddress, clientUserAgent, fbp, fbc,
  } = payload

  const capiBody = {
    data: [{
      event_name: 'Lead',
      event_time: eventTimestamp || Math.floor(Date.now() / 1000),
      event_id: eventId || '',
      event_source_url: pageUrl || 'https://backuppowerpro.com/get-quote.html',
      action_source: actionSource || 'website',
      user_data: {
        ph:          hashedPhone    ? [hashedPhone]    : undefined,
        em:          hashedEmail    ? [hashedEmail]    : undefined,
        fn:          hashedFirstName? [hashedFirstName]: undefined,
        ln:          hashedLastName ? [hashedLastName] : undefined,
        ct:          hashedCity     ? [hashedCity]     : undefined,
        st:          hashedState    ? [hashedState]    : undefined,
        zp:          hashedZip      ? [hashedZip]      : undefined,
        country:     hashedCountry  ? [hashedCountry]  : undefined,
        client_ip_address:   clientIpAddress   || undefined,
        client_user_agent:   clientUserAgent   || undefined,
        fbp:         fbp || undefined,
        fbc:         fbc || undefined,
      },
      custom_data: {
        content_name:     'generator-inlet-quote',
        content_category: 'generator-installation',
        value:    1500,
        currency: 'USD',
      },
    }],
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${FB_PIXEL_ID}/events?access_token=${FB_ACCESS_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(capiBody),
      }
    )
    const data = await res.json()
    if (data.error) {
      console.error('[CAPI] Error:', JSON.stringify(data.error))
    } else {
      console.log('[CAPI] OK — events_received:', data.events_received)
    }
  } catch (err) {
    console.error('[CAPI] Fetch failed:', err)
  }
}

// ── CREATE QUO CONTACT ────────────────────────────────────────────────────────
// Creates a named contact in Quo so the inbox shows the lead's name.
async function createQuoContact(firstName: string, lastName: string, phone: string): Promise<void> {
  try {
    await fetch('https://api.openphone.com/v1/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': QUO_API_KEY },
      body: JSON.stringify({
        defaultFields: {
          firstName,
          lastName: lastName || '',
          phoneNumbers: [{ value: phone }],
        },
      }),
    })
    console.log('[quo-contact] created:', firstName, phone)
  } catch (err) {
    console.error('[quo-contact] failed:', err)
  }
}

// ── NOTIFY KEY ────────────────────────────────────────────────────────────────
// Sends a quick heads-up to Key's phone when a new lead comes in.
async function notifyKey(firstName: string): Promise<void> {
  const message = `LEAD: ${firstName || 'Unknown'}`

  try {
    await fetch('https://api.openphone.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': QUO_API_KEY },
      body: JSON.stringify({ from: QUO_INTERNAL_PHONE_ID, to: [KEY_PHONE], content: message }),
    })
    console.log('[notify-key] sent')
  } catch (err) {
    console.error('[notify-key] failed:', err)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: CORS_HEADERS })

  let body: any
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400, headers: CORS_HEADERS })
  }

  const {
    firstName, lastName, phone, email,
    address, addressCity, addressState, addressCounty,
    panelLocation, genVoltage,
  } = body || {}

  // ── FILTER: phone + firstName must exist (same as Zapier filter) ─────────
  if (!phone || !firstName) {
    console.log('[filter] missing phone or firstName — skipping')
    return new Response(JSON.stringify({ skipped: true }), { status: 200, headers: CORS_HEADERS })
  }

  // Normalize phone
  const digits = phone.replace(/\D/g, '')
  const normalizedPhone = digits.length === 10 ? `+1${digits}` : `+${digits}`
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()
  const fullAddress = address || [addressCity, addressState].filter(Boolean).join(', ') || ''

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // ── CHECK IF CONTACT ALREADY EXISTS ──────────────────────────────────────
  const last10 = normalizedPhone.slice(-10)
  const { data: existing } = await supabase
    .from('contacts')
    .select('*')
    .ilike('phone', `%${last10}%`)
    .limit(1)

  let contact: any = existing?.[0] ?? null
  const isNew = !contact

  if (!contact) {
    const { data: c } = await supabase
      .from('contacts')
      .insert({
        name: fullName,
        phone: normalizedPhone,
        email: email || null,
        address: fullAddress,
        ai_enabled: true,
        status: 'New Lead',
        notes: [
          panelLocation ? `Panel location: ${panelLocation}` : null,
          genVoltage     ? `Generator voltage: ${genVoltage}` : null,
          addressCounty  ? `County: ${addressCounty}` : null,
        ].filter(Boolean).join(' | ') || null,
      })
      .select()
      .single()
    contact = c
  }

  if (!contact) {
    return new Response(JSON.stringify({ error: 'failed to create contact' }), { status: 500, headers: CORS_HEADERS })
  }

  // ── CREATE QUO CONTACT (non-blocking) ────────────────────────────────────
  // Always upsert so the Quo inbox shows the lead's name from first message.
  createQuoContact(firstName, lastName || '', normalizedPhone).catch(err => console.error('[quo-contact] unhandled:', err))

  // ── FIRE META CAPI (non-blocking) ────────────────────────────────────────
  // Run in background — don't let CAPI delay the text to the lead
  fireMetaCAPI(body).catch(err => console.error('[CAPI] unhandled:', err))

  // ── NOTIFY KEY (non-blocking) ────────────────────────────────────────────
  if (isNew) {
    notifyKey(firstName).catch(err => console.error('[notify-key] unhandled:', err))
  }

  // ── FIRST MESSAGE ─────────────────────────────────────────────────────────
  const firstMessage = `Hey ${firstName}, thanks for reaching out to Backup Power Pro! We got your request and will be in touch shortly to get you a quote. Do you already have a generator or are you looking to get one soon?`

  // ── TYPING DELAY (feels human) ────────────────────────────────────────────
  const typingMs = Math.min(8000, 1500 + Math.random() * 2000)
  await new Promise(resolve => setTimeout(resolve, typingMs))

  // ── SEND FIRST TEXT TO LEAD ───────────────────────────────────────────────
  let quoMsgId: string | null = null
  try {
    const quoRes = await fetch('https://api.openphone.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': QUO_API_KEY },
      body: JSON.stringify({ from: QUO_PHONE_ID, to: [normalizedPhone], content: firstMessage }),
    })
    const quoData = await quoRes.json()
    quoMsgId = quoData.data?.id || null
  } catch (err) {
    console.error('[QUO] Send failed:', err)
  }

  // ── SAVE OUTBOUND MESSAGE ─────────────────────────────────────────────────
  await supabase.from('messages').insert({
    contact_id: contact.id,
    direction: 'outbound',
    body: firstMessage,
    sender: 'ai',
    quo_message_id: quoMsgId,
  })

  // ── QUEUE FOLLOW-UP (24hrs if no reply) ───────────────────────────────────
  if (isNew) {
    await supabase.from('follow_up_queue').insert({
      contact_id: contact.id,
      stage: 1,
      send_after: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
  }

  return new Response(JSON.stringify({ success: true, contactId: contact.id }), {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
})
