/**
 * sparky-daily-digest — end-of-day Alex recap for Key.
 *
 * Runs once per day (cron at 8pm ET = 00:00 UTC). Queries the last 24 hours
 * of Alex activity and Sparky's learning writes, then hands that to Claude
 * to produce a short, readable digest. Sends to Key's cell via Twilio.
 *
 * Structure of the digest (what Claude composes):
 *   1. Headline — the one thing that mattered today
 *   2. New conversations Alex started (count + who)
 *   3. Mark-completes (bookings / stage changes Alex confirmed)
 *   4. Cold sweeps (leads Alex gave up on)
 *   5. Takeovers (where Key had to manually step in — these are training signals)
 *   6. Memory updates (what Alex/Sparky learned today)
 *   7. What to check tomorrow (1-2 concrete actions for Key)
 *
 * Keep it under 1400 chars so it fits in a single multi-part SMS without being
 * 8 segments long. Cron pings this function via pg_net; we only send if there
 * is non-trivial activity to report (i.e., Alex actually did something).
 *
 * GET or POST — service-role gated.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireServiceRole } from '../_shared/auth.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
}

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const TWILIO_SID    = Deno.env.get('TWILIO_ACCOUNT_SID')!
const TWILIO_TOKEN  = Deno.env.get('TWILIO_AUTH_TOKEN')!
const TWILIO_FROM   = '+18648637800'
const KEY_CELL      = '+19414417996'
const MODEL         = 'claude-sonnet-4-5' // summarization, cheap

const SYSTEM_PROMPT = `You are Sparky writing a nightly recap for Key — the owner of Backup Power Pro.
Your job: read today's raw Alex activity and produce a short SMS that Key will actually read on his phone.

Style:
- Direct, grounded, no fluff. Not a corporate "summary". You're his chief of staff, not a press release.
- Under 1200 characters. Every character counts on SMS.
- Plain text. No markdown, no bullets with dashes longer than needed, no emoji spam (one 🔑 or ⚡ is fine if it helps, never more than two).
- Honest about what didn't work. If nothing notable happened, say so in 1-2 lines.

Structure (only include sections that have content):
HEADLINE — the one line that matters most today.
NEW — how many new conversations Alex started, one-line texture if interesting.
CLOSED — bookings / mark_completes, name-less (use "a Mauldin homeowner" or "a Generac lead", no PII).
TAKEOVERS — if Key had to step in, note how many; these are training signals.
COLD — if any leads went cold, count only.
LEARNED — if Alex/Sparky wrote anything durable to /memories/, paraphrase the one most useful learning (don't quote verbatim).
TOMORROW — 1-2 concrete things Key should check or follow up on.

HARD RULES:
- NO customer names, phone numbers, street addresses, or exact prices.
- NO emojis except possibly 🔑 or ⚡ used once total.
- If the data is thin, send a thin digest. Don't pad.
- If there's literally nothing worth saying, reply exactly "QUIET DAY" and nothing else — the caller will skip the send.`

async function sendSms(to: string, body: string): Promise<boolean> {
  const creds = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)
  const form = new URLSearchParams({ From: TWILIO_FROM, To: to, Body: body })
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: 'POST',
      headers: { 'Authorization': `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    }
  )
  if (!res.ok) {
    console.error('[daily-digest] sms send failed', res.status, await res.text())
    return false
  }
  return true
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  const gate = requireServiceRole(req); if (gate) return gate

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // ── Window: last 24h anchored on "today in Eastern" ──────────────────────
  const now = new Date()
  const since = new Date(now.getTime() - 24 * 3600 * 1000)
  const sinceIso = since.toISOString()

  // ── Gather raw signals ───────────────────────────────────────────────────

  // 1. Sessions that saw customer activity in the last 24h.
  const { data: activeSessions } = await sb
    .from('alex_sessions')
    .select('session_id, phone, status, customer_last_msg_at, last_outbound_at, followup_count, photo_received, summary')
    .gt('customer_last_msg_at', sinceIso)
    .order('customer_last_msg_at', { ascending: false })
    .limit(50)

  // 2. Sessions CREATED in the window (brand-new leads Alex engaged).
  const { data: newSessions } = await sb
    .from('alex_sessions')
    .select('session_id, phone, created_at')
    .gt('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(50)

  // 3. Cold post-mortems fired since window start.
  const { data: coldSweeps } = await sb
    .from('alex_sessions')
    .select('session_id, phone, cold_postmortem_at')
    .gt('cold_postmortem_at', sinceIso)
    .limit(50)

  // 4. Contacts whose stage advanced to 4+ (booked) or 9 (installed) today.
  //    We approximate via contacts updated_at — true state transitions would
  //    need an audit-log table (future work).
  const { data: stageAdvances } = await sb
    .from('contacts')
    .select('id, stage, updated_at, county, generator_brand')
    .in('stage', [4, 5, 6, 7, 8, 9])
    .gt('updated_at', sinceIso)
    .order('updated_at', { ascending: false })
    .limit(50)

  // 5. Memory writes (what Alex / postmortem / Sparky learned today).
  const { data: memoryWrites } = await sb
    .from('alex_memory_files')
    .select('path, size_bytes, updated_at')
    .gt('updated_at', sinceIso)
    .order('updated_at', { ascending: false })
    .limit(25)

  // 6. Recent memory content — best-effort peek at the most-recently-updated
  //    file so Sparky can paraphrase a learning without us pasting full files.
  let latestLearning = ''
  if (memoryWrites && memoryWrites.length > 0) {
    const top = memoryWrites[0]
    const { data: topContent } = await sb
      .from('alex_memory_files')
      .select('content')
      .eq('path', top.path)
      .maybeSingle()
    if (topContent?.content) {
      latestLearning = String(topContent.content).slice(-800) // tail — most recent writes land at the end
    }
  }

  // ── Compact & anonymized payload for Sonnet ──────────────────────────────
  const scrubPhone = (p: string) => p ? `[${p.slice(-2)}]` : '[?]' // last-2-digit tag
  const payload = {
    window: { since: sinceIso, until: now.toISOString() },
    new_conversations: (newSessions || []).length,
    active_conversations: (activeSessions || []).length,
    cold_sweeps: (coldSweeps || []).length,
    stage_advances: (stageAdvances || []).map((c: any) => ({
      stage: c.stage, county: c.county || null, generator: c.generator_brand || null,
    })),
    memory_writes: (memoryWrites || []).map((m: any) => ({ path: m.path, size_bytes: m.size_bytes })),
    latest_learning_excerpt: latestLearning.slice(0, 600),
    // One-line texture per active session — role + last message length, no content.
    session_texture: (activeSessions || []).slice(0, 15).map((s: any) => {
      const msgs = Array.isArray(s.summary) ? [] : []
      return {
        status: s.status,
        followups: s.followup_count || 0,
        photo: !!s.photo_received,
        last_inbound: s.customer_last_msg_at,
        phone_tag: scrubPhone(s.phone || ''),
      }
    }),
  }

  // ── Ask Sonnet to compose the SMS ────────────────────────────────────────
  const userMsg = `Today's raw signals (JSON):
${JSON.stringify(payload, null, 2)}

Compose the SMS digest. Stay under 1200 chars. Obey the style rules.`

  let text = 'QUIET DAY'
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMsg }],
      }),
    })
    const data = await resp.json()
    if (!resp.ok) {
      console.error('[daily-digest] claude error:', data)
      return new Response(JSON.stringify({ ok: false, error: 'claude error', detail: data }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    const blocks: any[] = Array.isArray(data.content) ? data.content : []
    text = blocks.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim()
  } catch (e) {
    console.error('[daily-digest] claude fetch failed:', e)
    return new Response(JSON.stringify({ ok: false, error: String(e).slice(0, 300) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Hard cap SMS length — anything over 1500 will fragment weirdly.
  if (text.length > 1500) text = text.slice(0, 1497) + '…'

  const isQuiet = /^QUIET DAY$/i.test(text.trim())
  const bypass = new URL(req.url).searchParams.get('force') === '1'

  let smsSent = false
  if (!isQuiet || bypass) {
    smsSent = await sendSms(KEY_CELL, text || 'BPP daily digest: no content generated.')
  }

  return new Response(JSON.stringify({
    ok: true,
    window: { since: sinceIso, until: now.toISOString() },
    activity: {
      new_conversations: (newSessions || []).length,
      active_conversations: (activeSessions || []).length,
      cold_sweeps: (coldSweeps || []).length,
      stage_advances: (stageAdvances || []).length,
      memory_writes: (memoryWrites || []).length,
    },
    smsSent,
    digest: text,
  }, null, 2), {
    status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
