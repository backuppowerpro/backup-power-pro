/**
 * search-comms
 * Fuzzy full-text search across all messages and contact notes.
 * Returns matches with contact context for CRM search panel and Sparky.
 *
 * GET /search-comms?q=cord+length&limit=30&mode=messages|notes|all
 *
 * Auth: uses service role key — caller must be authenticated (CRM anon key validated via header)
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireServiceRole, escapeIlike, allowRate } from '../_shared/auth.ts'

function stripHtml(s: string): string {
  return (s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function snippet(body: string, query: string, windowSize = 120): string {
  const lower = body.toLowerCase()
  const q = query.toLowerCase().trim()
  const words = q.split(/\s+/).filter(Boolean)

  // Find the first word that appears
  let bestIdx = -1
  for (const w of words) {
    const idx = lower.indexOf(w)
    if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) bestIdx = idx
  }

  if (bestIdx === -1) return body.slice(0, windowSize) + (body.length > windowSize ? '…' : '')

  const start = Math.max(0, bestIdx - 30)
  const end = Math.min(body.length, start + windowSize)
  let snip = body.slice(start, end)
  if (start > 0) snip = '…' + snip
  if (end < body.length) snip = snip + '…'
  return snip
}

function scoreMatch(body: string, words: string[]): number {
  const lower = body.toLowerCase()
  let score = 0
  for (const w of words) {
    if (lower.includes(w)) score += 10
    // Bonus for exact phrase match (all words adjacent)
  }
  return score
}

Deno.serve(async (req) => {
  // CORS for the CRM
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
      }
    })
  }

  // Apr 27 audit (CRITICAL-1): publishable-key auth is not meaningful here
  // because the publishable key ships in every public landing page —
  // anyone could pull it and harvest customer PII (name, phone, status,
  // body) at scale. Promoting to requireServiceRole. The CRM v2 client
  // already proxies search-comms through a session-bound flow when
  // needed; if that breaks, the right fix is a CRM-server bridge, not
  // re-opening this endpoint to anon.
  { const gate = requireServiceRole(req); if (gate) return gate; }
  // Per-IP rate limit — 30/min — defends against any future bridge that
  // opens the door wider, plus stops a leaked SR token from being
  // weaponized for a quick-grab.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!allowRate(`search-comms:${ip}`, 30)) {
    return new Response(JSON.stringify({ error: 'rate limited' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }

  const url   = new URL(req.url)
  const query = (url.searchParams.get('q') || '').trim()
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '40'), 100)
  const mode  = url.searchParams.get('mode') || 'all'  // messages | notes | all

  if (!query || query.length < 2) {
    return new Response(JSON.stringify({ results: [], query }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const words  = query.toLowerCase().split(/\s+/).filter(Boolean)
  const results: any[] = []

  // ── Search messages ──────────────────────────────────────────────────────
  if (mode === 'messages' || mode === 'all') {
    // Build OR filter: each word must appear somewhere — use or() chain
    let messagesQuery = supabase
      .from('messages')
      .select('id, body, direction, created_at, contact_id, contacts(id, name, phone, status, stage)')
      .not('body', 'is', null)
      .order('created_at', { ascending: false })
      .limit(200)  // Pull more, filter + score client-side in edge fn

    // Filter: body must contain at least one search word (case-insensitive)
    // Supabase supports .or() with ilike filters
    const orFilters = words.map(w => `body.ilike.%${escapeIlike(w)}%`).join(',')
    messagesQuery = messagesQuery.or(orFilters)

    const { data: msgs, error: msgsErr } = await messagesQuery

    if (!msgsErr && msgs) {
      for (const m of msgs) {
        const contact = (m as any).contacts
        if (!contact) continue
        const score = scoreMatch(m.body, words)
        if (score === 0) continue
        results.push({
          type: 'message',
          contact_id: contact.id,
          contact_name: contact.name || 'Unknown',
          contact_phone: contact.phone || '',
          contact_status: contact.status || '',
          direction: m.direction,
          body: m.body,
          snippet: snippet(m.body, query),
          created_at: m.created_at,
          score,
        })
      }
    }
  }

  // ── Search contact notes ─────────────────────────────────────────────────
  if (mode === 'notes' || mode === 'all') {
    const orFilters = words.map(w => `notes.ilike.%${escapeIlike(w)}%`).join(',')
    const { data: notesContacts, error: notesErr } = await supabase
      .from('contacts')
      .select('id, name, phone, status, stage, notes')
      .not('notes', 'is', null)
      .or(orFilters)
      .limit(50)

    if (!notesErr && notesContacts) {
      for (const c of notesContacts) {
        if (!c.notes) continue
        const score = scoreMatch(c.notes, words)
        if (score === 0) continue
        results.push({
          type: 'note',
          contact_id: c.id,
          contact_name: c.name || 'Unknown',
          contact_phone: c.phone || '',
          contact_status: c.status || '',
          direction: null,
          body: c.notes,
          snippet: snippet(c.notes, query),
          created_at: null,
          score,
        })
      }
    }
  }

  // Sort by score desc, then date desc
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    const da = a.created_at ? new Date(a.created_at).getTime() : 0
    const db = b.created_at ? new Date(b.created_at).getTime() : 0
    return db - da
  })

  return new Response(JSON.stringify({
    results: results.slice(0, limit),
    total: results.length,
    query,
  }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  })
})
