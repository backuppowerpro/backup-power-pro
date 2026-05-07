/**
 * comm-orchestrator — Stage-aware customer + Key communication engine.
 *
 * Runs hourly via pg_cron. Per Q18 capture, client communication is the #1
 * named drainer — the friction is context-switching across N contacts at
 * different stages, not the copy itself. This function is the orchestrator
 * that owns the "who needs what next" surface so Key doesn't have to track
 * it in his head.
 *
 * Carve-out: per the CRM rule "Key handles all communication with booked
 * clients (stage 4+) personally", customer-facing AI sends are gated to
 * permit-pipeline updates only — those are status notifications Key
 * implicitly authorized via Q18 ("quick updates for people while they are
 * waiting for their permits so they don't think i just ghosted them").
 * Anything beyond pipeline status to a stage 4+ contact stays manual.
 *
 * Trigger table (one fire per trigger per contact, tracked via __orch_*
 * markers in contacts.notes — same convention as __pm_* and __review_asked):
 *
 *   stage 5, +3d since entered  → customer: permit-submitted reassurance
 *   stage 5, +7d since entered  → customer: jurisdiction-still-pending
 *   stage 7, entered ≤24h ago   → customer: permit-approved, ready to install
 *   stage 8, install_at -24h    → customer: install reminder
 *   any stage 4-8, stuck 14d+   → internal Key SMS digest (once per week)
 *
 * Quiet hours: 8am-9pm ET for customer SMS. Internal Key SMS unrestricted
 * (Key prefers 8pm-12am; this is non-customer-facing anyway).
 *
 * Auth: requireServiceRole.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireServiceRole } from '../_shared/auth.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SR_KEY       = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TWILIO_SID   = Deno.env.get('TWILIO_ACCOUNT_SID') || ''
const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') || ''
const TWILIO_FROM  = Deno.env.get('TWILIO_PHONE_NUMBER') || '+18648637800'
const KEY_CELL     = '+19414417996'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
}
const json = (s: number, b: unknown) => new Response(JSON.stringify(b),
  { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })

// ── Quiet hours: customer-facing only. 8am-9pm America/New_York. ─────────────
function isQuietHourET(now: Date = new Date()): boolean {
  // Render the current instant in ET, parse the hour. Handles DST automatically.
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric', hour12: false,
  })
  const hour = parseInt(fmt.format(now), 10)
  // Quiet means OUTSIDE 8am-9pm: hour < 8 OR hour >= 21
  return hour < 8 || hour >= 21
}

// ── Notes-marker helpers (same line-prefix convention as __pm_*, __review_asked) ──
function hasMarker(notes: string | null | undefined, marker: string): boolean {
  return (notes || '').includes(`__orch_${marker}:`)
}
function appendMarker(notes: string | null | undefined, marker: string): string {
  const stamp = `__orch_${marker}: ${new Date().toISOString()}`
  return (notes ? notes + '\n' : '') + stamp
}

// ── Read __pm_* fields (jurisdiction, submitted_at, etc) ─────────────────────
function pmRead(notes: string, key: string): string {
  const m = notes.match(new RegExp(`^__pm_${key}:\\s*(.*)$`, 'm'))
  return m ? m[1].trim() : ''
}
function pmDate(notes: string, key: string): Date | null {
  const v = pmRead(notes, key)
  if (!v) return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}

// ── Twilio sender (matches permit-morning-check pattern, internal use) ───────
async function sendTwilio(to: string, body: string): Promise<{ ok: boolean; err?: string }> {
  if (!TWILIO_SID || !TWILIO_TOKEN) return { ok: false, err: 'twilio creds missing' }
  try {
    const auth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)
    const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body }).toString(),
    })
    if (!resp.ok) return { ok: false, err: `${resp.status} ${(await resp.text()).slice(0, 200)}` }
    return { ok: true }
  } catch (e: any) { return { ok: false, err: String(e?.message || e).slice(0, 200) } }
}

// ── Customer-facing send via send-sms (logs to messages table, respects DNC) ──
async function sendCustomerSms(contactId: string, body: string): Promise<{ ok: boolean; err?: string }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SR_KEY}` },
      body: JSON.stringify({ contactId, body }),
    })
    if (!res.ok) return { ok: false, err: `send-sms ${res.status}` }
    const j = await res.json().catch(() => ({}))
    if (j && j.success === false) return { ok: false, err: j.error || 'send-sms returned success=false' }
    return { ok: true }
  } catch (e: any) { return { ok: false, err: String(e?.message || e).slice(0, 200) } }
}

// ── Copy bank — voice rules: no em-dashes, no desperation, no specific times,
// no "happy to assist", first-name personalized, low-pressure ────────────────
function copyPermitSubmitted3d(firstName: string, jurisdiction: string): string {
  const j = jurisdiction || 'the jurisdiction'
  return `Hey ${firstName || 'there'}, quick update: permit is sitting with ${j} and we're a few days into their queue. Nothing's stuck on our end, just waiting for them to process. I'll text the moment it moves.`
}
function copyPermitSubmitted7d(firstName: string, jurisdiction: string): string {
  const j = jurisdiction || 'the jurisdiction'
  return `Hey ${firstName || 'there'}, week one with ${j} on the permit and no movement yet on their side. That's still in their normal range. Keeping an eye on it daily, will text the second it changes.`
}
function copyPermitApproved(firstName: string): string {
  return `Hey ${firstName || 'there'}, good news, permit is approved. Want to lock in install timing? Reply with a couple of days that work and I'll line it up.`
}
function copyInstallReminder(firstName: string): string {
  return `Hey ${firstName || 'there'}, install is set for tomorrow. I'll text on the way. Anything I should know about the property before I roll up?`
}

// ── Stage age helper: pulls most recent stage_history row for this contact + stage ──
async function stageEnteredAt(sb: any, contactId: string, stage: number): Promise<Date | null> {
  const { data } = await sb
    .from('stage_history')
    .select('changed_at')
    .eq('contact_id', contactId)
    .eq('to_stage', stage)
    .order('changed_at', { ascending: false })
    .limit(1)
  if (!data || !data.length) return null
  return new Date(data[0].changed_at)
}

// ── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  const gate = requireServiceRole(req); if (gate) return gate

  const sb = createClient(SUPABASE_URL, SR_KEY)
  const now = new Date()
  const quietHours = isQuietHourET(now)
  const dryRun = new URL(req.url).searchParams.get('dry_run') === '1'

  // Pull active mid-funnel contacts. Stage 4-8 is the "I am between booked
  // and install-complete" window where context-switching tax is highest.
  // Plus stage 1 stalled (>14d) for the digest.
  const { data: candidates, error: candErr } = await sb
    .from('contacts')
    .select('id, name, phone, stage, status, do_not_contact, ai_enabled, ai_paused_until, install_notes, notes, install_at')
    .in('stage', [1, 5, 6, 7, 8])
    .neq('status', 'Archived')
    .neq('status', 'Lost')
    .limit(500)

  if (candErr) {
    console.error('[comm-orchestrator] candidate query failed:', candErr)
    return json(500, { error: candErr.message })
  }

  const fired: any[] = []
  const skipped: any[] = []
  const stalledForDigest: any[] = []

  for (const c of (candidates || [])) {
    if (c.do_not_contact) { skipped.push({ id: c.id, why: 'dnc' }); continue }
    if (c.ai_enabled === false) { skipped.push({ id: c.id, why: 'ai_disabled' }); continue }
    if (c.ai_paused_until && new Date(c.ai_paused_until).getTime() > now.getTime()) {
      skipped.push({ id: c.id, why: 'ai_paused' }); continue
    }

    const firstName = String(c.name || '').trim().split(/\s+/)[0] || ''
    const installNotes = String(c.install_notes || '')
    const notes = String(c.notes || '')
    const stage = Number(c.stage || 1)
    const jurisdiction = pmRead(installNotes, 'jurisdiction')
    const enteredAt = await stageEnteredAt(sb, c.id, stage)
    const ageMs = enteredAt ? (now.getTime() - enteredAt.getTime()) : 0
    const ageDays = ageMs / (24 * 3600 * 1000)

    // Stalled-digest collection (any active mid-funnel stage stuck 14d+)
    if (stage >= 1 && stage <= 8 && ageDays >= 14) {
      stalledForDigest.push({ id: c.id, name: c.name, stage, ageDays: Math.floor(ageDays) })
    }

    // ── Customer-facing triggers (stage 5/6/7/8) ───────────────────────────
    if (!c.phone) { skipped.push({ id: c.id, why: 'no_phone' }); continue }

    // Stage 5: permit submitted, sitting in jurisdiction queue
    if (stage === 5 && enteredAt) {
      // 3-day reassurance
      if (ageDays >= 3 && ageDays < 7 && !hasMarker(notes, 'p5_3d')) {
        if (quietHours) { skipped.push({ id: c.id, why: 'quiet_hours_p5_3d' }); continue }
        const body = copyPermitSubmitted3d(firstName, jurisdiction)
        if (dryRun) {
          fired.push({ id: c.id, trigger: 'p5_3d', dryRun: true, body })
        } else {
          const send = await sendCustomerSms(c.id, body)
          if (send.ok) {
            await sb.from('contacts').update({ notes: appendMarker(notes, 'p5_3d') }).eq('id', c.id)
            fired.push({ id: c.id, trigger: 'p5_3d', name: firstName })
          } else { skipped.push({ id: c.id, why: 'send_failed_p5_3d', err: send.err }) }
        }
        continue
      }
      // 7-day still-waiting
      if (ageDays >= 7 && !hasMarker(notes, 'p5_7d')) {
        if (quietHours) { skipped.push({ id: c.id, why: 'quiet_hours_p5_7d' }); continue }
        const body = copyPermitSubmitted7d(firstName, jurisdiction)
        if (dryRun) {
          fired.push({ id: c.id, trigger: 'p5_7d', dryRun: true, body })
        } else {
          const send = await sendCustomerSms(c.id, body)
          if (send.ok) {
            await sb.from('contacts').update({ notes: appendMarker(notes, 'p5_7d') }).eq('id', c.id)
            fired.push({ id: c.id, trigger: 'p5_7d', name: firstName })
          } else { skipped.push({ id: c.id, why: 'send_failed_p5_7d', err: send.err }) }
        }
        continue
      }
    }

    // Stage 7: permit approved (entered ≤24h, not yet acknowledged)
    if (stage === 7 && enteredAt && ageDays < 1 && !hasMarker(notes, 'p7_approved')) {
      if (quietHours) { skipped.push({ id: c.id, why: 'quiet_hours_p7' }); continue }
      const body = copyPermitApproved(firstName)
      if (dryRun) {
        fired.push({ id: c.id, trigger: 'p7_approved', dryRun: true, body })
      } else {
        const send = await sendCustomerSms(c.id, body)
        if (send.ok) {
          await sb.from('contacts').update({ notes: appendMarker(notes, 'p7_approved') }).eq('id', c.id)
          fired.push({ id: c.id, trigger: 'p7_approved', name: firstName })
        } else { skipped.push({ id: c.id, why: 'send_failed_p7', err: send.err }) }
      }
      continue
    }

    // Stage 8: install reminder ~24h before install_at
    if (stage === 8 && c.install_at && !hasMarker(notes, 'p8_reminder')) {
      const installTime = new Date(c.install_at).getTime()
      const hoursUntil = (installTime - now.getTime()) / (3600 * 1000)
      if (hoursUntil > 18 && hoursUntil <= 30) {
        if (quietHours) { skipped.push({ id: c.id, why: 'quiet_hours_p8' }); continue }
        const body = copyInstallReminder(firstName)
        if (dryRun) {
          fired.push({ id: c.id, trigger: 'p8_reminder', dryRun: true, body })
        } else {
          const send = await sendCustomerSms(c.id, body)
          if (send.ok) {
            await sb.from('contacts').update({ notes: appendMarker(notes, 'p8_reminder') }).eq('id', c.id)
            fired.push({ id: c.id, trigger: 'p8_reminder', name: firstName })
          } else { skipped.push({ id: c.id, why: 'send_failed_p8', err: send.err }) }
        }
        continue
      }
    }
  }

  // ── Weekly Key digest of stalled contacts ──────────────────────────────────
  // Once per week (Monday 9am ET), surface anything stuck 14d+ so it doesn't
  // rot. Marker on the GLOBAL bpp_meta key so we don't double-fire across
  // multiple hourly runs in the same Monday.
  let digestSent = false
  const dow = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }).format(now)
  const hour = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }).format(now), 10)
  if (dow === 'Mon' && hour === 9 && stalledForDigest.length > 0 && !dryRun) {
    // Use a singleton row in `bpp_todos` (existing table) as a poor-man's
    // last-fired marker. Tag = 'orch_digest_last_fired'. Schema-tolerant —
    // if the table doesn't exist or insert fails, just send the digest.
    const weekKey = (() => {
      const d = new Date(now); d.setDate(d.getDate() - d.getDay())
      return d.toISOString().slice(0, 10)
    })()
    let alreadyFired = false
    try {
      const { data: prior } = await sb.from('bpp_todos')
        .select('id, title')
        .eq('title', `orch_digest_${weekKey}`)
        .limit(1)
      alreadyFired = !!(prior && prior.length)
    } catch (_) { /* schema-tolerant */ }

    if (!alreadyFired) {
      const top = stalledForDigest
        .sort((a, b) => b.ageDays - a.ageDays)
        .slice(0, 8)
        .map(s => `- ${s.name || '(no name)'} stage ${s.stage} ${s.ageDays}d`)
        .join('\n')
      const digest = `Weekly stalled-contact digest (${stalledForDigest.length} stuck 14d+):\n${top}\nOpen CRM > Stalled lens to triage.`
      const r = await sendTwilio(KEY_CELL, digest)
      if (r.ok) {
        digestSent = true
        try {
          await sb.from('bpp_todos').insert({
            title: `orch_digest_${weekKey}`,
            body: `${stalledForDigest.length} stalled at digest time`,
            status: 'done',
          })
        } catch (_) { /* schema-tolerant */ }
      }
    }
  }

  return json(200, {
    ok: true,
    quietHours,
    candidates: (candidates || []).length,
    fired: fired.length,
    skipped: skipped.length,
    digestSent,
    stalledCount: stalledForDigest.length,
    fires: fired,
    skippedDetail: skipped.slice(0, 20),
  })
})
