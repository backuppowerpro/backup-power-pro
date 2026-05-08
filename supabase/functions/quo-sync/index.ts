/**
 * quo-sync — Backfill OpenPhone (Quo) messages into the Supabase `messages`
 * table so all downstream queries have a single source of truth.
 *
 * Why this exists (Apr 29, 2026):
 *   The (864) 400-5302 line is still on Quo/OpenPhone until porting to Twilio
 *   completes. Real customer replies and Key's manual outbound from the
 *   OpenPhone app live there, NOT in the messages table that twilio-webhook +
 *   alex-agent populate. This made experiment-stats / crm-stats / Sparky
 *   blind to the actual lead flow — the "2.5% engagement" baseline I
 *   confidently reported was wrong because of this gap.
 *
 * What it does:
 *   1. Lists OpenPhone conversations for the Quo phone over the last N days.
 *   2. For each conversation, fetches messages from OpenPhone API.
 *   3. Looks up the contact by lead phone (digits-match).
 *   4. Upserts each message into Supabase `messages` table, using
 *      `quo_message_id` for dedup (already the existing dedup key for the
 *      Twilio path).
 *
 * Design choices:
 *   - Direction mapping: OpenPhone "incoming" → "inbound", "outgoing" → "outbound"
 *   - Sender attribution for outgoing:
 *       - If userId present (a human sent via OpenPhone app) → sender = 'key'
 *       - If no userId (sent via OpenPhone API, i.e. the Quo auto-responder) → sender = 'ai'
 *   - Media: OpenPhone returns array of URLs. Same `[media:URL]` prefix as twilio-webhook
 *     for downstream-tool consistency (vision check, photo-received detection).
 *   - Idempotent: re-running won't double-insert thanks to `quo_message_id` dedup.
 *
 * Auth: brain token (same as dojo-helper, fetch-experiment-stats).
 *
 * GET endpoint:
 *   GET /quo-sync?days=7  — backfill last N days (default 7, max 30)
 *   POST /quo-sync          — same with optional JSON body { days: 14 }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { timingSafeEqual, allowRate } from '../_shared/auth.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-bpp-brain-token',
}

const QUO_PHONE_ID = 'PNTZHfvSsh' // (864) 400-5302 — the Quo line
const QUO_PHONE_E164 = '+18644005302'

interface QuoMessage {
  id: string
  conversationId: string
  text?: string
  body?: string
  direction: 'incoming' | 'outgoing'
  from?: string
  to?: string | string[]
  participants?: string[]
  userId?: string | null
  media?: string[]
  createdAt: string
  status?: string
}

function normalizePhone(raw: string): string {
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return raw.startsWith('+') ? raw : ''
}

function lastTen(raw: string): string {
  return (raw || '').replace(/\D/g, '').slice(-10)
}

async function fetchOpenPhoneJSON(url: string, apiKey: string): Promise<any> {
  const resp = await fetch(url, {
    headers: { Authorization: apiKey },
  })
  if (!resp.ok) {
    const txt = await resp.text()
    throw new Error(`OpenPhone API ${resp.status}: ${txt.slice(0, 200)}`)
  }
  return resp.json()
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  // ── Auth: brain token only (this is a sync utility, not customer-facing) ─
  const brainHdr = req.headers.get('x-bpp-brain-token') || ''
  const BRAIN = Deno.env.get('BPP_BRAIN_TOKEN') || ''
  if (!BRAIN || !timingSafeEqual(brainHdr, BRAIN)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Per-IP rate limit — sync is heavy (50+ API calls), don't allow rapid retries
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!allowRate(`quo-sync:${ip}`, 5)) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), {
      status: 429, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const QUO_API_KEY = Deno.env.get('QUO_API_KEY') || Deno.env.get('OPENPHONE_API_KEY') || ''
  if (!QUO_API_KEY) {
    return new Response(JSON.stringify({ error: 'QUO_API_KEY not configured' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Parse window
  const url = new URL(req.url)
  let days = Number(url.searchParams.get('days') || '7')
  try {
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}))
      if (body?.days) days = Number(body.days)
    }
  } catch { /* fall through to default */ }
  days = Math.max(1, Math.min(30, days))

  const cutoffMs = Date.now() - days * 86400000

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // 1. List conversations
  let conversations: any[] = []
  try {
    const data = await fetchOpenPhoneJSON(
      `https://api.openphone.com/v1/conversations?phoneNumberId=${QUO_PHONE_ID}&maxResults=50`,
      QUO_API_KEY,
    )
    conversations = (data?.data || []).filter((c: any) => {
      const ts = new Date(c.lastActivityAt || c.updatedAt || c.createdAt || 0).getTime()
      return ts >= cutoffMs
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'list_conversations_failed', detail: String(e).slice(0, 300) }), {
      status: 502, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // 2. Fetch messages per conversation, normalize, dedup, upsert
  const summary = {
    conversations_seen: conversations.length,
    messages_fetched: 0,
    messages_inserted: 0,
    messages_skipped_dedup: 0,
    contacts_matched: 0,
    contacts_unknown: 0,
    api_errors: 0,
    sample_inserts: [] as any[],
  }

  for (const conv of conversations) {
    // Pick the lead phone (the participant that isn't QUO)
    const participants: string[] = (conv.participants || []).filter(Boolean)
    const leadPhone = participants.find(p => !p.includes('4005302') && !p.includes('+18644005302')) || ''
    if (!leadPhone) continue
    const leadE164 = normalizePhone(leadPhone)
    if (!leadE164) continue

    // Skip dojo test phones — we don't want to clutter messages table with simulator data
    if (leadE164.startsWith('+1800555')) continue

    // Look up contact by phone
    const { data: contacts } = await sb
      .from('contacts')
      .select('id, phone, name')
      .eq('phone', leadE164)
      .limit(1)
    const contactId = contacts?.[0]?.id || null
    if (contactId) summary.contacts_matched++
    else summary.contacts_unknown++

    // Pull messages for this conversation. OpenPhone /v1/messages requires
    // phoneNumberId + participants. Pass the lead's E.164 as participant.
    let msgs: QuoMessage[] = []
    try {
      const data = await fetchOpenPhoneJSON(
        `https://api.openphone.com/v1/messages?phoneNumberId=${QUO_PHONE_ID}&participants[]=${encodeURIComponent(leadE164)}&maxResults=50`,
        QUO_API_KEY,
      )
      msgs = data?.data || []
    } catch (e) {
      summary.api_errors++
      console.warn(`[quo-sync] messages fetch failed for ${leadE164}: ${e}`)
      continue
    }

    summary.messages_fetched += msgs.length

    for (const m of msgs) {
      const mTs = new Date(m.createdAt || 0).getTime()
      if (!mTs || mTs < cutoffMs) continue

      // Dedup: check if quo_message_id already exists
      const { data: existing } = await sb
        .from('messages')
        .select('id')
        .eq('quo_message_id', m.id)
        .limit(1)
      if (existing && existing.length > 0) {
        summary.messages_skipped_dedup++
        continue
      }

      // Direction + sender mapping
      const direction = m.direction === 'incoming' ? 'inbound' : 'outbound'
      let sender: 'lead' | 'ai' | 'key'
      if (direction === 'inbound') {
        sender = 'lead'
      } else if (m.userId) {
        sender = 'key' // human sent via OpenPhone app
      } else {
        sender = 'ai' // sent via API (Quo auto-responder, alex-agent, etc.)
      }

      // Build body — prepend [media:URL] tags same as twilio-webhook does
      const text = (m.text || m.body || '').trim()
      const mediaUrls = Array.isArray(m.media) ? m.media : []
      const body = mediaUrls.length > 0
        ? mediaUrls.map((u: string) => `[media:${u}]`).join(' ') + (text ? ' ' + text : '')
        : (text || '[Empty message]')

      const senderPhone = direction === 'inbound' ? leadE164 : QUO_PHONE_E164

      const { error: insErr } = await sb.from('messages').insert({
        contact_id:     contactId,
        direction,
        body,
        sender,
        sender_phone:   senderPhone,
        quo_message_id: m.id,
        status:         direction === 'inbound' ? 'received' : 'sent',
        created_at:     m.createdAt, // preserve original timestamp
      })
      if (insErr) {
        console.warn(`[quo-sync] insert failed for ${m.id}: ${insErr.message}`)
        continue
      }

      summary.messages_inserted++
      if (summary.sample_inserts.length < 5) {
        summary.sample_inserts.push({
          id: m.id,
          phone_last4: leadE164.slice(-4),
          direction,
          sender,
          contact_matched: !!contactId,
          body_preview: body.slice(0, 80),
          ts: m.createdAt,
        })
      }
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    window_days: days,
    cutoff: new Date(cutoffMs).toISOString(),
    ...summary,
  }, null, 2), {
    status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
