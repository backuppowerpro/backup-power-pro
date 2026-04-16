/**
 * alex-followup — scheduled follow-up engine for BPP leads
 *
 * Called hourly by pg_cron. Only sends during 10 AM – 6 PM Eastern.
 * Stops when Key takes over, lead opts out, or quote is approved.
 *
 * Sequences (5 touches max — research shows 8-touch persistence beats 3-touch):
 *   No photo yet  → +24h, +72h, +7d, +14d, graceful exit
 *   Photo/quoted  → +48h, +5d, +10d, +21d, graceful exit
 *   Graceful exit → alex_active = false, done
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const QUO_API_KEY       = Deno.env.get('QUO_API_KEY')!
const QUO_PHONE_ID      = Deno.env.get('QUO_PHONE_NUMBER_ID')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// Eastern follow-up window (24h format)
const WINDOW_START = 10  // 10 AM
const WINDOW_END   = 18  // 6 PM

// Hours between follow-ups [touch1, touch2, touch3, touch4, exit] per track
// Research: 8-touch persistence 4x better results. We cap at 5 (exit on 4).
const INTERVALS_NO_PHOTO = [24, 72, 168, 336]    // 1d, 3d, 7d, 14d
const INTERVALS_QUOTED   = [48, 120, 240, 504]   // 2d, 5d, 10d, 21d
const MAX_FOLLOWUPS = 4  // 4 timed messages, 5th is graceful exit

// CRM stages that mean "done — stop all AI"
const STOP_STAGES = ['won', 'installed', 'complete', 'closed', 'approved', 'scheduled']

// ── Helpers ───────────────────────────────────────────────────────────────────

function isInWindow(): boolean {
  const eastern = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const h = eastern.getHours()
  return h >= WINDOW_START && h < WINDOW_END
}

function hasPhoto(messages: any[]): boolean {
  return messages.some(m =>
    m.role === 'user' &&
    typeof m.content === 'string' &&
    m.content.includes('[Customer sent a photo]')
  )
}

function cleanSms(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/~(.*?)~/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/\u2014/g, ',')
    .replace(/\u2013/g, '-')
    .trim()
}

// ── Message generation ────────────────────────────────────────────────────────

async function generateMessage(
  firstName: string,
  followupCount: number,
  photoReceived: boolean,
  crmStage: string | null,
): Promise<string | null> {
  const isExit = followupCount >= MAX_FOLLOWUPS
  const isQuoted = crmStage?.toLowerCase().includes('quot')

  let instruction: string

  if (isExit) {
    // Graceful exit — the "have you moved on?" message (performs well in re-engagement research)
    instruction = `This is the last message Alex will ever send this person. ` +
      `It should be warm, zero pressure, and should acknowledge that priorities change. ` +
      `Something like "completely understand if the timing isn't right" — then say BPP is here whenever. ` +
      `Do not ask any question. Just close the loop gracefully. One to two sentences.`
  } else if (isQuoted && followupCount === 0) {
    instruction = `Key sent a quote. This is the first follow-up. ` +
      `Ask briefly if they had a chance to look it over and if they have any questions. ` +
      `One question only. No filler.`
  } else if (isQuoted && followupCount === 1) {
    instruction = `Second follow-up on an unanswered quote. Very brief, low pressure. ` +
      `Just see if they are still interested. One sentence if possible.`
  } else if (isQuoted) {
    instruction = `Third or fourth follow-up on a silent quote. Brief. Mention that Key can adjust things if needed. ` +
      `No pressure. Two sentences max.`
  } else if (!photoReceived && followupCount === 0) {
    instruction = `The customer reached out but has not sent a panel photo yet. ` +
      `Brief, warm first follow-up. Ask if they had a chance to grab that photo of the breaker panel. ` +
      `Remind them it only takes a second to snap one.`
  } else if (!photoReceived && followupCount === 1) {
    instruction = `Second follow-up. Still no photo. Very brief, casual. ` +
      `Keep it light — just see if they are still interested. Two sentences max. No desperation.`
  } else if (!photoReceived && followupCount === 2) {
    instruction = `Third follow-up. Still no response. This one should feel completely natural. ` +
      `Maybe mention storm season or power outages if it feels relevant. One to two sentences.`
  } else if (photoReceived && followupCount === 0) {
    instruction = `The customer sent a panel photo. Key has been notified. ` +
      `Brief, warm check-in — just let them know Key is working on it and should be in touch soon. ` +
      `No question needed unless it flows naturally.`
  } else {
    instruction = `Warm follow-up after photo was received. Still waiting on Key. ` +
      `Keep it very brief and reassuring. One to two sentences.`
  }

  const nameLine = firstName ? `Customer first name: ${firstName}` : `Customer name unknown — do not use a name.`

  const prompt = `You are Alex, a warm and natural assistant for Backup Power Pro (generator connection installation in Upstate SC). Key is the licensed electrician.

${nameLine}
${instruction}

Voice: write like a real person sending a casual, friendly text. Not a company follow-up. Not a template. A person who genuinely wants to help and is checking in. Confident, not needy.

Hard rules:
- NEVER give electrical advice or say any price.
- No em dashes, no emoji, no bold, no markdown.
- Never say: Absolutely, Awesome, Great question, I appreciate, I understand, Dont hesitate, Id be happy to, Just wanted to, Checking in, Following up, Circling back, Hope this finds you.
- Under 280 characters.
- 1-3 sentences. One idea. Stop.

Return ONLY the SMS message text. Nothing else.`

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!resp.ok) return null
    const data = await resp.json()
    return data.content?.[0]?.text?.trim() || null
  } catch {
    return null
  }
}

async function sendSms(to: string, content: string): Promise<boolean> {
  try {
    const resp = await fetch('https://api.openphone.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: QUO_API_KEY },
      body: JSON.stringify({ from: QUO_PHONE_ID, to: [to], content }),
    })
    if (!resp.ok) {
      console.error('[followup] Quo send failed:', resp.status, await resp.text())
      return false
    }
    return true
  } catch (err) {
    console.error('[followup] Quo send error:', err)
    return false
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  if (!isInWindow()) {
    console.log('[followup] Outside window, skipping')
    return new Response(JSON.stringify({ skipped: true, reason: 'outside_hours' }), { status: 200, headers: CORS })
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Expire sessions older than 30 days using created_at (handles NULL last_outbound_at)
  await db
    .from('alex_sessions')
    .update({ status: 'expired', alex_active: false })
    .eq('status', 'active')
    .lt('created_at', new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString())

  // Load active sessions where Alex is allowed to follow up
  // MAX_FOLLOWUPS+1: at count=MAX_FOLLOWUPS the exit message is generated, then alex_active is cleared
  const { data: sessions, error } = await db
    .from('alex_sessions')
    .select('*')
    .eq('status', 'active')
    .eq('alex_active', true)
    .eq('key_active', false)
    .eq('opted_out', false)
    .lte('followup_count', MAX_FOLLOWUPS)

  if (error || !sessions?.length) {
    return new Response(JSON.stringify({ ok: true, processed: 0 }), { status: 200, headers: CORS })
  }

  const now = Date.now()
  let processed = 0

  for (const session of sessions) {
    try {
      // Skip if customer already replied since Alex's last message
      if (session.customer_last_msg_at && session.last_outbound_at) {
        const customerTime = new Date(session.customer_last_msg_at).getTime()
        const alexTime     = new Date(session.last_outbound_at).getTime()
        if (customerTime > alexTime) continue
      }

      // Determine which interval applies
      // Prefer DB flag (set when media arrives), fall back to parsing message history
      const photoSent  = session.photo_received || hasPhoto(session.messages || [])
      const intervals  = photoSent ? INTERVALS_QUOTED : INTERVALS_NO_PHOTO
      const required   = (intervals[session.followup_count] || 168) * 3600000

      const baseline = session.last_followup_at || session.last_outbound_at || session.created_at
      if (!baseline) continue
      if (now - new Date(baseline).getTime() < required) continue

      // Look up CRM contact
      const digits = (session.phone || '').replace(/\D/g, '').slice(-10)
      const { data: contacts } = await db
        .from('contacts')
        .select('name, stage')
        .ilike('phone', `%${digits}`)
        .limit(1)

      const contact   = contacts?.[0]
      const firstName = contact?.name?.split(' ')?.[0] || ''
      const crmStage  = contact?.stage || null

      // Stop if lead is a customer now
      if (crmStage && STOP_STAGES.some(s => crmStage.toLowerCase().includes(s))) {
        await db.from('alex_sessions').update({ alex_active: false }).eq('session_id', session.session_id)
        console.log('[followup] Stage complete, stopped:', session.phone)
        continue
      }

      // Generate message
      const msg = await generateMessage(firstName, session.followup_count, photoSent, crmStage)
      if (!msg) {
        console.error('[followup] No message generated for', session.phone)
        continue
      }

      const cleanedMsg = cleanSms(msg)
      const sent = await sendSms(session.phone, cleanedMsg)
      if (!sent) {
        console.error('[followup] Skipping count update — send failed for', session.phone)
        continue
      }

      // Append to session message history so Alex has context when customer replies
      const updatedMessages = [
        ...(session.messages || []),
        { role: 'assistant', content: cleanedMsg },
      ]

      const newCount = session.followup_count + 1
      const updates: Record<string, unknown> = {
        followup_count:   newCount,
        last_followup_at: new Date().toISOString(),
        last_outbound_at: new Date().toISOString(),
        messages:         updatedMessages,
      }
      // After the exit message (count = MAX_FOLLOWUPS+1), deactivate Alex for this lead
      if (newCount > MAX_FOLLOWUPS) updates.alex_active = false

      await db.from('alex_sessions').update(updates).eq('session_id', session.session_id)

      console.log(`[followup] Sent #${newCount} to ${session.phone}`)
      processed++

    } catch (err) {
      console.error('[followup] Error for', session.session_id, err)
    }
  }

  return new Response(JSON.stringify({ ok: true, processed }), { status: 200, headers: CORS })
})
