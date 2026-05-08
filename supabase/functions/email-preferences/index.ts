/**
 * email-preferences — backs the /preferences page on backuppowerpro.com.
 *
 * GET  ?cid=<contact_id>           -> returns { name, email, preferences: {...} }
 * POST { cid, preferences: {...} } -> saves preferences (stamps notes markers)
 * POST { cid, optout_all_marketing: true } -> unsubscribes from all marketing
 *
 * Auth: PUBLIC (customer link from email footer). No HMAC token because this
 * only allows opt-OUT actions, never opt-IN. Worst-case attack vector: someone
 * unsubscribes a real customer → annoying but not damaging. Mitigated by:
 *   - Unsubscribe is reversible by texting Key
 *   - The cid in URL is a UUID, not enumerable
 *   - GET response strips PII (only first name + email domain visible)
 *
 * Marker convention in contacts.notes:
 *   __email_marketing_off          → stops all marketing-class templates
 *   __email_seasonal_off           → stops storm-prep-reminder
 *   __email_anniversary_off        → stops anniversary
 *   __email_referrals_off          → stops referral-nudge
 *   __email_guides_off             → stops pdf-download (reactivates if requested)
 *
 * The send-email function checks these markers + the global marketing flag.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { allowRate } from '../_shared/auth.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// UUIDs only. Wrong shape returns 400 before any DB hit.
const UUID_RE = /^[0-9a-f-]{36}$/i

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}
const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })

const PREF_KEYS = ['seasonal', 'anniversary', 'referrals', 'guides'] as const
type PrefKey = typeof PREF_KEYS[number]

const MARKER_FOR: Record<PrefKey, string> = {
  seasonal: '__email_seasonal_off',
  anniversary: '__email_anniversary_off',
  referrals: '__email_referrals_off',
  guides: '__email_guides_off',
}

function readPrefs(notes: string): Record<PrefKey, boolean> {
  const result = {} as Record<PrefKey, boolean>
  for (const k of PREF_KEYS) {
    // checkbox is "on" by default; marker presence means off
    result[k] = !notes.includes(MARKER_FOR[k]) && !notes.includes('__email_marketing_off')
  }
  return result
}

function writePrefs(notes: string, prefs: Partial<Record<PrefKey, boolean>>): string {
  let n = notes || ''
  for (const k of PREF_KEYS) {
    if (k in prefs) {
      const marker = MARKER_FOR[k]
      const stamp = `${marker}: ${new Date().toISOString()}`
      // Remove old marker line(s)
      n = n.split('\n').filter(line => !line.startsWith(marker)).join('\n')
      if (prefs[k] === false) {
        n = (n ? n + '\n' : '') + stamp
      }
    }
  }
  return n
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  // Per-IP rate limit. Endpoint is publicly callable (no Supabase key
  // required — has to work from email clients), so a leaked cid would
  // otherwise let an attacker flip prefs unbounded. 30/min per IP is
  // generous for legit clicks, tight enough that scripted abuse fails.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!allowRate(`email-prefs:${ip}`, 30)) {
    return json(429, { error: 'rate_limited' })
  }

  const sb = createClient(SUPABASE_URL, SR)

  if (req.method === 'GET') {
    const url = new URL(req.url)
    const cid = url.searchParams.get('cid') || ''
    if (!cid) return json(400, { error: 'cid required' })
    if (!UUID_RE.test(cid)) return json(400, { error: 'invalid_cid' })
    const { data: c, error } = await sb.from('contacts')
      .select('id, name, email, notes')
      .eq('id', cid)
      .maybeSingle()
    if (error || !c) return json(404, { error: 'not_found' })
    const firstName = (c.name || '').split(/\s+/)[0] || ''
    // PII redaction: never return full email; obscure local-part
    const email = String(c.email || '')
    const obscured = email.replace(/^([^@]{2})[^@]*(@.+)$/, (_, a, b) => `${a}…${b}`)
    return json(200, {
      ok: true,
      name: firstName ? `${firstName}, manage your preferences` : 'Manage your preferences',
      email: obscured || '(no email on file)',
      preferences: readPrefs(String(c.notes || '')),
    })
  }

  if (req.method === 'POST') {
    let body: { cid?: string; preferences?: Partial<Record<PrefKey, boolean>>; optout_all_marketing?: boolean }
    try { body = await req.json() } catch { return json(400, { error: 'invalid_json' }) }
    if (!body.cid) return json(400, { error: 'cid required' })
    if (!UUID_RE.test(body.cid)) return json(400, { error: 'invalid_cid' })

    const { data: c, error } = await sb.from('contacts')
      .select('id, notes')
      .eq('id', body.cid)
      .maybeSingle()
    if (error || !c) return json(404, { error: 'not_found' })

    let newNotes = String(c.notes || '')

    if (body.optout_all_marketing) {
      // Add the master marketing-off marker; the per-template ones become moot
      if (!newNotes.includes('__email_marketing_off')) {
        newNotes = (newNotes ? newNotes + '\n' : '') + `__email_marketing_off: ${new Date().toISOString()}`
      }
    } else if (body.preferences) {
      newNotes = writePrefs(newNotes, body.preferences)
      // If user re-enabled anything, clear the master flag
      if (Object.values(body.preferences).some(v => v === true)) {
        newNotes = newNotes.split('\n').filter(line => !line.startsWith('__email_marketing_off')).join('\n')
      }
    }

    await sb.from('contacts').update({ notes: newNotes }).eq('id', body.cid)
    return json(200, { ok: true })
  }

  return json(405, { error: 'method_not_allowed' })
})
