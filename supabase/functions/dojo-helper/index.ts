/**
 * dojo-helper — service-role DB ops for the Alex Dojo runner.
 *
 * The dojo (`scripts/alex/dojo.js`) needs to:
 *   1. Read Alex's outbound messages for a smoke-test phone (so it can
 *      grade Alex's actual replies, not its own simulator output).
 *   2. Delete every test-phone row before and after each run (clean DB).
 *
 * Both ops require service-role access (RLS protects messages + contacts).
 * The legacy service-role JWT was deprecated in the 2026-04-23 rotation —
 * so this edge function wraps the operations and gates them with
 * BPP_BRAIN_TOKEN (already in supabase secrets + ~/.claude/credentials.md).
 *
 * Auth: x-bpp-brain-token header (timing-safe equality).
 *
 * Endpoints (POST):
 *   { action: 'messages', phone: '+1800555XXXX' }
 *     → { contact_id, messages: [{ id, direction, body, sender, created_at }] }
 *
 *   { action: 'reset', phone: '+1800555XXXX' }
 *     → { ok: true, deleted: { messages, sessions, contacts } }
 *
 * Hard-gated to `+1800555` prefix so an attacker with the brain token can't
 * use this endpoint to wipe real customer data. The 800-555 NANP fictional
 * range is reserved for testing — no real customer ever has that prefix.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { timingSafeEqual, allowRate } from '../_shared/auth.ts'

// Internal-only — brain-token-gated, +1800555 prefix hard-gate, tightened per F15.
const CORS = {
  'Access-Control-Allow-Origin': 'https://backuppowerpro.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-bpp-brain-token',
}

// Hard guard: only operate on the 800-555 NANP test range. Prevents this
// endpoint from being weaponized against real customer data even if the
// brain token leaks.
const TEST_PHONE_PREFIX = '+1800555'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST')   return new Response(JSON.stringify({ error: 'method' }), { status: 405, headers: CORS })

  const BRAIN_TOKEN = Deno.env.get('BPP_BRAIN_TOKEN') || ''
  const sentToken = req.headers.get('x-bpp-brain-token') || ''
  if (!BRAIN_TOKEN || !timingSafeEqual(sentToken, BRAIN_TOKEN)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  // Per-IP rate limit — dojo runs ~26 calls/min, so 60/min/IP is generous.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!allowRate(`dojo-helper:${ip}`, 60)) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  let body: any
  try { body = await req.json() } catch { return new Response(JSON.stringify({ error: 'json' }), { status: 400, headers: CORS }) }

  const action: string = body?.action || ''
  const phone: string = String(body?.phone || '')

  // v10.1.54 (2026-05-08 iMessage Tyler-test prep): allow Key's own cell
  // ONLY for the reset_bot_state action. Lets us reset Key's contact's
  // bot_state cleanly between persona-test conversations without nuking
  // his real contact data. Hard-gated to that one phone + that one
  // action; other actions still require the +1800555 test range.
  const KEY_CELL = '+19414417996'
  const KEY_ALLOWED_ACTIONS = new Set(['reset_bot_state', 'messages', 'inspect_contact', 'simulate_inbound'])
  const isKeyAllowedAction = phone === KEY_CELL && KEY_ALLOWED_ACTIONS.has(action)
  // v10.1.59: also allow inspect_contact for test phones (already-allowed
  // actions). Useful for debugging stage advancement etc.
  const isTestInspect = phone.startsWith(TEST_PHONE_PREFIX) && action === 'inspect_contact'

  if (!phone.startsWith(TEST_PHONE_PREFIX) && !isKeyAllowedAction) {
    return new Response(JSON.stringify({ error: 'phone outside test range' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  if (action === 'session') {
    // Return alex_sessions.messages JSON (the LLM conversation history,
    // NOT the CRM messages table). Useful for debugging tool_use/tool_result
    // pairing issues.
    const { data: sess } = await sb.from('alex_sessions').select('messages').eq('phone', phone).limit(1)
    return new Response(JSON.stringify({
      phone,
      messages: sess?.[0]?.messages || [],
    }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  if (action === 'messages') {
    // Resolve contact id by phone, then return all messages for it
    const { data: contacts } = await sb.from('contacts').select('id').eq('phone', phone).limit(1)
    const contactId = contacts?.[0]?.id || null
    if (!contactId) {
      return new Response(JSON.stringify({ contact_id: null, messages: [] }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }
    const { data: msgs } = await sb
      .from('messages')
      .select('id, direction, body, sender, created_at')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: true })
    return new Response(JSON.stringify({ contact_id: contactId, messages: msgs || [] }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  if (action === 'reset') {
    // Delete every row tied to this test phone. Order matters — children first.
    const { data: contacts } = await sb.from('contacts').select('id').eq('phone', phone)
    const contactIds = (contacts || []).map((c: any) => c.id)
    let messagesDel = 0, queueDel = 0, consentDel = 0, sessionsDel = 0, memoryDel = 0, contactsDel = 0

    if (contactIds.length > 0) {
      const { count: m1 } = await sb.from('messages').delete({ count: 'exact' }).in('contact_id', contactIds)
      messagesDel = m1 || 0
      const { count: m2 } = await sb.from('follow_up_queue').delete({ count: 'exact' }).in('contact_id', contactIds)
      queueDel = m2 || 0
      const { count: m3 } = await sb.from('sms_consent_log').delete({ count: 'exact' }).in('contact_id', contactIds)
      consentDel = m3 || 0
    }
    const { count: m4 } = await sb.from('alex_sessions').delete({ count: 'exact' }).eq('phone', phone)
    sessionsDel = m4 || 0
    const { count: m5 } = await sb.from('sparky_memory').delete({ count: 'exact' }).like('key', `contact:${phone}:%`)
    memoryDel = m5 || 0
    const { count: m6 } = await sb.from('contacts').delete({ count: 'exact' }).eq('phone', phone)
    contactsDel = m6 || 0

    return new Response(JSON.stringify({
      ok: true,
      deleted: { messages: messagesDel, queue: queueDel, consent: consentDel, sessions: sessionsDel, memory: memoryDel, contacts: contactsDel },
    }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  // v10.1.54: inspect_contact — read the contact's bot-related fields
  // for debugging routing issues (why didn't Ashley respond?).
  if (action === 'inspect_contact') {
    const { data: c } = await sb.from('contacts')
      .select('id, name, phone, bot_state, bot_disabled, do_not_contact, ai_enabled, ai_paused_until, paused_at_state, qualification_data, last_bot_inbound_at, last_bot_outbound_at, stage, created_at')
      .eq('phone', phone)
      .maybeSingle()
    return new Response(JSON.stringify({ ok: true, contact: c }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  // v10.1.54 (2026-05-08): reset_bot_state — surgical reset of bot_state
  // + qualification_data without deleting the contact. Used for the
  // iMessage Tyler test on Key's phone so we can run multiple persona
  // scenarios from the same number without losing his real contact data
  // (name, email, address etc).
  if (action === 'reset_bot_state') {
    const initialState = String(body?.initial_state || 'AWAIT_240V')
    const { data: contacts0 } = await sb.from('contacts').select('id').eq('phone', phone).limit(1)
    const contactId0 = contacts0?.[0]?.id
    if (!contactId0) {
      return new Response(JSON.stringify({ error: 'contact not found for that phone' }), { status: 404, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }
    const { error: upErr } = await sb.from('contacts').update({
      bot_state: initialState,
      bot_disabled: false,
      do_not_contact: false,  // v10.1.55: also clear DNC for re-test cycles
      qualification_data: {},
      paused_at_state: null,
    }).eq('id', contactId0)
    if (upErr) {
      return new Response(JSON.stringify({ error: upErr.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }
    return new Response(JSON.stringify({ ok: true, contact_id: contactId0, reset_to_state: initialState }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  // v10.1.48 (2026-05-07): real-LLM Ashley dojo. Lets a runner simulate a
  // customer end-to-end against bot-engine using REAL classifier + phraser
  // LLM calls (not just orchestrator-agent prompt simulation). Hard-gated
  // to +1800555 prefix, brain-token auth, runner stays in edge function so
  // service-role JWT never leaves the server.
  if (action === 'init_contact') {
    const name = String(body?.name || 'Dojo Tester')
    const initialState = String(body?.initial_state || 'AWAIT_240V')
    const { data: existing } = await sb.from('contacts').select('id').eq('phone', phone).limit(1)
    if (existing?.[0]?.id) {
      return new Response(JSON.stringify({ error: 'contact exists, reset first' }), { status: 409, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }
    const { data: created, error } = await sb.from('contacts').insert({
      phone, name, stage: 1, bot_state: initialState,
      ai_enabled: true, do_not_contact: false, qualification_data: {},
    }).select().single()
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }
    return new Response(JSON.stringify({ ok: true, contact: created }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  if (action === 'simulate_inbound') {
    const inboundBody = String(body?.body || '')
    const mediaUrls: string[] | undefined = Array.isArray(body?.media_urls) ? body.media_urls : undefined
    if (!inboundBody && (!mediaUrls || mediaUrls.length === 0)) {
      return new Response(JSON.stringify({ error: 'body or media_urls required' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }
    const { data: contacts2 } = await sb.from('contacts').select('id').eq('phone', phone).limit(1)
    const contactId = contacts2?.[0]?.id
    if (!contactId) {
      return new Response(JSON.stringify({ error: 'no contact for this phone, init_contact first' }), { status: 404, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }
    const messageSid = `dojo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    await sb.from('messages').insert({
      contact_id: contactId,
      direction: 'inbound',
      body: inboundBody || (mediaUrls ? `[media:${mediaUrls[0]}]` : ''),
      sender: 'lead',
      twilio_sid: messageSid,
      status: 'received',
    })
    const SUPABASE_URL_LOCAL = Deno.env.get('SUPABASE_URL') || ''
    const SR_KEY_LOCAL = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    let botResp: any = null
    let botStatus = 0
    try {
      // Some Supabase deployments require BOTH apikey + Authorization for
      // edge-to-edge calls. Send both with service-role JWT.
      const r = await fetch(`${SUPABASE_URL_LOCAL}/functions/v1/bot-engine`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SR_KEY_LOCAL}`,
          'apikey': SR_KEY_LOCAL,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trigger: 'inbound_message',
          contact_id: contactId,
          message_sid: messageSid,
          message_body: inboundBody,
          media_urls: mediaUrls,
        }),
      })
      botStatus = r.status
      botResp = await r.json().catch(() => ({}))
    } catch (e: any) {
      return new Response(JSON.stringify({ error: 'bot-engine fetch failed', detail: String(e?.message || e) }), { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }
    const { data: latestOut } = await sb
      .from('messages')
      .select('id, direction, body, sender, created_at')
      .eq('contact_id', contactId)
      .eq('direction', 'outbound')
      .order('created_at', { ascending: false })
      .limit(1)
    return new Response(JSON.stringify({
      ok: true, contact_id: contactId, message_sid: messageSid,
      bot_status: botStatus, bot_response: botResp,
      latest_outbound: latestOut?.[0] || null,
    }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  // simulate_v2: same as simulate_inbound but routes through ashley-v2 (unified engine).
  // Hard-gated to test phones + Key's cell. Use this to compare v1 vs v2 side-by-side.
  if (action === 'simulate_v2') {
    const inboundBody = String(body?.body || '')
    const mediaUrls: string[] | undefined = Array.isArray(body?.media_urls) ? body.media_urls : undefined
    if (!inboundBody && (!mediaUrls || mediaUrls.length === 0)) {
      return new Response(JSON.stringify({ error: 'body or media_urls required' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }
    const { data: contacts3 } = await sb.from('contacts').select('id').eq('phone', phone).limit(1)
    const contactId = contacts3?.[0]?.id
    if (!contactId) {
      return new Response(JSON.stringify({ error: 'no contact for this phone, init_contact first' }), { status: 404, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }
    // Write the inbound message to DB so ashley-v2 sees it in conversation history
    const messageSid = `dojo-v2-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    await sb.from('messages').insert({
      contact_id: contactId,
      direction: 'inbound',
      body: inboundBody || (mediaUrls ? `[media:${mediaUrls[0]}]` : ''),
      sender: 'lead',
      twilio_sid: messageSid,
      status: 'received',
    })
    const SUPABASE_URL_LOCAL = Deno.env.get('SUPABASE_URL') || ''
    const SR_KEY_LOCAL = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    let botResp: any = null
    let botStatus = 0
    try {
      const r = await fetch(`${SUPABASE_URL_LOCAL}/functions/v1/ashley-v2`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SR_KEY_LOCAL}`,
          'apikey': SR_KEY_LOCAL,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contact_id: contactId,
          message_body: inboundBody,
          media_urls: mediaUrls,
          dojo_mode: true,  // skip real SMS send
        }),
      })
      botStatus = r.status
      botResp = await r.json().catch(() => ({}))
    } catch (e: any) {
      return new Response(JSON.stringify({ error: 'ashley-v2 fetch failed', detail: String(e?.message || e) }), { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }
    const { data: latestOutV2 } = await sb
      .from('messages')
      .select('id, direction, body, sender, created_at')
      .eq('contact_id', contactId)
      .eq('direction', 'outbound')
      .order('created_at', { ascending: false })
      .limit(1)
    return new Response(JSON.stringify({
      ok: true, contact_id: contactId, message_sid: messageSid,
      bot_status: botStatus, bot_response: botResp,
      latest_outbound: latestOutV2?.[0] || null,
    }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  return new Response(JSON.stringify({ error: 'unknown action' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })
})
