/**
 * alex-debug-key — TEMPORARY diagnostic for the RETEST silence Apr 27.
 *
 * Returns the last 10 messages, last 3 alex_sessions, and contact row for
 * KEY_PHONE (+19414417996). Brain-token gated.
 *
 * DELETE THIS FUNCTION after RETEST is verified working.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { timingSafeEqual } from '../_shared/auth.ts'

const KEY_PHONE = '+19414417996'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-bpp-brain-token',
}

const json = (status: number, body: unknown) => new Response(
  JSON.stringify(body, null, 2),
  { status, headers: { ...CORS, 'Content-Type': 'application/json' } },
)

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  const BRAIN = Deno.env.get('BPP_BRAIN_TOKEN') || ''
  const sent = req.headers.get('x-bpp-brain-token') || ''
  if (!BRAIN || !timingSafeEqual(sent, BRAIN)) return json(401, { error: 'unauthorized' })

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const last10 = '%' + KEY_PHONE.slice(-10) + '%'

  const { data: contact } = await sb
    .from('contacts')
    .select('id, name, phone, stage, status, ai_enabled, ai_paused_until, do_not_contact, notes')
    .ilike('phone', last10)
    .maybeSingle()

  // Recent messages on this contact
  const { data: messages } = contact?.id ? await sb
    .from('messages')
    .select('id, created_at, direction, body, sender, status, quo_message_id')
    .eq('contact_id', contact.id)
    .order('created_at', { ascending: false })
    .limit(10) : { data: null }

  // Recent alex_sessions for this phone
  const { data: sessions } = await sb
    .from('alex_sessions')
    .select('session_id, phone, status, alex_active, key_active, created_at, updated_at, messages')
    .ilike('phone', last10)
    .order('updated_at', { ascending: false })
    .limit(3)

  // Env diagnostics — what mode is alex-agent running in?
  const env = {
    ALEX_TEST_MODE: Deno.env.get('ALEX_TEST_MODE') || '(unset)',
    QUO_WEBHOOK_SECRET_set: !!Deno.env.get('QUO_WEBHOOK_SECRET'),
    QUO_API_KEY_set: !!Deno.env.get('QUO_API_KEY'),
    QUO_PHONE_NUMBER_ID: Deno.env.get('QUO_PHONE_NUMBER_ID') || '(unset)',
    QUO_INTERNAL_PHONE_ID: Deno.env.get('QUO_INTERNAL_PHONE_ID') || '(unset)',
    ANTHROPIC_API_KEY_set: !!Deno.env.get('ANTHROPIC_API_KEY'),
    SUPABASE_SERVICE_ROLE_KEY_set: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    TWILIO_AUTH_TOKEN_set: !!Deno.env.get('TWILIO_AUTH_TOKEN'),
    ALEX_TEST_ALLOWLIST: Deno.env.get('ALEX_TEST_ALLOWLIST') || '(unset)',
  }

  // Ping test — fire a synthetic RETEST through alex-agent ourselves to
  // confirm the auth + RETEST handler chain works independent of OpenPhone.
  let pingResult: any = null
  if (new URL(req.url).searchParams.get('ping') === '1') {
    try {
      const resp = await fetch(
        `${Deno.env.get('SUPABASE_URL')!}/functions/v1/alex-agent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}`,
          },
          body: JSON.stringify({
            type: 'message.received',
            data: {
              object: {
                from: KEY_PHONE,
                to: ['+18644005302'],
                body: 'RETEST',
                id: `debug-ping-${Date.now()}`,
                createdAt: new Date().toISOString(),
              },
            },
          }),
        },
      )
      const txt = await resp.text()
      pingResult = { status: resp.status, body: txt.slice(0, 400) }
    } catch (e: any) {
      pingResult = { error: String(e?.message || e).slice(0, 200) }
    }
  }

  return json(200, {
    now: new Date().toISOString(),
    KEY_PHONE,
    contact,
    messages: messages?.map(m => ({
      ...m,
      body: typeof m.body === 'string' ? m.body.slice(0, 120) : m.body,
    })),
    sessions: sessions?.map(s => ({
      session_id: s.session_id,
      phone: s.phone,
      status: s.status,
      alex_active: s.alex_active,
      key_active: s.key_active,
      created_at: s.created_at,
      updated_at: s.updated_at,
      message_count: Array.isArray(s.messages) ? s.messages.length : 0,
      last_message: Array.isArray(s.messages) ? s.messages[s.messages.length - 1] : null,
    })),
    env,
    pingResult,
  })
})
