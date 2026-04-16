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
 *
 * A/B TESTING: Randomly assigns each lead to an opener variant and tracks
 * response rates. GET /alex-initiate?report=true returns current results.
 *
 * Variants:
 *   A — Warm greeting only (no ask). Photo request comes when they reply.
 *   B — Two-text pattern: greeting, then ask 10s later. (Research: +44% responses)
 *   C — Single message with negative-frame ask.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const QUO_API_KEY  = Deno.env.get('QUO_API_KEY')!
const QUO_PHONE_ID = Deno.env.get('QUO_PHONE_NUMBER_ID')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// ── A/B Test Opener Templates ────────────────────────────────────────────────
// Pre-written. No AI generation = faster, cheaper, consistent, measurable.

type Variant = 'A' | 'B' | 'C'

function getOpenerMessages(variant: Variant, firstName: string): string[] {
  const name = firstName || ''
  const hi = name ? `Hey ${name}` : 'Hey'

  switch (variant) {
    case 'A':
      // Warm greeting only — no ask. Photo request comes naturally when they reply.
      return [
        `${hi}, this is Alex with Backup Power Pro. Appreciate you reaching out, happy to help get things started.`,
      ]

    case 'B':
      // Two-text pattern: greeting, then ask 10s later.
      return [
        `${hi}, this is Alex with Backup Power Pro. Appreciate you reaching out.`,
        `Whenever you get a chance, would it be a problem to snap a photo of your electrical panel with the door open? That is all Key, our electrician, needs to get your quote started.`,
      ]

    case 'C':
      // Single message with negative-frame ask.
      return [
        `${hi}, this is Alex with Backup Power Pro. Thanks for filling out the form. Would it be a problem to send over a photo of your electrical panel when you get a chance? That is all Key, our electrician, needs to put a quote together.`,
      ]
  }
}

function pickVariant(): Variant {
  // Weighted: 60% B (Key's pick — two-text pattern), 20% A, 20% C for comparison
  const r = Math.random()
  if (r < 0.20) return 'A'
  if (r < 0.40) return 'C'
  return 'B'
}

// ── SMS sender ───────────────────────────────────────────────────────────────

async function sendSms(to: string, content: string): Promise<boolean> {
  try {
    const resp = await fetch('https://api.openphone.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: QUO_API_KEY },
      body: JSON.stringify({ from: QUO_PHONE_ID, to: [to], content }),
    })
    if (!resp.ok) {
      console.error('[initiate] Quo send failed:', resp.status, await resp.text().catch(() => ''))
      return false
    }
    return true
  } catch (err) {
    console.error('[initiate] Quo send error:', err)
    return false
  }
}

// ── A/B Report ───────────────────────────────────────────────────────────────

