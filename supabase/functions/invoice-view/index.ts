/**
 * invoice-view — returns the full invoice row (+ related proposal if any)
 * for a given customer-facing token. Replaces the anon-key
 * `db.from('invoices').select('*').eq('token', token)` in invoice.html,
 * and the follow-up proposal lookup. Also bumps viewed_at on each load.
 *
 * GET /invoice-view?token=<uuid>
 * → 200 { invoice: {...}, proposal: {...} | null }
 * → 404 { error: 'not found' }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { allowRate } from '../_shared/auth.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'GET only' }), { status: 405, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip') || 'unknown'
  if (!allowRate(`invoice-view:${ip}`, 60)) {
    return new Response(JSON.stringify({ error: 'rate limited' }), { status: 429, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
  const url = new URL(req.url)
  const token = url.searchParams.get('token') || ''
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(token)) {
    return new Response(JSON.stringify({ error: 'missing token' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: invoice, error } = await sb.from('invoices').select('*').eq('token', token).maybeSingle()
  if (error || !invoice) {
    return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  // Mirror the previous invoice.html behavior: load related proposal if any.
  let proposal = null
  if (invoice.proposal_id) {
    const { data: p } = await sb.from('proposals').select('*').eq('id', invoice.proposal_id).maybeSingle()
    proposal = p || null
  }

  // Bump viewed_at (best-effort; fire-and-forget).
  sb.from('invoices').update({ viewed_at: new Date().toISOString() }).eq('id', invoice.id).then(() => {}, () => {})

  return new Response(JSON.stringify({ invoice, proposal }), {
    status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
