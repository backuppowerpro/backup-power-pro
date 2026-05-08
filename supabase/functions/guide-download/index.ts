/**
 * guide-download — captures a lead-magnet form submit on /guides/* and
 * triggers the pdf-download email through send-email.
 *
 * Public endpoint, NOT brain-token gated (form-fill must work without auth).
 * Per-IP rate limit prevents form spam.
 *
 * Flow:
 *   1. Validate name + email + guide name
 *   2. Look up or create the contact (avoid duplicates)
 *   3. Stamp notes: "__guide_requested:{guide}:{ts}"
 *   4. Call send-email with template=pdf-download (variables include
 *      guide_name, guide_url, guide_pages)
 *   5. Return { ok: true, redirect_url } so the page can also direct-link
 *      the PDF as a fallback
 *
 * Auth: public + per-IP rate limit (30/hour) + per-email rate limit
 * (3/24h to prevent the same person triggering 100 emails).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { allowRate } from '../_shared/auth.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const BPP_BRAIN_TOKEN = Deno.env.get('BPP_BRAIN_TOKEN') || ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}
const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })

interface GuideMeta {
  filename: string  // PDF filename in storage
  pages: number
  title: string
}

const GUIDES: Record<string, GuideMeta> = {
  'buyers-guide': {
    filename: 'buyers-guide-2026-05.pdf',
    pages: 31,
    title: "The Generator Hookup Buyer's Guide",
  },
  'storm-prep': {
    filename: 'storm-prep-2026-05.pdf',
    pages: 4,
    title: 'Storm Prep Checklist',
  },
  'sizing': {
    filename: 'sizing-cheat-sheet-2026-05.pdf',
    pages: 1,
    title: 'Generator Sizing Cheat Sheet',
  },
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length < 200
}
function isValidName(s: string): boolean {
  return s.length > 0 && s.length < 80 && !/[<>{}]/.test(s)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  let body: { name?: string; email?: string; guide?: string }
  try { body = await req.json() } catch { return json(400, { error: 'invalid_json' }) }

  const name = String(body.name || '').trim()
  const email = String(body.email || '').trim().toLowerCase()
  const guideKey = String(body.guide || '').trim()
  const guide = GUIDES[guideKey]

  if (!isValidName(name)) return json(400, { error: 'invalid_name' })
  if (!isValidEmail(email)) return json(400, { error: 'invalid_email' })
  if (!guide) return json(400, { error: 'invalid_guide' })

  // Per-IP rate limit: 30 form-fills per hour
  const ip = req.headers.get('cf-connecting-ip')
    || req.headers.get('x-forwarded-for')
    || 'unknown'
  if (!allowRate(`guide-dl:${ip}`, 30)) {
    return json(429, { error: 'rate_limited' })
  }
  // Per-email rate limit: 3 sends per 24h
  if (!allowRate(`guide-dl:${email}`, 3)) {
    return json(429, { error: 'too_many_requests', detail: 'Already sent the guide to this email today.' })
  }

  const sb = createClient(SUPABASE_URL, SR)

  // Look up existing contact by email; create if new (no phone, no quote intent)
  const { data: existing } = await sb.from('contacts')
    .select('id, name, email, notes, do_not_contact')
    .eq('email', email)
    .limit(1)

  let contact = existing?.[0]
  if (!contact) {
    const { data: created, error: createErr } = await sb.from('contacts').insert({
      name,
      email,
      status: 'Guide Subscriber',
      notes: `__guide_requested:${guideKey}:${new Date().toISOString()}\n__source: guide-download (no install intent confirmed)`,
    }).select('id, name, email, notes, do_not_contact').single()
    if (createErr || !created) return json(500, { error: 'contact_create_failed' })
    contact = created
  } else {
    // Append the guide-request marker to notes
    const newNotes = (contact.notes ? contact.notes + '\n' : '') + `__guide_requested:${guideKey}:${new Date().toISOString()}`
    await sb.from('contacts').update({ notes: newNotes }).eq('id', contact.id)
  }

  if (contact.do_not_contact) {
    // Still let them download via direct URL but skip the email send
    return json(200, { ok: true, skipped_email: 'dnc', direct_url: `https://backuppowerpro.com/guides/${guide.filename}` })
  }

  // Trigger the pdf-download email via send-email
  const subject = `Here's your ${guide.title}, ${name.split(' ')[0]}.`
  try {
    const sendResp = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SR}`,
        apikey: SR,
        'x-bpp-brain-token': BPP_BRAIN_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template: 'pdf-download',
        contact_id: contact.id,
        subject,
        variables: {
          guide_title: guide.title,
          guide_url: `https://backuppowerpro.com/guides/${guide.filename}`,
          guide_pages: String(guide.pages),
          guide_key: guideKey,
        },
      }),
    })
    if (!sendResp.ok) {
      console.warn('[guide-download] send-email failed:', sendResp.status, (await sendResp.text()).slice(0, 200))
    }
  } catch (e) {
    console.warn('[guide-download] send-email threw', e)
  }

  return json(200, {
    ok: true,
    contact_id: contact.id,
    direct_url: `https://backuppowerpro.com/guides/${guide.filename}`,
  })
})
