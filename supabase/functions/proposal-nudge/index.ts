/**
 * proposal-nudge — Smart follow-up engine for un-signed proposals.
 *
 * Runs daily at 15:00 UTC (11am EDT). Finds proposals where:
 *   - status is 'Sent' or 'Viewed' (not Approved, not Cancelled, not Declined)
 *   - created ≥18h ago (give them time to actually look first)
 *   - haven't been nudged in the last 48h (nudge_last_at marker on the row)
 *   - the contact isn't DNC'd
 *
 * Sends a different SMS based on view_count signal:
 *   - 0 views (proposal never opened): the link may have been missed.
 *     "Hey {name} — want to make sure my quote landed in your messages."
 *   - 1-2 views: warm consideration, but not yet committed.
 *     "Saw you took a look — happy to answer any questions, no pressure."
 *   - 3+ views: high intent, possibly stuck on a specific concern.
 *     "Looks like you're weighing it. Anything I can clarify, or want to
 *     hop on a quick call so it's not a guessing game?"
 *
 * Caps at 2 nudges per proposal lifetime (tracked via proposals.nudge_count).
 * After the second nudge, the proposal is left to whatever Alex / Key
 * decide — auto-nudging beyond two becomes pestering.
 *
 * Auth: requireServiceRole. Schedule via rotate-cron-jwt-now.
 *
 * CEO rationale: per the silent-prospect-followup-framework wiki memory,
 * 1.2% close rate over 30d. Most lost deals aren't lost on price; they're
 * lost to silence after the proposal goes out. Even a +1% close-rate
 * lift from this nudger pays for itself ~10x within a month.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireServiceRole } from '../_shared/auth.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SR_KEY      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const QUO_API_KEY = Deno.env.get('QUO_API_KEY')!
const QUO_PHONE_ID = Deno.env.get('QUO_PHONE_NUMBER_ID')!
const KEY_CELL = '+19414417996'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const json = (status: number, body: unknown) => new Response(
  JSON.stringify(body),
  { status, headers: { ...CORS, 'Content-Type': 'application/json' } },
)

// Three nudge variants keyed by view_count bucket. Each is short (under
// 200 chars), no em-dashes, no dollar figures, no stacked questions —
// follows the same SMS rules as Alex outbound. First-name personalized.
function nudgeMessage(firstName: string, viewCount: number, link: string | null): string {
  const name = firstName || 'there'
  if (viewCount === 0) {
    // Linkless reminder is OK if we don't have a link, but the link itself
    // is the key — send it again. Most "0 views" cases are just the
    // proposal SMS getting buried in the customer's threads.
    return link
      ? `Hey ${name}, wanting to make sure my quote landed for you. Here's the link in case the first one got buried: ${link}`
      : `Hey ${name}, wanting to make sure my quote landed for you. Let me know if you didn't get it and I'll resend.`
  }
  if (viewCount <= 2) {
    return `Hey ${name}, saw you took a look at the quote. Anything I can clarify? Happy to walk through any of the details, no pressure either way.`
  }
  // 3+ views = high intent, likely stuck on a specific concern
  return `Hey ${name}, looks like you've been weighing the quote. If there's a specific question hanging it up, easier on a quick call than back-and-forth here. Want me to ring you tonight?`
}

async function sendSms(to: string, content: string): Promise<{ ok: boolean; err?: string }> {
  try {
    const resp = await fetch('https://api.openphone.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: QUO_API_KEY },
      body: JSON.stringify({ from: QUO_PHONE_ID, to: [to], content }),
    })
    if (!resp.ok) {
      const errBody = await resp.text().catch(() => '')
      return { ok: false, err: `${resp.status} ${errBody.slice(0, 200)}` }
    }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, err: String(e?.message || e).slice(0, 200) }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  const gate = requireServiceRole(req); if (gate) return gate

  const sb = createClient(SUPABASE_URL, SR_KEY)

  const eighteenHoursAgo = new Date(Date.now() - 18 * 3600 * 1000).toISOString()
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 3600 * 1000).toISOString()

  // Pull candidate proposals. Status filter excludes anything terminal.
  // The created_at <= eighteenHoursAgo filter keeps us from nudging
  // a proposal we just sent this morning.
  const { data: candidates, error: candErr } = await sb
    .from('proposals')
    .select('id, contact_id, total, status, created_at, view_count, signed_at, signed_url, nudge_count, nudge_last_at')
    .in('status', ['Sent', 'Viewed', 'Created', 'Copied'])
    .lte('created_at', eighteenHoursAgo)
    .is('signed_at', null)
    .or(`nudge_last_at.is.null,nudge_last_at.lte.${fortyEightHoursAgo}`)
    .limit(50)

  if (candErr) {
    console.error('[proposal-nudge] candidate query failed:', candErr)
    return json(500, { error: candErr.message })
  }
  if (!candidates || candidates.length === 0) {
    return json(200, { ok: true, nudged: 0, note: 'no eligible proposals' })
  }

  // Resolve contact info for each — name + phone + DNC. Single roundtrip.
  const contactIds = Array.from(new Set(candidates.map(p => p.contact_id).filter(Boolean)))
  const { data: contacts } = await sb
    .from('contacts')
    .select('id, name, phone, do_not_contact')
    .in('id', contactIds)
  const contactMap = Object.fromEntries((contacts || []).map(c => [c.id, c]))

  const results: Array<{ proposalId: string; contactName: string; bucket: string; ok: boolean; err?: string }> = []
  let totalNudged = 0

  for (const p of candidates) {
    const contact = contactMap[p.contact_id]
    if (!contact) continue
    if (contact.do_not_contact) continue
    if (!contact.phone) continue
    if ((p.nudge_count || 0) >= 2) continue  // cap at 2 nudges per proposal

    const firstName = String(contact.name || '').trim().split(/\s+/)[0]
    const viewCount = Number(p.view_count) || 0
    const bucket = viewCount === 0 ? 'unopened'
                 : viewCount <= 2 ? 'warm'
                 : 'high-intent'

    const msg = nudgeMessage(firstName, viewCount, p.signed_url || null)
    const send = await sendSms(contact.phone, msg)

    if (send.ok) {
      // Persist the nudge — increment count + stamp last_at so the next
      // run skips this proposal for 48h.
      await sb.from('proposals')
        .update({
          nudge_count: (p.nudge_count || 0) + 1,
          nudge_last_at: new Date().toISOString(),
        })
        .eq('id', p.id)
      totalNudged++
      results.push({ proposalId: p.id, contactName: firstName, bucket, ok: true })
      console.log(`[proposal-nudge] sent ${bucket} nudge to ${firstName} (proposal ${p.id})`)
    } else {
      results.push({ proposalId: p.id, contactName: firstName, bucket, ok: false, err: send.err })
      console.warn(`[proposal-nudge] send failed for ${firstName}: ${send.err}`)
    }
  }

  // Summary text to Key if any nudges fired. Single SMS, not per-nudge,
  // so Key isn't spammed when 5 proposals get nudged in one run.
  if (totalNudged > 0) {
    const buckets: Record<string, number> = {}
    for (const r of results) if (r.ok) buckets[r.bucket] = (buckets[r.bucket] || 0) + 1
    const breakdown = Object.entries(buckets)
      .map(([k, v]) => `${v} ${k}`)
      .join(', ')
    const summary = `Proposal nudges sent today: ${totalNudged} (${breakdown}). Watch for replies.`
    await sendSms(KEY_CELL, summary).catch(() => {})
  }

  return json(200, {
    ok: true,
    candidates: candidates.length,
    nudged: totalNudged,
    results,
  })
})
