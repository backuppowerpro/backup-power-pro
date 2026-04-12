/**
 * alex-agent — Bridge between Quo (OpenPhone) webhooks and Claude Managed Agent
 *
 * Flow:
 * 1. Quo webhook fires on incoming message → hits this function
 * 2. Check if lead has an existing Managed Agent session (stored in Supabase)
 * 3. If not, create a new session
 * 4. Send customer's message to the session
 * 5. Wait for Alex's response
 * 6. Send response back via Quo API
 * 7. If [LEAD_COMPLETE] detected, notify Key
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── CONFIG ────────────────────────────────────────────────────────────────────
const ANTHROPIC_API_KEY   = Deno.env.get('ANTHROPIC_API_KEY')!
const QUO_API_KEY         = Deno.env.get('QUO_API_KEY')!
const QUO_PHONE_ID        = Deno.env.get('QUO_PHONE_NUMBER_ID')!  // (864) 400-5302
const KEY_PHONE            = '+19414417996'                         // Key's personal cell
const QUO_INTERNAL_PHONE_ID = Deno.env.get('QUO_INTERNAL_PHONE_ID') || 'PNPhgKi0ua'  // (864) 863-7155

const ALEX_AGENT_ID = 'agent_011CZzMgMh9DCD7dggmVtfr6'  // v5 Sonnet — proper Key intro
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

async function getOrCreateSession(supabase: any, contactPhone: string, contactName: string): Promise<string> {
  // Check for existing session
  const { data: existing } = await supabase
    .from('alex_sessions')
    .select('session_id')
    .eq('phone', contactPhone)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)

  if (existing?.[0]?.session_id) {
    console.log('[alex] Resuming session:', existing[0].session_id)
    return existing[0].session_id
  }

  // Create new Managed Agent session
  const res = await fetch('https://api.anthropic.com/v1/sessions', {
    method: 'POST',
    headers: ANTHROPIC_HEADERS,
    body: JSON.stringify({
      agent: ALEX_AGENT_ID,
      environment_id: ALEX_ENV_ID,
      title: `Lead: ${contactName || contactPhone}`,
    }),
  })

  const session = await res.json()
  if (!session.id) {
    console.error('[alex] Failed to create session:', JSON.stringify(session))
    throw new Error('Session creation failed')
  }

  // Store session mapping
  await supabase.from('alex_sessions').insert({
    phone: contactPhone,
    session_id: session.id,
    contact_name: contactName || null,
    status: 'active',
  })

  console.log('[alex] Created session:', session.id)
  return session.id
}

async function sendToAlex(sessionId: string, messageText: string): Promise<string> {
  // Send user message event
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

  // Poll for response (wait for agent to finish)
  let alexResponse = ''
  let attempts = 0
  const maxAttempts = 30 // 30 seconds max

  while (attempts < maxAttempts) {
    await new Promise(r => setTimeout(r, 1000)) // Wait 1 second
    attempts++

    const eventsRes = await fetch(`https://api.anthropic.com/v1/sessions/${sessionId}/events`, {
      headers: ANTHROPIC_HEADERS,
    })
    const eventsData = await eventsRes.json()

    // Check session status
    const statusRes = await fetch(`https://api.anthropic.com/v1/sessions/${sessionId}`, {
      headers: ANTHROPIC_HEADERS,
    })
    const statusData = await statusRes.json()

    if (statusData.status === 'idle') {
      // Agent is done — extract the latest agent.message
      const events = Array.isArray(eventsData) ? eventsData : (eventsData.events || eventsData.data || [])

      // Get the last agent.message event
      for (const ev of events) {
        if (ev.type === 'agent.message') {
          for (const c of (ev.content || [])) {
            if (c.type === 'text') {
              alexResponse = c.text
            }
          }
        }
      }
      break
    }
  }

  if (!alexResponse) {
    alexResponse = "Hey! Give me just a moment — I'll get right back to you."
  }

  return alexResponse
}

async function sendQuoMessage(to: string, content: string): Promise<void> {
  try {
    await fetch('https://api.openphone.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': QUO_API_KEY },
      body: JSON.stringify({ from: QUO_PHONE_ID, to: [to], content }),
    })
    console.log('[quo] Sent to', to)
  } catch (err) {
    console.error('[quo] Send failed:', err)
  }
}

async function notifyKey(leadName: string, leadPhone: string, summary: string): Promise<void> {
  const message = `🔔 LEAD READY FOR QUOTE\n\n${summary}\n\nPhone: ${leadPhone}\nAlex collected all info — review photos and create quote.`

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

// ── MAIN HANDLER ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: CORS_HEADERS })

  let body: any
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400, headers: CORS_HEADERS })
  }

  // ── Quo Webhook Payload ────────────────────────────────────────────────────
  // Quo sends: { type: "message.received", data: { object: { ... } } }
  const eventType = body?.type
  const messageData = body?.data?.object

  // Only handle incoming messages
  if (eventType !== 'message.received' || !messageData) {
    console.log('[alex] Ignoring event type:', eventType)
    return new Response(JSON.stringify({ skipped: true }), { status: 200, headers: CORS_HEADERS })
  }

  // Skip outbound messages (our own replies)
  if (messageData.direction === 'outgoing') {
    return new Response(JSON.stringify({ skipped: true, reason: 'outbound' }), { status: 200, headers: CORS_HEADERS })
  }

  const fromPhone = messageData.from || ''
  const messageText = messageData.body || messageData.text || ''
  const hasMedia = !!(messageData.media?.length)

  // Skip empty messages (unless they have media)
  if (!messageText && !hasMedia) {
    return new Response(JSON.stringify({ skipped: true, reason: 'empty' }), { status: 200, headers: CORS_HEADERS })
  }

  console.log('[alex] Incoming from', fromPhone, ':', messageText.substring(0, 50))

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // ── Get or create session ──────────────────────────────────────────────────
  let sessionId: string
  try {
    sessionId = await getOrCreateSession(supabase, fromPhone, '')
  } catch (err) {
    console.error('[alex] Session error:', err)
    return new Response(JSON.stringify({ error: 'session failed' }), { status: 500, headers: CORS_HEADERS })
  }

  // ── Build message for Alex ─────────────────────────────────────────────────
  let alexInput = messageText
  if (hasMedia) {
    alexInput = alexInput
      ? `${alexInput}\n\n[Customer sent a photo]`
      : '[Customer sent a photo]'
  }

  // ── Typing delay (feels human) ─────────────────────────────────────────────
  const typingMs = 1500 + Math.random() * 2000
  await new Promise(r => setTimeout(r, typingMs))

  // ── Send to Alex and get response ──────────────────────────────────────────
  let alexResponse: string
  try {
    alexResponse = await sendToAlex(sessionId, alexInput)
  } catch (err) {
    console.error('[alex] Agent error:', err)
    alexResponse = "Hey! I'm having a little trouble right now — Key will follow up with you shortly."
  }

  // ── Check for [LEAD_COMPLETE] ──────────────────────────────────────────────
  if (alexResponse.includes('[LEAD_COMPLETE]')) {
    const summary = alexResponse.split('[LEAD_COMPLETE]')[1]?.trim() || ''
    // Remove the [LEAD_COMPLETE] tag from the customer-facing message
    alexResponse = alexResponse.split('[LEAD_COMPLETE]')[0].trim()

    // Mark session as complete
    await supabase
      .from('alex_sessions')
      .update({ status: 'complete', summary })
      .eq('session_id', sessionId)

    // Notify Key
    notifyKey('Lead', fromPhone, summary).catch(err => console.error('[notify] unhandled:', err))
  }

  // ── Send Alex's response via Quo ───────────────────────────────────────────
  if (alexResponse) {
    // Strip any markdown formatting (bold, etc.) for SMS
    const smsText = alexResponse
      .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove **bold**
      .replace(/\*(.*?)\*/g, '$1')       // Remove *italic*
      .replace(/__(.*?)__/g, '$1')       // Remove __underline__
      .trim()

    await sendQuoMessage(fromPhone, smsText)

    // Log the exchange
    await supabase.from('messages').insert([
      { contact_id: null, direction: 'inbound', body: messageText, sender: 'customer', phone: fromPhone },
      { contact_id: null, direction: 'outbound', body: smsText, sender: 'alex', phone: fromPhone },
    ]).catch(() => {})
  }

  return new Response(JSON.stringify({ success: true, sessionId }), {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
})
