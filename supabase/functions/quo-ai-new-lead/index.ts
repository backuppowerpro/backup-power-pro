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
// Creates a named contact in Quo so the inbox shows the lead's name + all form info.
// IMPORTANT: Quo API requires every phoneNumbers[] entry to have BOTH `name` and `value`.
// Sending only `value` returns 400 and the contact is silently never created.
async function createQuoContact(
  firstName: string,
  lastName: string,
  phone: string,
  email?: string,
  address?: string,
): Promise<void> {
  try {
    const defaultFields: Record<string, unknown> = {
      firstName,
      lastName: lastName || '',
      phoneNumbers: [{ name: 'Mobile', value: phone }],
    }
    if (email) {
      defaultFields.emails = [{ name: 'Work', value: email }]
    }
    if (address) {
      defaultFields.addresses = [{ name: 'Home', value: address }]
    }

    const res = await fetch('https://api.openphone.com/v1/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': QUO_API_KEY },
      body: JSON.stringify({ defaultFields }),
    })
    if (!res.ok) {
      const errBody = await res.text()
      console.error('[quo-contact] HTTP', res.status, errBody)
      return
    }
    console.log('[quo-contact] created:', firstName, phone)
  } catch (err) {
    console.error('[quo-contact] failed:', err)
  }
}

