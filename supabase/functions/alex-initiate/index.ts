/**
 * alex-initiate — proactive first contact after form submission
 *
 * Call this whenever a new BPP lead is created (Meta Lead Ads webhook,
 * web form, CRM contact creation, or manual trigger).
 *
 * POST body: { phone: string, name?: string, source?: string }
 * Auth:      Authorization: Bearer <service_role_key>
 *
 * Idempotent — won't double-text a lead that already has an active session.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const QUO_API_KEY       = Deno.env.get('QUO_API_KEY')!
const QUO_PHONE_ID      = Deno.env.get('QUO_PHONE_NUMBER_ID')!

const MODEL      = 'claude-opus-4-6'
const MAX_TOKENS = 250

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// ── Opener generation ─────────────────────────────────────────────────────────

async function generateOpener(firstName: string): Promise<string> {
  const namePart = firstName ? ` ${firstName}` : ''

  const prompt = `You are Alex, an assistant for Backup Power Pro (generator connection installation in Upstate SC).

A new customer${firstName ? ` named ${firstName}` : ''} just submitted a form asking about getting a generator connected to their home's electrical panel.

Write the first SMS you will send them. Introduce yourself as Alex with Backup Power Pro. Say you are here to help get their quote started. Ask them to send a photo of their electrical panel with the door open so Key, the electrician, can take a look.

Rules:
- Warm, natural, personal. Not corporate.
- Use their first name once if you have it (${firstName || 'not known'}).
- Two to three sentences max.
- Under 280 characters.
- No em dashes, no emoji, no bold, no markdown.
- Do not start with "Hi${namePart}!" — that is too template-like. Find a natural opening.
- Sound like a real person who is genuinely happy to help.

Return ONLY the SMS message text.`

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!resp.ok) throw new Error(`Claude error: ${resp.status}`)
  const data = await resp.json()
  return data.content?.[0]?.text?.trim() || `Hey${firstName ? ' ' + firstName : ''}, this is Alex with Backup Power Pro. I saw you were interested in getting a generator connected. To get Key started on your quote, could you send a photo of your electrical panel with the door open?`
}

function cleanSms(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/\u2014/g, ',').replace(/\u2013/g, '-').trim()
}

async function sendSms(to: string, content: string): Promise<boolean> {
  const resp = await fetch('https://api.openphone.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: QUO_API_KEY },
    body: JSON.stringify({ from: QUO_PHONE_ID, to: [to], content }),
  })
  if (!resp.ok) console.error('[initiate] Quo send failed:', resp.status, await resp.text())
  return resp.ok
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: CORS })

  let body: any
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400, headers: CORS })
  }

  const rawPhone: string = body?.phone || ''
  const name: string = (body?.name || '').trim()
  const source: string = body?.source || 'unknown'

  if (!rawPhone) {
    return new Response(JSON.stringify({ error: 'phone required' }), { status: 400, headers: CORS })
  }

  // Normalize phone to E.164
  const digits = rawPhone.replace(/\D/g, '')
  const phone = digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith('1') ? `+${digits}` : rawPhone

  console.log('[initiate] Lead from', source, '— phone:', phone, '— name:', name || '(unknown)')

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // ── Idempotency check ─────────────────────────────────────────────────────
  // Don't double-text a lead that already has an active session
  const { data: existing } = await db
    .from('alex_sessions')
    .select('session_id, status')
    .eq('phone', phone)
    .eq('status', 'active')
    .limit(1)

  if (existing?.length) {
    console.log('[initiate] Active session already exists for', phone, '— skipping')
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'active_session_exists' }), {
      status: 200, headers: CORS,
    })
  }

  // ── Opt-out check ─────────────────────────────────────────────────────────
  const { data: optedOut } = await db
    .from('alex_sessions')
    .select('session_id')
    .eq('phone', phone)
    .eq('opted_out', true)
    .limit(1)

  if (optedOut?.length) {
    console.log('[initiate] Opted-out lead, not texting:', phone)
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'opted_out' }), {
      status: 200, headers: CORS,
    })
  }

  // ── Create session ────────────────────────────────────────────────────────
  const sessionId = crypto.randomUUID()
  await db.from('alex_sessions').insert({
    phone,
    session_id: sessionId,
    status: 'active',
    messages: [],
    alex_active: true,
    key_active: false,
    followup_count: 0,
  })

  // ── Generate and send opener ──────────────────────────────────────────────
  const firstName = name.split(' ')[0] || ''

  let openerText: string
  try {
    openerText = cleanSms(await generateOpener(firstName))
  } catch (err) {
    console.error('[initiate] Opener generation failed:', err)
    openerText = `Hey${firstName ? ' ' + firstName : ''}, this is Alex with Backup Power Pro. I can help get Key started on your quote. Could you send a photo of your electrical panel with the door open?`
  }

  const sent = await sendSms(phone, openerText)
  if (!sent) {
    // Clean up session so it can be retried
    await db.from('alex_sessions').delete().eq('session_id', sessionId)
    return new Response(JSON.stringify({ error: 'SMS send failed' }), { status: 500, headers: CORS })
  }

  // Save opener to session history
  await db
    .from('alex_sessions')
    .update({
      messages: [{ role: 'assistant', content: openerText }],
      last_outbound_at: new Date().toISOString(),
    })
    .eq('session_id', sessionId)

  // Also save name to sparky_memory if provided
  if (name) {
    await db.from('sparky_memory').upsert(
      { key: `contact:${phone}:name`, value: name, category: 'contact', importance: 3 },
      { onConflict: 'key' },
    )
  }

  console.log('[initiate] Opener sent to', phone, '— session:', sessionId)
  return new Response(JSON.stringify({ ok: true, sessionId }), { status: 200, headers: CORS })
})
