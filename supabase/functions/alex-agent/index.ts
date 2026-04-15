/**
 * alex-agent — Bridge between Quo (OpenPhone) webhooks and Claude Managed Agent
 *
 * TEST MODE: Only accepts messages from/sends to KEY_PHONE (+19414417996)
 * To test: text (864) 400-5302 from your cell. Alex will text you back first.
 * To reset: text RETEST — clears the session and Alex sends a fresh opening.
 *
 * Flow:
 * 1. Quo webhook fires on incoming message → hits this function
 * 2. Idempotency check: reject duplicate webhook deliveries immediately
 * 3. TEST MODE: reject any number that isn't KEY_PHONE
 * 4. RETEST keyword: wipe session, trigger Alex opener
 * 5. New session: trigger Alex opener automatically (he texts first)
 * 6. Existing session: relay lead's message to Alex, send response back
 * 7. If [LEAD_COMPLETE] detected, notify Key
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── CONFIG ────────────────────────────────────────────────────────────────────
const ANTHROPIC_API_KEY      = Deno.env.get('ANTHROPIC_API_KEY')!
const QUO_API_KEY            = Deno.env.get('QUO_API_KEY')!
const QUO_PHONE_ID           = Deno.env.get('QUO_PHONE_NUMBER_ID')!   // (864) 400-5302
const KEY_PHONE              = '+19414417996'                           // Key's personal cell
const QUO_INTERNAL_PHONE_ID  = Deno.env.get('QUO_INTERNAL_PHONE_ID') || 'PNPhgKi0ua'  // (864) 863-7155

// ── TEST MODE ─────────────────────────────────────────────────────────────────
// Set to false when ready to go live with real leads
const TEST_MODE = true

const ALEX_AGENT_ID = 'agent_011Ca4EqNFKhLkRojPYt6uVA'  // v13 Sonnet — no em dashes, clean photo flow
const ALEX_ENV_ID   = 'env_01Ba8sDT1CgQrWE5bLvtvHwK'

const ANTHROPIC_HEADERS = {
  'x-api-key': ANTHROPIC_API_KEY,
  'anthropic-version': '2023-06-01',
  'anthropic-beta': 'managed-agents-2026-04-01',
  'content-type': 'application/json',
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

async function claimMessage(supabase: any, messageId: string): Promise<boolean> {
  // Returns true if we claimed it (first to process), false if duplicate
  const { error } = await supabase
    .from('alex_dedup')
    .insert({ message_id: messageId })
  // 23505 = unique_violation — another invocation already claimed this message
  if (error?.code === '23505') return false
  return true
}

async function createNewSession(supabase: any, contactPhone: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/sessions', {
    method: 'POST',
    headers: ANTHROPIC_HEADERS,
    body: JSON.stringify({
      agent: ALEX_AGENT_ID,
      environment_id: ALEX_ENV_ID,
      title: `Lead: ${contactPhone}`,
    }),
  })

  const session = await res.json()
  if (!session.id) {
    console.error('[alex] Failed to create session:', JSON.stringify(session))
    throw new Error('Session creation failed')
  }

  await supabase.from('alex_sessions').insert({
    phone: contactPhone,
    session_id: session.id,
    status: 'active',
  })

  console.log('[alex] Created session:', session.id)
  return session.id
}

async function getActiveSession(supabase: any, contactPhone: string): Promise<string | null> {
  const { data: existing } = await supabase
    .from('alex_sessions')
    .select('session_id')
    .eq('phone', contactPhone)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)

  return existing?.[0]?.session_id || null
}

async function clearSessions(supabase: any, contactPhone: string): Promise<void> {
  await supabase
    .from('alex_sessions')
    .update({ status: 'reset' })
    .eq('phone', contactPhone)
    .eq('status', 'active')
  console.log('[alex] Cleared sessions for', contactPhone)
}

async function sendToAlex(sessionId: string, messageText: string): Promise<string> {
  // Get baseline event count before posting — so we don't grab a stale response
  const beforeRes = await fetch(`https://api.anthropic.com/v1/sessions/${sessionId}/events`, {
    headers: ANTHROPIC_HEADERS,
  })
  const beforeData = await beforeRes.json()
  const beforeEvents = Array.isArray(beforeData) ? beforeData : (beforeData.events || beforeData.data || [])
  const baselineCount = beforeEvents.length

  // Post user message event
  await fetch(`https://api.anthropic.com/v1/sessions/${sessionId}/events`, {
    method: 'POST',
    headers: ANTHROPIC_HEADERS,
    body: JSON.stringify({
      events: [{
        type: 'user.message',
        content: [{ type: 'text', text: messageText }],
      }],
    }),
  })

  // Poll: wait for session to go non-idle then back to idle, with new events
  let alexResponse = ''
  let attempts = 0
  const maxAttempts = 35
  let seenNonIdle = false

  while (attempts < maxAttempts) {
    await new Promise(r => setTimeout(r, 1000))
    attempts++

    const statusRes = await fetch(`https://api.anthropic.com/v1/sessions/${sessionId}`, {
      headers: ANTHROPIC_HEADERS,
    })
    const statusData = await statusRes.json()
    const currentStatus = statusData.status

    if (currentStatus !== 'idle') {
      seenNonIdle = true
      continue
    }

    // Idle — but only collect if we've seen it run, or waited long enough
    if (seenNonIdle || attempts >= 5) {
      const eventsRes = await fetch(`https://api.anthropic.com/v1/sessions/${sessionId}/events`, {
        headers: ANTHROPIC_HEADERS,
      })
      const eventsData = await eventsRes.json()
      const events = Array.isArray(eventsData) ? eventsData : (eventsData.events || eventsData.data || [])

      if (events.length > baselineCount) {
        // New events present — find the last agent.message text
        for (const ev of events) {
          if (ev.type === 'agent.message') {
            for (const c of (ev.content || [])) {
              if (c.type === 'text') alexResponse = c.text
            }
          }
        }
        break
      }
    }
  }

  if (!alexResponse) {
    alexResponse = 'Give me just a moment and I will be right back to you.'
  }

  return alexResponse
}

async function updateLastOutbound(supabase: any, sessionId: string): Promise<void> {
  await supabase
    .from('alex_sessions')
    .update({ last_outbound_at: new Date().toISOString() })
    .eq('session_id', sessionId)
}

async function sendQuoMessage(to: string, content: string): Promise<void> {
  try {
    await fetch('https://api.openphone.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': QUO_API_KEY },
      body: JSON.stringify({ from: QUO_PHONE_ID, to: [to], content }),
    })
    console.log('[quo] Sent to', to, ':', content.substring(0, 60))
  } catch (err) {
    console.error('[quo] Send failed:', err)
  }
}

async function notifyKey(leadPhone: string, summary: string): Promise<void> {
  const message = `LEAD READY FOR QUOTE\n\n${summary}\n\nPhone: ${leadPhone}\nAlex collected all info. Review photos and create quote.`
  try {
    await fetch('https://api.openphone.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': QUO_API_KEY },
      body: JSON.stringify({ from: QUO_INTERNAL_PHONE_ID, to: [KEY_PHONE], content: message }),
    })
    console.log('[notify] Sent lead summary to Key')
  } catch (err) {
    console.error('[notify] Failed:', err)
  }
}

// Strip markdown and dashes from SMS text
function cleanSms(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\u2014/g, ',')   // em dash → comma
    .replace(/\u2013/g, '-')   // en dash → hyphen
    .trim()
}

// Alex's opener prompt — sent internally to trigger the first message
const OPENER_PROMPT = `You're reaching out to a new homeowner lead for the first time.
Send your opening text message now. Keep it to 1-2 sentences. Natural, warm, no pressure.`

// ── MAIN HANDLER ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: CORS_HEADERS })

  let body: any
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400, headers: CORS_HEADERS })
  }

  // ── Quo Webhook Payload ────────────────────────────────────────────────────
  const eventType   = body?.type
  const messageData = body?.data?.object

  if (eventType !== 'message.received' || !messageData) {
    console.log('[alex] Ignoring event type:', eventType)
    return new Response(JSON.stringify({ skipped: true }), { status: 200, headers: CORS_HEADERS })
  }

  if (messageData.direction === 'outgoing') {
    return new Response(JSON.stringify({ skipped: true, reason: 'outbound' }), { status: 200, headers: CORS_HEADERS })
  }

  const fromPhone   = messageData.from || ''
  const messageText = (messageData.body || messageData.text || '').trim()
  const hasMedia    = !!(messageData.media?.length)
  const quoMsgId    = messageData.id || `${fromPhone}-${messageData.createdAt || Date.now()}`

  // ── TEST MODE GATE ─────────────────────────────────────────────────────────
  if (TEST_MODE && fromPhone !== KEY_PHONE) {
    console.log('[alex] TEST MODE: ignoring non-Key number:', fromPhone)
    return new Response(JSON.stringify({ skipped: true, reason: 'test_mode' }), { status: 200, headers: CORS_HEADERS })
  }

  if (!messageText && !hasMedia) {
    return new Response(JSON.stringify({ skipped: true, reason: 'empty' }), { status: 200, headers: CORS_HEADERS })
  }

  console.log('[alex] Incoming from', fromPhone, 'id:', quoMsgId, ':', messageText.substring(0, 60))

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // ── IDEMPOTENCY: reject duplicate webhook deliveries ───────────────────────
  const claimed = await claimMessage(supabase, quoMsgId)
  if (!claimed) {
    console.log('[alex] Duplicate webhook delivery, skipping:', quoMsgId)
    return new Response(JSON.stringify({ skipped: true, reason: 'duplicate' }), { status: 200, headers: CORS_HEADERS })
  }

  // ── RETEST KEYWORD ─────────────────────────────────────────────────────────
  if (messageText.toUpperCase() === 'RETEST') {
    console.log('[alex] RETEST received — clearing session and sending opener')
    await clearSessions(supabase, fromPhone)

    let sessionId: string
    try {
      sessionId = await createNewSession(supabase, fromPhone)
    } catch (err) {
      console.error('[alex] Session error on RETEST:', err)
      return new Response(JSON.stringify({ error: 'session failed' }), { status: 500, headers: CORS_HEADERS })
    }

    const opener = await sendToAlex(sessionId, OPENER_PROMPT)
    await sendQuoMessage(fromPhone, cleanSms(opener))
    await updateLastOutbound(supabase, sessionId)

    return new Response(JSON.stringify({ success: true, action: 'retest', sessionId }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  // ── GET OR CREATE SESSION ──────────────────────────────────────────────────
  let sessionId = await getActiveSession(supabase, fromPhone)
  const isNewSession = !sessionId

  if (!sessionId) {
    try {
      sessionId = await createNewSession(supabase, fromPhone)
    } catch (err) {
      console.error('[alex] Session error:', err)
      return new Response(JSON.stringify({ error: 'session failed' }), { status: 500, headers: CORS_HEADERS })
    }
  }

  // ── NEW SESSION: Alex texts first ──────────────────────────────────────────
  if (isNewSession) {
    console.log('[alex] New session — sending opener first')
    const opener = await sendToAlex(sessionId, OPENER_PROMPT)
    await sendQuoMessage(fromPhone, cleanSms(opener))
    await updateLastOutbound(supabase, sessionId)

    // If their first message was just a greeting, opener is enough
    const isJustGreeting = /^(hi|hey|hello|yo|sup|test|testing|retest)[\s!.?]*$/i.test(messageText)
    if (isJustGreeting) {
      return new Response(JSON.stringify({ success: true, action: 'opener_sent' }), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }
  }

  // ── BUILD MESSAGE FOR ALEX ─────────────────────────────────────────────────
  let alexInput = messageText
  if (hasMedia) {
    alexInput = alexInput
      ? `${alexInput}\n\n[Customer sent a photo]`
      : '[Customer sent a photo]'
  }

  // ── TYPING DELAY (feels human) ─────────────────────────────────────────────
  const typingMs = 1500 + Math.random() * 2000
  await new Promise(r => setTimeout(r, typingMs))

  // ── SEND TO ALEX ───────────────────────────────────────────────────────────
  let alexResponse: string
  try {
    alexResponse = await sendToAlex(sessionId, alexInput)
  } catch (err) {
    console.error('[alex] Agent error:', err)
    alexResponse = "I am having a little trouble right now. Key will follow up with you shortly."
  }

  // ── CHECK FOR [LEAD_COMPLETE] ──────────────────────────────────────────────
  if (alexResponse.includes('[LEAD_COMPLETE]')) {
    const summary = alexResponse.split('[LEAD_COMPLETE]')[1]?.trim() || ''
    alexResponse = alexResponse.split('[LEAD_COMPLETE]')[0].trim()

    await supabase
      .from('alex_sessions')
      .update({ status: 'complete', summary })
      .eq('session_id', sessionId)

    notifyKey(fromPhone, summary).catch(err => console.error('[notify] unhandled:', err))
  }

  // ── SEND RESPONSE VIA QUO ──────────────────────────────────────────────────
  if (alexResponse) {
    await sendQuoMessage(fromPhone, cleanSms(alexResponse))
    await updateLastOutbound(supabase, sessionId)
  }

  return new Response(JSON.stringify({ success: true, sessionId }), {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
})
