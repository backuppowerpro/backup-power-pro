// suggest-reply
//
// Generates 2-3 short SMS reply suggestions for an open thread, mirroring
// Key's voice. Learning happens via in-context examples: we pull his last
// ~20 outbound replies (across all contacts) PLUS any starred suggestions
// (highly weighted), then prompt Claude with those + the active thread.
//
// No fine-tuning, no ML pipeline — every call gets a fresh prompt that
// reflects how Key actually writes today. As he sends more (and stars
// good suggestions), the prompt gets richer.
//
// Auth: requireAnonOrServiceRole. Rate-limited per-contact (10/min).

import { requireAnonOrServiceRole, allowRate } from '../_shared/auth.ts'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const MODEL = 'claude-haiku-4-5-20251001' // Cheap + fast; this fires on every "suggest" tap.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

async function dbFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...init,
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
}

interface Msg {
  contact_id: string
  direction: string
  sender_role?: string
  body: string
  sent_at: string
}

interface Contact {
  id: string
  name: string | null
  stage?: string
  address?: string | null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  const gate = requireAnonOrServiceRole(req)
  if (gate) return gate

  let body: any
  try { body = await req.json() } catch { return json({ error: 'invalid json' }, 400) }

  const contactId = String(body?.contactId || '').trim()
  if (!contactId) return json({ error: 'contactId required' }, 400)

  const rateOk = allowRate(`suggest-reply:${contactId}`, 10)
  if (!rateOk) return json({ error: 'rate limit' }, 429)

  // ── Pull data ────────────────────────────────────────────────────
  // (1) Active thread for the contact (last 30 messages)
  const threadRes = await dbFetch(
    `/messages?contact_id=eq.${contactId}&order=sent_at.desc&limit=30&select=direction,sender_role,body,sent_at`
  )
  if (!threadRes.ok) return json({ error: 'thread fetch failed' }, 500)
  const threadDesc = await threadRes.json() as Msg[]
  const thread = [...threadDesc].reverse() // chronological for the prompt

  if (thread.length === 0) {
    return json({ suggestions: ['Hey! Following up — let me know if you have any questions.'] })
  }

  // The most recent inbound is what Key is replying to. If the last
  // message is outbound, no reply suggestion makes sense (he's already
  // the last speaker — the "tennis match" rule says wait).
  const lastInbound = [...thread].reverse().find(m => m.direction === 'in')
  if (!lastInbound) {
    return json({ suggestions: [] })
  }

  // (2) Contact context for {firstName} + stage-aware nudges
  const contactRes = await dbFetch(`/contacts?id=eq.${contactId}&select=id,name,stage,address`)
  if (!contactRes.ok) return json({ error: 'contact fetch failed' }, 500)
  const contacts = await contactRes.json() as Contact[]
  const contact = contacts[0]

  // (3) Voice corpus — Key's last ~20 outbound replies across ALL contacts.
  // We treat these as in-context examples; Claude mimics tone and length.
  const voiceRes = await dbFetch(
    `/messages?or=(direction.eq.out,sender_role.eq.key)&order=sent_at.desc&limit=40&select=body`
  )
  const voiceMsgs = voiceRes.ok ? (await voiceRes.json() as { body: string }[]) : []
  const voiceSamples = voiceMsgs
    .map(m => (m.body || '').trim())
    .filter(b => b.length > 4 && b.length < 280)
    .slice(0, 20)

  // (4) Starred suggestions — Key's curated good-replies. These get
  // weighted as gold-standard examples in the prompt. (Table is created
  // in this same migration; missing-table errors are tolerated so the
  // function still works before the migration runs.)
  let starredSamples: string[] = []
  try {
    const starredRes = await dbFetch(
      `/reply_suggestion_stars?order=created_at.desc&limit=15&select=body`
    )
    if (starredRes.ok) {
      starredSamples = (await starredRes.json() as { body: string }[])
        .map(r => r.body)
        .filter(Boolean)
    }
  } catch { /* table may not exist yet */ }

  // ── Build prompt ─────────────────────────────────────────────────
  const firstName = (contact?.name || '').trim().split(/\s+/)[0] || 'there'
  const threadText = thread.slice(-12).map(m => {
    const who = (m.direction === 'out' || m.sender_role === 'key') ? 'KEY' : firstName.toUpperCase()
    return `${who}: ${m.body}`
  }).join('\n')

  const voiceBlock = voiceSamples.length > 0
    ? `Recent replies Key has actually sent (mimic this tone, length, and voice — terse, warm, direct, no corporate fluff):\n${voiceSamples.map(s => '- ' + s).join('\n')}\n`
    : ''
  const starredBlock = starredSamples.length > 0
    ? `\nSTARRED examples (these were generated suggestions Key liked enough to send — match THIS quality bar):\n${starredSamples.map(s => '- ' + s).join('\n')}\n`
    : ''

  const systemPrompt = `You are Key Goodson, a solo electrician at Backup Power Pro in Greenville/Spartanburg/Pickens, SC. You install generator inlets. You text customers directly.

Your voice rules:
- Short. Most replies are one sentence.
- Warm but not corporate. Never say "I appreciate your patience."
- Use first name only ("${firstName}").
- Don't sign off ("- Key", "Thanks!", etc.) — texts don't need signatures.
- If you say "${firstName}", put it once at the start, not throughout.

${voiceBlock}${starredBlock}
Generate 3 suggested replies to the customer's most recent message. Each must be:
- Distinct from the others (different angles: confirm, ask question, send link)
- Honest — never promise a time you don't know
- Plausibly something Key would actually send

Output JSON ONLY, no preamble:
{"suggestions": ["reply 1", "reply 2", "reply 3"]}`

  // ── Call Claude ─────────────────────────────────────────────────
  let suggestions: string[] = []
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Active thread:\n${threadText}\n\nThe customer's last message was: "${lastInbound.body}". Generate 3 reply suggestions.`,
        }],
      }),
    })
    if (!resp.ok) {
      const t = await resp.text()
      return json({ error: `claude ${resp.status}: ${t.slice(0, 200)}` }, 500)
    }
    const data = await resp.json()
    const text = (data.content?.[0]?.text || '').trim()
    // Pull the JSON out — Claude sometimes wraps in fences despite the
    // "JSON ONLY" instruction.
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return json({ error: 'no json in response', raw: text.slice(0, 200) }, 500)
    const parsed = JSON.parse(jsonMatch[0])
    suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3) : []
  } catch (e) {
    return json({ error: `claude call failed: ${(e as Error).message}` }, 500)
  }

  return json({ suggestions, voiceCount: voiceSamples.length, starredCount: starredSamples.length })
})