async function generateReport(db: any): Promise<string> {
  // Count sessions per variant
  const { data: sessions } = await db
    .from('alex_sessions')
    .select('session_id, summary, messages, status, created_at')
    .not('summary', 'is', null)
    .like('summary', 'variant:%')

  // Also count sessions that have opener_variant in summary field
  const { data: allSessions } = await db
    .from('alex_sessions')
    .select('session_id, summary, messages, status, customer_last_msg_at, photo_received, created_at')
    .not('summary', 'is', null)

  const variants: Record<string, { sent: number; replied: number; photoReceived: number; completed: number }> = {
    A: { sent: 0, replied: 0, photoReceived: 0, completed: 0 },
    B: { sent: 0, replied: 0, photoReceived: 0, completed: 0 },
    C: { sent: 0, replied: 0, photoReceived: 0, completed: 0 },
  }

  for (const s of allSessions || []) {
    const match = (s.summary || '').match(/^variant:([ABC])/)
    if (!match) continue
    const v = match[1] as Variant
    variants[v].sent++
    // Check if customer replied (has user messages beyond internal triggers)
    const userMsgs = (s.messages || []).filter((m: any) =>
      m.role === 'user' && typeof m.content === 'string' && !m.content.startsWith('[INTERNAL')
    )
    if (userMsgs.length > 0 || s.customer_last_msg_at) variants[v].replied++
    if (s.photo_received) variants[v].photoReceived++
    if (s.status === 'complete') variants[v].completed++
  }

  const lines = [
    'ALEX OPENER A/B TEST RESULTS',
    `Report generated: ${new Date().toISOString().split('T')[0]}`,
    '',
    'Variant | Sent | Replied | Rate | Photos | Completed',
    '--------|------|---------|------|--------|----------',
  ]

  for (const [v, d] of Object.entries(variants)) {
    const rate = d.sent > 0 ? ((d.replied / d.sent) * 100).toFixed(1) + '%' : 'n/a'
    lines.push(`${v}       | ${d.sent.toString().padStart(4)} | ${d.replied.toString().padStart(7)} | ${rate.padStart(4)} | ${d.photoReceived.toString().padStart(6)} | ${d.completed}`)
  }

  lines.push('')
  lines.push('Variant A: Warm greeting only (no photo ask)')
  lines.push('Variant B: Two-text pattern (greeting + ask 10s later)')
  lines.push('Variant C: Single message with negative-frame ask')

  return lines.join('\n')
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  // GET — A/B test report
  if (req.method === 'GET') {
    const url = new URL(req.url)
    if (url.searchParams.get('report') === 'true') {
      const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
      const report = await generateReport(db)
      return new Response(report, { status: 200, headers: { ...CORS, 'Content-Type': 'text/plain' } })
    }
    return new Response(JSON.stringify({ ok: true, service: 'alex-initiate', ab_test: true }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

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

  console.log('[initiate] Lead from', source, '— phone:', phone)

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // ── Idempotency check ─────────────────────────────────────────────────────
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

  // ── Pick A/B variant and create session ───────────────────────────────────
  const variant = pickVariant()
  const sessionId = crypto.randomUUID()
  await db.from('alex_sessions').insert({
    phone,
    session_id: sessionId,
    status: 'active',
    messages: [],
    alex_active: true,
    key_active: false,
    followup_count: 0,
    photo_received: false,
    opted_out: false,
    summary: `variant:${variant}`,  // Track which opener was used
  })

  // ── Send opener(s) ────────────────────────────────────────────────────────
  const firstName = name.split(' ')[0] || ''
  const openerTexts = getOpenerMessages(variant, firstName)

  const allMessages: any[] = []
  let firstSendFailed = false

  for (let i = 0; i < openerTexts.length; i++) {
    const text = openerTexts[i]

    // For two-text pattern (variant B), wait 10s between messages
    if (i > 0) {
      await new Promise(r => setTimeout(r, 8000 + Math.floor(Math.random() * 4000)))  // 8-12s
    }

    const sent = await sendSms(phone, text)
    if (!sent) {
      if (i === 0) {
        firstSendFailed = true
        break
      }
      // If second text fails, log but continue — first one went through
      console.error('[initiate] Second SMS failed for', phone)
      break
    }
    allMessages.push({ role: 'assistant', content: text })
  }

  if (firstSendFailed) {
    // Clean up session so it can be retried
    await db.from('alex_sessions').delete().eq('session_id', sessionId)
    return new Response(JSON.stringify({ error: 'SMS send failed' }), { status: 500, headers: CORS })
  }

  // Save opener(s) to session history
  await db
    .from('alex_sessions')
    .update({
      messages: allMessages,
      last_outbound_at: new Date().toISOString(),
    })
    .eq('session_id', sessionId)

  // Save name to sparky_memory if provided
  if (name) {
    await db.from('sparky_memory').upsert(
      { key: `contact:${phone}:name`, value: name, category: 'contact', importance: 3 },
      { onConflict: 'key' },
    )
  }

  console.log(`[initiate] Variant ${variant} sent to ${phone} — session: ${sessionId}`)
  return new Response(JSON.stringify({ ok: true, sessionId, variant }), { status: 200, headers: CORS })
})
