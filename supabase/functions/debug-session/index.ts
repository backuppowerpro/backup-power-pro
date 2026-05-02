/**
 * debug-session — Diagnostic dump of alex_sessions + contacts + recent messages
 * for any phone (gated by brain token).
 *
 * Built 2026-04-29 to help debug why Alex isn't responding past the opener
 * during Key's manual testing. Reveals key gate flags:
 *   - alex_active (must be true for Alex to reply)
 *   - key_active (set true when Key takes over via OpenPhone app — blocks Alex)
 *   - opted_out (set true when customer texts STOP)
 *   - status (active/reset)
 *   - last_outbound_at, customer_last_msg_at
 *
 * Auth: brain token only (server-to-server / Claude debugging).
 *
 * GET /debug-session?phone=+18648635678
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { timingSafeEqual } from '../_shared/auth.ts'

// Internal-only — brain-token-gated, tightened per F15.
const CORS = {
  'Access-Control-Allow-Origin': 'https://backuppowerpro.com',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-bpp-brain-token',
}

function normalizePhone(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return raw.startsWith('+') ? raw : raw
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  const brainHdr = req.headers.get('x-bpp-brain-token') || ''
  const BRAIN = Deno.env.get('BPP_BRAIN_TOKEN') || ''
  if (!BRAIN || !timingSafeEqual(brainHdr, BRAIN)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const url = new URL(req.url)
  const phoneRaw = url.searchParams.get('phone') || ''
  const phone = normalizePhone(phoneRaw)
  if (!phone) {
    return new Response(JSON.stringify({ error: 'missing phone' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Pull contact, alex_sessions, and last 20 messages
  const [{ data: contacts }, { data: sessions }, { data: dedup }] = await Promise.all([
    sb.from('contacts')
      .select('id, name, phone, email, stage, status, do_not_contact, ai_enabled, ai_paused_until, created_at')
      .eq('phone', phone)
      .limit(5),
    sb.from('alex_sessions')
      .select('session_id, phone, status, alex_active, key_active, key_last_active_at, opted_out, customer_last_msg_at, last_outbound_at, created_at, notify_key_count')
      .eq('phone', phone)
      .order('created_at', { ascending: false })
      .limit(5),
    sb.from('alex_dedup')
      .select('message_id, created_at')
      .like('message_id', `%${phone.slice(-10)}%`)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  let messages: any[] = []
  const contactId = contacts?.[0]?.id
  if (contactId) {
    const { data: msgs } = await sb.from('messages')
      .select('id, direction, body, sender, sender_phone, status, quo_message_id, created_at')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(20)
    messages = (msgs || []).reverse() // chronological
  }

  // Diagnose: what's blocking Alex from replying?
  const session = sessions?.[0]
  const diagnoses: string[] = []
  if (!contacts?.length) diagnoses.push('NO_CONTACT_ROW: contact does not exist for this phone — form was never submitted or contact was hard-deleted')
  if (contacts?.[0]?.do_not_contact) diagnoses.push('DNC: contact has do_not_contact=true — outbound blocked')
  if (contacts?.[0]?.ai_enabled === false) diagnoses.push('AI_DISABLED: contacts.ai_enabled=false — Alex disabled for this contact')
  if (contacts?.[0]?.ai_paused_until && new Date(contacts[0].ai_paused_until).getTime() > Date.now()) diagnoses.push('AI_PAUSED: contacts.ai_paused_until is in the future')
  if (!session) diagnoses.push('NO_SESSION: alex_sessions row does not exist')
  if (session?.status === 'reset') diagnoses.push('SESSION_RESET: most recent session has status=reset — next inbound creates fresh session')
  if (session?.alex_active === false) diagnoses.push('ALEX_INACTIVE: session.alex_active=false')
  if (session?.key_active === true) diagnoses.push('KEY_ACTIVE: session marked key_active=true (Key sent from OpenPhone app at some point — Alex stands down). Reset session to fix.')
  if (session?.opted_out) diagnoses.push('OPTED_OUT: customer texted STOP — Alex blocked')

  const lastInbound = (messages || []).filter((m: any) => m.direction === 'inbound').slice(-1)[0]
  const lastOutbound = (messages || []).filter((m: any) => m.direction === 'outbound').slice(-1)[0]

  return new Response(JSON.stringify({
    phone,
    diagnoses,
    likely_cause: diagnoses[0] || 'No obvious blocker found in DB state. Check function logs for 401/4xx on inbound webhook.',
    contacts,
    sessions,
    last_inbound: lastInbound ? {
      direction: lastInbound.direction,
      body: lastInbound.body?.slice(0, 200),
      created_at: lastInbound.created_at,
      sender: lastInbound.sender,
      status: lastInbound.status,
    } : null,
    last_outbound: lastOutbound ? {
      direction: lastOutbound.direction,
      body: lastOutbound.body?.slice(0, 200),
      created_at: lastOutbound.created_at,
      sender: lastOutbound.sender,
      status: lastOutbound.status,
    } : null,
    message_count: messages.length,
    all_messages: messages.map((m: any) => ({
      ts: m.created_at,
      dir: m.direction,
      sender: m.sender,
      status: m.status,
      quo_id: m.quo_message_id,
      body: (m.body || '').slice(0, 500),
    })),
    recent_dedup_keys: dedup,
  }, null, 2), {
    status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
