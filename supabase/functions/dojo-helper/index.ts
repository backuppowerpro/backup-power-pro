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

const CORS = {
  'Access-Control-Allow-Origin': '*',
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

  if (!phone.startsWith(TEST_PHONE_PREFIX)) {
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

  return new Response(JSON.stringify({ error: 'unknown action' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })
})