// ── NOTIFY KEY ────────────────────────────────────────────────────────────────
// Sends a triage-ready heads-up to Key's phone when a new lead comes in.
// Content: first name, city (from the address), phone, panel-location if
// captured. Goal: Key decides in 2 seconds whether to drop everything and
// reply now (speed-to-lead) or handle in 10 minutes.
async function notifyKey(opts: {
  firstName: string
  city?: string
  phone?: string
  panelLocation?: string
}): Promise<void> {
  const parts = [`LEAD: ${opts.firstName || 'Unknown'}`]
  if (opts.city) parts.push(opts.city)
  if (opts.phone) parts.push(opts.phone)
  if (opts.panelLocation) parts.push(`panel: ${opts.panelLocation}`)
  const message = parts.join(' · ')

  try {
    await fetch('https://api.openphone.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': QUO_API_KEY },
      body: JSON.stringify({ from: QUO_INTERNAL_PHONE_ID, to: [KEY_PHONE], content: message }),
    })
    console.log('[notify-key] sent:', message)
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

  const rawBody = body || {}

  // Security audit #7: sanitize form-submitted strings before persisting.
  // Strip bracket markers, newlines, and common injection patterns; length-cap
  // per-field. These fields later feed into Alex's [INTERNAL BRIEFING] context.
  const sanitize = (s: any, max = 120): string | null => {
    if (s == null) return null
    return String(s)
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\[(END|INTERNAL|\/|SYSTEM|ASSISTANT|USER)/gi, '(')
      .replace(/ignore\s+(all\s+)?previous|ignore\s+above|disregard\s+(all\s+)?previous/gi, '---')
      .slice(0, max)
      .trim() || null
  }

  const firstName      = sanitize(rawBody.firstName, 50)
  const lastName       = sanitize(rawBody.lastName, 50)
  const phoneRaw       = rawBody.phone
  const email          = sanitize(rawBody.email, 120)
  const address        = sanitize(rawBody.address, 200)
  const addressCity    = sanitize(rawBody.addressCity, 80)
  const addressState   = sanitize(rawBody.addressState, 40)
  const addressCounty  = sanitize(rawBody.addressCounty, 80)
  const addressZip     = sanitize(rawBody.addressZip, 16)
  const panelLocation  = sanitize(rawBody.panelLocation, 80)
  const genVoltage     = sanitize(rawBody.genVoltage, 40)

  // ── FILTER: phone + firstName must exist ─────────────────────────────────
  if (!phoneRaw || !firstName) {
    console.log('[filter] missing phone or firstName — skipping')
    return new Response(JSON.stringify({ skipped: true }), { status: 200, headers: CORS_HEADERS })
  }

  // Normalize phone
  const digits = String(phoneRaw).replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 15) {
    // Obviously bad phone — reject before any SMS/CAPI fires
    return new Response(JSON.stringify({ error: 'invalid phone' }), { status: 400, headers: CORS_HEADERS })
  }
  const normalizedPhone = digits.length === 10 ? `+1${digits}` : `+${digits}`
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()
  const fullAddress = address || [addressCity, addressState].filter(Boolean).join(', ') || ''

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // ── CHECK IF CONTACT ALREADY EXISTS (security #9: exact E.164 match) ─────
  const { data: existing } = await supabase
    .from('contacts')
    .select('*')
    .eq('phone', normalizedPhone)
    .limit(1)

  let contact: any = existing?.[0] ?? null
  const isNew = !contact

  // ── LEGAL C3: DNC check — never re-engage an opted-out contact ───────────
  // Even if the same phone fills out the form again, honor their prior STOP.
  if (contact?.do_not_contact) {
    console.log('[new-lead] DNC flag set on contact; dropping submission')
    // Still record the submission in the consent log for audit trail
    supabase.from('sms_consent_log').insert({
      contact_id: contact.id,
      phone: normalizedPhone,
      event: 'submit_blocked_dnc',
      consent_at: new Date().toISOString(),
      consent_ip: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || null,
      consent_ua: req.headers.get('user-agent') || null,
      consent_page: rawBody.pageUrl || null,
      raw: rawBody as any,
    }).then(() => {}, () => {})
    return new Response(JSON.stringify({ skipped: true, reason: 'do_not_contact' }), { status: 200, headers: CORS_HEADERS })
  }

  const nowIso = new Date().toISOString()
  const consentIp = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || ''
  const consentUa = req.headers.get('user-agent') || ''
  const consentPage = String(rawBody.pageUrl || '')

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
          addressZip     ? `Zip: ${addressZip}` : null,
        ].filter(Boolean).join(' | ') || null,
        // Legal audit H6: durable consent record on the contact row
        consent_at: nowIso,
        consent_ip: consentIp || null,
        consent_ua: consentUa || null,
        consent_page: consentPage || null,
      })
      .select()
      .single()
    contact = c
  }

  if (!contact) {
    return new Response(JSON.stringify({ error: 'failed to create contact' }), { status: 500, headers: CORS_HEADERS })
  }

  // Legal audit H6: immutable consent log (per-submission, survives contact deletion)
  supabase.from('sms_consent_log').insert({
    contact_id: contact.id,
    phone: normalizedPhone,
    event: 'submit',
    consent_at: nowIso,
    consent_ip: consentIp || null,
    consent_ua: consentUa || null,
    consent_page: consentPage || null,
    consent_version: 'v1-2026-04-17',
    raw: rawBody as any,
  }).then(() => {}, () => {})

  // ── CREATE QUO CONTACT (non-blocking) ────────────────────────────────────
  // Always upsert so the Quo inbox shows the lead's name from first message.
  createQuoContact(firstName, lastName || '', normalizedPhone, email || undefined, fullAddress || undefined).catch(err => console.error('[quo-contact] unhandled:', err))

  // ── FIRE META CAPI (non-blocking) ────────────────────────────────────────
  // Run in background — don't let CAPI delay the text to the lead
  fireMetaCAPI(body).catch(err => console.error('[CAPI] unhandled:', err))

  // ── NOTIFY KEY (non-blocking) ────────────────────────────────────────────
  if (isNew) {
    // Format phone as (864) 863-7800 for a native tap-to-call on Key's iPhone.
    const phoneDisplay = normalizedPhone && normalizedPhone.length === 12
      ? `(${normalizedPhone.slice(2, 5)}) ${normalizedPhone.slice(5, 8)}-${normalizedPhone.slice(8)}`
      : normalizedPhone || ''
    notifyKey({
      firstName,
      city: addressCity || undefined,
      phone: phoneDisplay || undefined,
      panelLocation: panelLocation || undefined,
    }).catch(err => console.error('[notify-key] unhandled:', err))
  }

  // ── FIRST MESSAGE ─────────────────────────────────────────────────────────
  // Legal audit H1: first message must identify brand (CTIA 10DLC) and include
  // STOP instruction. Alex's subsequent texts stay conversational; this is the
  // one "clean first impression" that carriers + TCPA compliance scan for.
  const firstMessage = `Hey ${firstName}, this is Alex with Backup Power Pro — got your generator-inlet request. To build your quote, can you send a quick photo of your electrical panel (door open)? Takes 30 seconds and lets Key give you an accurate price with no surprises. Reply STOP to opt out.`

  // ── LEGAL AUDIT M2: quiet-hours gate on synchronous opener ───────────────
  // Federal TCPA is 8am-9pm recipient-local; state mini-TCPAs (FL/OK/WA) are
  // stricter. We don't yet map area code → timezone, so fall back to the most
  // restrictive continental window: if current ET hour is <8 or >=21, queue
  // a follow_up_queue row for 8:15 AM ET the next day instead of sending now.
  // Real carriers won't flag a consent-driven opener in daytime hours, but
  // late-night opener blasts are a documented complaint surface.
  const nowEtOpener = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const etHour = nowEtOpener.getHours()
  const isQuietHours = etHour < 8 || etHour >= 21

  if (isQuietHours) {
    // Queue opener for 8:15 AM ET next morning. alex-followup picks this up.
    const nextMorning = new Date(nowEtOpener)
    nextMorning.setHours(8, 15 + Math.floor(Math.random() * 10), 0, 0)
    if (nowEtOpener.getHours() >= 21) nextMorning.setDate(nextMorning.getDate() + 1)
    // Convert ET to UTC for DB
    const offsetMs = nowEtOpener.getTime() - new Date(nowEtOpener.toLocaleString('en-US', { timeZone: 'UTC' })).getTime()
    const sendAtUtc = new Date(nextMorning.getTime() - offsetMs)
    await supabase.from('follow_up_queue').insert({
      contact_id: contact.id,
      stage: 0,  // stage 0 = opener (not a follow-up)
      send_after: sendAtUtc.toISOString(),
    })
    console.log('[new-lead] Quiet hours (ET hour', etHour, ') — opener queued for', sendAtUtc.toISOString())
    return new Response(JSON.stringify({ success: true, contactId: contact.id, queued: true, sendAt: sendAtUtc.toISOString() }), {
      status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

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
