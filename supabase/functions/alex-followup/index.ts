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

  // Security audit #14: require service-role bearer auth (prior: anyone could
  // trigger the followup engine on demand, firing every queued reminder).
  const expectedAuth = `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''}`
  if (req.headers.get('authorization') !== expectedAuth) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: CORS })
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // ── Customer-requested reminders ──────────────────────────────────────────
  // Alex sets these via set_reminder tool when customer says "remind me at 5"
  // Fires regardless of follow-up window since the customer asked for this time.
  {
    const now = new Date().toISOString()
    const { data: reminders } = await db
      .from('sparky_memory')
      .select('key, value')
      .eq('category', 'schedule')
      .like('key', 'reminder:%')

    for (const rem of reminders || []) {
      try {
        const data = JSON.parse(rem.value)
        if (!data.at || new Date(data.at).toISOString() > now) continue  // not due yet

        const phone = rem.key.replace('reminder:', '')
        // Look up the session to make sure it's still active
        const { data: sess } = await db
          .from('alex_sessions')
          .select('session_id, messages, alex_active, status')
          .eq('session_id', data.session_id)
          .maybeSingle()

        if (!sess || sess.status !== 'active' || !sess.alex_active) {
          // Session is done, delete the stale reminder
          await db.from('sparky_memory').delete().eq('key', rem.key)
          continue
        }

        // Check if the reminder topic was already resolved (photo already received)
        if (sess.photo_received && data.note?.toLowerCase().includes('photo')) {
          console.log(`[followup] Reminder for ${phone} skipped — photo already received`)
          await db.from('sparky_memory').delete().eq('key', rem.key)
          continue
        }

        // Look up contact + DNC status (security #9: exact E.164 match)
        const { data: contacts } = await db
          .from('contacts')
          .select('name, do_not_contact')
          .eq('phone', phone)
          .limit(1)
        if (contacts?.[0]?.do_not_contact) {
          // Legal audit C3: do not send ANY reminder to an opted-out contact,
          // even if previously queued. Drop the reminder silently.
          console.log('[followup] Reminder suppressed: DNC flag set for ***', phone.slice(-4))
          await db.from('sparky_memory').delete().eq('key', rem.key)
          continue
        }
        const firstName = contacts?.[0]?.name?.split(' ')?.[0] || ''
        const hi = firstName ? `Hey ${firstName}, j` : 'J'

        // Use the reminder note to personalize the message
        const topic = (data.note || 'panel photo').toLowerCase()
        const reminderMsg = topic.includes('photo')
          ? `${hi}ust a heads up in case it slipped your mind. That panel photo whenever you get a chance.`
          : `${hi}ust wanted to touch base on what we talked about. ${data.note || 'Let me know if you have any questions.'}`

        const sent = await sendSms(phone, reminderMsg)
        if (sent) {
          const msgs = [...(sess.messages || []), { role: 'assistant', content: reminderMsg }]
          await db.from('alex_sessions').update({
            messages: msgs,
            last_outbound_at: now,
          }).eq('session_id', data.session_id)
          console.log(`[followup] Reminder fired for ${phone}: ${data.note}`)
        }

        // Delete the reminder regardless (one-shot)
        await db.from('sparky_memory').delete().eq('key', rem.key)
      } catch (err) {
        console.error('[followup] Reminder error:', rem.key, err)
        // Delete broken reminders
        await db.from('sparky_memory').delete().eq('key', rem.key)
      }
    }
  }

  // ── Window check (follow-ups only send during business hours) ───────────
  if (!isInWindow()) {
    console.log('[followup] Outside window, skipping follow-ups (reminders still fire above)')
    return new Response(JSON.stringify({ ok: true, reminders_checked: true, reason: 'outside_hours' }), { status: 200, headers: CORS })
  }

  // ── Morning photo reminder ──────────────────────────────────────────────
  // If a lead was contacted after dark last night and hasn't sent a photo yet,
  // send a gentle morning nudge at 9-10 AM so they don't forget.
  const eastern = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const currentHour = eastern.getHours()

  if (currentHour >= 9 && currentHour < 10) {
    // Find sessions created during dark hours (roughly last 14 hours).
    // Using UTC timestamps directly avoids all timezone conversion headaches.
    // At 9 AM Eastern, 14 hours ago = 7 PM the previous evening. Perfect range.
    const fourteenHoursAgo = new Date(Date.now() - 14 * 3600000).toISOString()
    const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString()

    const { data: nightLeads } = await db
      .from('alex_sessions')
      .select('session_id, phone, messages, photo_received, customer_last_msg_at, followup_count')
      .eq('status', 'active')
      .eq('alex_active', true)
      .eq('photo_received', false)
      .eq('followup_count', 0)
      .gte('created_at', fourteenHoursAgo)
      .lte('created_at', twoHoursAgo)

    for (const lead of nightLeads || []) {
      // Skip if customer already replied
      if (lead.customer_last_msg_at) continue

      // Look up name
      const digits = (lead.phone || '').replace(/\D/g, '').slice(-10)
      const { data: contacts } = await db
        .from('contacts')
        .select('name')
        .eq('phone', lead.phone)
        .limit(1)
      const firstName = contacts?.[0]?.name?.split(' ')?.[0] || ''
      const hi = firstName ? `Hey ${firstName}, g` : 'G'

      const reminder = `${hi}ood morning. Whenever you get a chance today, a photo of that electrical panel with the door open is all Key needs to get your quote started.`

      const sent = await sendSms(lead.phone, reminder)
      if (sent) {
        const msgs = [...(lead.messages || []), { role: 'assistant', content: reminder }]
        await db.from('alex_sessions').update({
          messages: msgs,
          last_outbound_at: new Date().toISOString(),
        }).eq('session_id', lead.session_id)
        console.log('[followup] Morning photo reminder sent to', lead.phone)
      }
    }
  }

  // ── Intraday nudge ────────────────────────────────────────────────────────
  // The 24h / 72h / 7d / 14d follow-up cadence below is too patient for the
  // "customer drifted mid-conversation" case. If Alex asks a question at 2pm
  // and the customer gets pulled away by life, the thread context is stale by
  // 2pm tomorrow. A soft bump ~3h later catches them while it's still fresh.
  //
  // Guardrails so it feels like a person, not a bot:
  //   • Customer has ALREADY engaged (at least one inbound reply). Never nudges
  //     a dead opener — if they didn't reply to Alex once, they don't want a
  //     second text 3h later.
  //   • Alex's last outbound ended with "?" — he's actively waiting on
  //     something. Nudging after a statement would feel random.
  //   • Only before the regular cadence starts (followup_count = 0).
  //   • intraday_sent flag ensures at most ONE bump per session.
  //   • DNC / opted_out / quiet-hour gates same as regular follow-ups.
  //   • 3 message variants, rotated so it doesn't feel scripted.
  {
    const threeHoursAgo     = new Date(Date.now() - 3  * 3600000).toISOString()
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 3600000).toISOString()

    const { data: intradayCandidates } = await db
      .from('alex_sessions')
      .select('session_id, phone, messages, last_outbound_at, customer_last_msg_at')
      .eq('status', 'active')
      .eq('alex_active', true)
      .eq('key_active', false)
      .eq('opted_out', false)
      .eq('followup_count', 0)
      .eq('intraday_sent', false)
      .gte('last_outbound_at', twentyFourHoursAgo)
      .lte('last_outbound_at', threeHoursAgo)

    for (const lead of intradayCandidates || []) {
      // Skip if customer replied AFTER Alex's last outbound (they're not silent)
      if (lead.customer_last_msg_at && lead.last_outbound_at) {
        const cTime = new Date(lead.customer_last_msg_at).getTime()
        const aTime = new Date(lead.last_outbound_at).getTime()
        if (cTime > aTime) continue
      }

      const msgs: any[] = Array.isArray(lead.messages) ? lead.messages : []

      // Engagement filter — must have at least one inbound (role=user) reply.
      // A session that never got a user reply is a dead-opener, not a drift.
      const hasUserReply = msgs.some((m: any) => m?.role === 'user')
      if (!hasUserReply) continue

      // Last assistant message must end with a "?" — otherwise we're not
      // actually waiting on anything specific from the customer.
      const lastAssistant = [...msgs].reverse().find((m: any) => m?.role === 'assistant')
      let lastText = ''
      if (typeof lastAssistant?.content === 'string') {
        lastText = lastAssistant.content
      } else if (Array.isArray(lastAssistant?.content)) {
        lastText = lastAssistant.content
          .filter((b: any) => b?.type === 'text')
          .map((b: any) => b?.text || '')
          .join(' ')
          .trim()
      }
      if (!/\?\s*$/.test(lastText)) continue

      // Cross-channel DNC check (legal C3)
      const { data: contacts } = await db
        .from('contacts')
        .select('do_not_contact')
        .eq('phone', lead.phone)
        .limit(1)
      if (contacts?.[0]?.do_not_contact) continue

      // Soft bump — rotate variants so the text doesn't feel scripted across
      // multiple customers Alex is handling the same day.
      const variants = [
        "No rush, just making sure my last text didn't get buried.",
        "Hey, bumping this up so it doesn't get lost.",
        "Still here whenever you've got a second.",
      ]
      const bump = variants[Math.floor(Math.random() * variants.length)]

      const ok = await sendSms(lead.phone, bump)
      if (!ok) continue

      // Append to message history so Alex has context when the customer
      // eventually replies. Update last_outbound_at so the 24h regular touch
      // clock restarts from the nudge (prevents a double-text within ~24h).
      const updatedMsgs = [...msgs, { role: 'assistant', content: bump }]
      await db.from('alex_sessions').update({
        messages:         updatedMsgs,
        last_outbound_at: new Date().toISOString(),
        intraday_sent:    true,
      }).eq('session_id', lead.session_id)

      console.log('[followup] Intraday nudge sent to ***', String(lead.phone).slice(-4))
    }
  }

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

      // Look up CRM contact + DNC status (security #9: exact E.164 match)
      const { data: contacts } = await db
        .from('contacts')
        .select('name, stage, do_not_contact')
        .eq('phone', session.phone)
        .limit(1)

      const contact   = contacts?.[0]
      const firstName = contact?.name?.split(' ')?.[0] || ''
      const crmStage  = contact?.stage || null

      // Legal audit C3: drop to silent if contact is DNC'd (cross-channel opt-out)
      if (contact?.do_not_contact) {
        await db.from('alex_sessions').update({ alex_active: false, opted_out: true, status: 'opted_out' }).eq('session_id', session.session_id)
        console.log('[followup] DNC flag on contact, session deactivated: ***', String(session.phone).slice(-4))
        continue
      }

      // Stop if lead is a customer now
      if (crmStage && STOP_STAGES.some(s => crmStage.toLowerCase().includes(s))) {
        await db.from('alex_sessions').update({ alex_active: false }).eq('session_id', session.session_id)
        console.log('[followup] Stage complete, stopped: ***', String(session.phone).slice(-4))
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
        // Delivery failed — likely bad number. Deactivate so we stop trying.
        await db.from('alex_sessions')
          .update({ alex_active: false, status: 'undeliverable' })
          .eq('session_id', session.session_id)
        console.error('[followup] Delivery failed, session deactivated:', session.phone)
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