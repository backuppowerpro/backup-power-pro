/**
 * auto-followup
 *
 * Scans stage 1–3 contacts, identifies who's overdue for a follow-up,
 * and generates personalized draft texts via Sparky (ai-taskmaster).
 *
 * Phase 1: preview mode only — returns drafts for Key to review + send manually.
 * Phase 2 (future): auto_send mode — sends directly, with guardrails.
 *
 * POST { mode?: 'preview', maxItems?: number }
 *
 * Response:
 * {
 *   items: [{
 *     contactId, name, phone, stage, stageLabel,
 *     daysSinceTouch, draft, reason
 *   }],
 *   scanned: number,    // total contacts evaluated
 *   skipped: number     // contacts excluded by staleness rules
 * }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireServiceRole } from '../_shared/auth.ts'

// ── Staleness thresholds (hours without outbound message before drafting follow-up)
const STALE_HOURS: Record<number, number> = {
  1: 2,   // Form Submitted  — respond fast, 2h threshold
  2: 48,  // Responded       — 2 days
  3: 72,  // Quote Sent      — 3 days
}

const STAGE_LABELS: Record<number, string> = {
  1: 'Form Submitted',
  2: 'Responded',
  3: 'Quote Sent',
  4: 'Booked',
  5: 'Permit Submitted',
  6: 'Permit Paid',
  7: 'Permit Approved',
  8: 'Inspection Scheduled',
  9: 'Complete',
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

// ── HANDLER ───────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  const gate = requireServiceRole(req); if (gate) return gate
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' })

  let body: { mode?: string; maxItems?: number } = {}
  try { body = await req.json() } catch { /* use defaults */ }

  const mode     = body.mode || 'preview'
  const maxItems = Math.min(body.maxItems || 6, 10)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const AI_ENDPOINT =
    (Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '') +
    '/functions/v1/ai-taskmaster'
  const AI_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''

  // ── 1. Fetch active stage 1–3 contacts ────────────────────────────────────
  const { data: contacts, error: cErr } = await supabase
    .from('contacts')
    .select('id, name, phone, stage, notes, address, created_at, jurisdiction_id')
    .in('stage', [1, 2, 3])
    .neq('status', 'Archived')
    .not('phone', 'is', null)
    .order('created_at', { ascending: false })

  if (cErr) return json(500, { error: 'contacts query failed: ' + cErr.message })
  if (!contacts || !contacts.length) return json(200, { items: [], scanned: 0, skipped: 0 })

  const contactIds = contacts.map((c: any) => c.id)

  // ── 2. Fetch most recent outbound message per contact ─────────────────────
  // Get last outbound for each candidate in one query
  const { data: lastMsgs } = await supabase
    .from('messages')
    .select('contact_id, created_at')
    .in('contact_id', contactIds)
    .eq('direction', 'outbound')
    .order('created_at', { ascending: false })

  // Build a map: contactId → last outbound Date
  const lastOutbound: Record<string, Date> = {}
  for (const m of (lastMsgs || [])) {
    if (!lastOutbound[m.contact_id]) {
      lastOutbound[m.contact_id] = new Date(m.created_at)
    }
  }

  // ── 3. Apply staleness rules to identify candidates ───────────────────────
  const now = Date.now()
  const candidates: any[] = []

  for (const c of contacts) {
    if (candidates.length >= maxItems) break
    const stage = c.stage || 1
    const thresholdHours = STALE_HOURS[stage] ?? 48
    const thresholdMs    = thresholdHours * 60 * 60 * 1000
    const last           = lastOutbound[c.id]

    // Include if: never texted OR last text is older than threshold
    const hoursSinceTouch = last ? (now - last.getTime()) / (60 * 60 * 1000) : Infinity
    if (hoursSinceTouch < thresholdHours) continue

    // Compute days since touch for Sparky context
    const daysInSystem   = Math.floor((now - new Date(c.created_at).getTime()) / 86400000)
    const daysSinceTouch = last
      ? Math.floor((now - last.getTime()) / 86400000)
      : daysInSystem

    const reason =
      hoursSinceTouch === Infinity
        ? 'No outbound message sent yet'
        : `No text in ${Math.floor(hoursSinceTouch)}h (threshold: ${thresholdHours}h for stage ${stage})`

    candidates.push({
      id: c.id,
      name: c.name,
      phone: c.phone,
      stage,
      stageLabel: STAGE_LABELS[stage] || `Stage ${stage}`,
      daysInSystem,
      daysSinceTouch,
      notes: c.notes || '',
      address: c.address || '',
      reason,
    })
  }

  const skipped = contacts.length - candidates.length

  if (!candidates.length) {
    return json(200, { items: [], scanned: contacts.length, skipped })
  }

  // ── 4. Generate drafts in parallel ────────────────────────────────────────
  const draftResults = await Promise.allSettled(
    candidates.map(async (c) => {
      const resp = await fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AI_KEY}`,
          'apikey': AI_KEY,
        },
        body: JSON.stringify({
          mode: 'draft_followup',
          contact: {
            id:             c.id,
            name:           c.name,
            stage:          c.stage,
            stageLabel:     c.stageLabel,
            daysInSystem:   c.daysInSystem,
            daysSinceTouch: c.daysSinceTouch,
            address:        c.address,
            notes:          c.notes,
          },
        }),
      })
      const data = await resp.json()
      return { ...c, draft: data.answer || '' }
    })
  )

  const items = draftResults
    .map((r, i) => {
      const c = candidates[i]
      if (r.status === 'fulfilled') return r.value
      // Fallback draft if Sparky call fails
      return {
        ...c,
        draft: `Hi ${(c.name || '').split(' ')[0] || 'there'}, just following up — still interested in getting your generator connected?`,
      }
    })
    .filter((item) => item.draft) // drop empty drafts

  return json(200, {
    items,
    scanned: contacts.length,
    skipped,
  })
})
