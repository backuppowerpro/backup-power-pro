// auto-review-ask
// Runs daily 10am EDT via pg_cron.
//
// Finds contacts that:
//   - reached stage 9 (install complete / inspection passed) 24–72 hours ago
//   - are not DNC'd
//   - haven't already been sent a review ask (tracked via contacts.notes
//     containing "__review_asked:" marker, same line-prefix convention as
//     __pm_* materials + __install_at)
// and sends each one a personalized Google-review SMS.
//
// Why 24–72 hours post-install: too early = customer hasn't had the
// outage experience yet, ask feels hollow. Too late = momentum lost.
// 1–3 days hits peak happiness.
//
// Every review sent is logged to the contact's notes so we never
// double-ask. Failures are captured but don't block other sends.
//
// CEO rationale: every 5-star Google review permanently lifts GBP
// ranking. Ten reviews earned passively over a month is real organic
// traffic for $0. Closes the growth loop that starts with ad spend.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function reviewMessage(firstName: string) {
  // Mirrors the manual Draft-ask copy in the CRM (32a10e4) so there's
  // one consistent voice. No Place ID dependency — directs customer to
  // search + click Reviews.
  return `Hi ${firstName} — thanks again for trusting BPP with your install! If you had a good experience, a quick Google review means the world to a small local shop. Search "Backup Power Pro" on Google and click the Reviews link. Takes 30 seconds and helps more Upstate SC folks find us. — Key`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Window: stage_history rows with to_stage=9 in the last 24–72 hours.
  // stage_history is more reliable than "contacts at stage 9 now" because
  // a customer can sit at stage 9 for weeks and we only want to ask fresh
  // installs. Contacts.install_date would also work but not every contact
  // has one set.
  const now = Date.now()
  const seventyTwoHrsAgo = new Date(now - 72 * 3600 * 1000).toISOString()
  const twentyFourHrsAgo = new Date(now - 24 * 3600 * 1000).toISOString()

  const { data: transitions, error: transErr } = await supabase
    .from('stage_history')
    .select('contact_id, changed_at')
    .eq('to_stage', 9)
    .gte('changed_at', seventyTwoHrsAgo)
    .lte('changed_at', twentyFourHrsAgo)

  if (transErr) {
    return new Response(JSON.stringify({ error: transErr.message }), { status: 500, headers: CORS })
  }

  const candidateIds = Array.from(new Set((transitions || []).map(t => t.contact_id).filter(Boolean)))
  if (candidateIds.length === 0) {
    return new Response(JSON.stringify({ ok: true, candidates: 0, sent: 0, skipped: 0 }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, name, phone, do_not_contact, notes')
    .in('id', candidateIds)

  let sent = 0
  let skipped = 0
  const results: any[] = []

  for (const c of (contacts || [])) {
    // Skip DNC + anyone we've already asked (notes contains __review_asked:)
    if (c.do_not_contact) { skipped++; results.push({ id: c.id, skip: 'dnc' }); continue }
    if ((c.notes || '').includes('__review_asked:')) { skipped++; results.push({ id: c.id, skip: 'already_asked' }); continue }
    if (!c.phone) { skipped++; results.push({ id: c.id, skip: 'no_phone' }); continue }

    const firstName = (c.name || '').trim().split(/\s+/)[0] || 'there'
    const body = reviewMessage(firstName)

    // Fire send-sms with contactId; it handles Twilio + logging the message
    // to the messages table. Non-blocking failure; we still mark this
    // contact as asked to avoid duplicate attempts on subsequent runs.
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        body: JSON.stringify({ contactId: c.id, body }),
      })
      if (!res.ok) {
        results.push({ id: c.id, error: `send-sms ${res.status}` })
        continue
      }
      // Mark contact as asked so we don't double-send. Line-prefix convention
      // matches the __pm_*, __install_at, __insp_* patterns already in use.
      const marker = `__review_asked: ${new Date().toISOString()}`
      const nextNotes = (c.notes ? c.notes + '\n' : '') + marker
      await supabase.from('contacts').update({ notes: nextNotes }).eq('id', c.id)
      sent++
      results.push({ id: c.id, sent: true, name: c.name })
    } catch (e) {
      results.push({ id: c.id, error: (e as Error).message })
    }
  }

  return new Response(
    JSON.stringify({ ok: true, candidates: candidateIds.length, sent, skipped, results }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } }
  )
})
