/**
 * proposal-view — returns the full proposal row for a given token.
 * Replaces the old customer-facing `db.from('proposals').select('*').eq('token', token)`
 * path so anon no longer needs direct table access. The token IS the
 * gatekeeper — unguessable UUID v4, single-row lookup.
 *
 * GET /proposal-view?token=<uuid>
 * → 200 { proposal: {...} }
 * → 404 { error: 'not found' }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
  const url = new URL(req.url)
  const token = url.searchParams.get('token') || ''
  if (!token || token.length < 8) {
    return new Response(JSON.stringify({ error: 'missing token' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data, error } = await sb.from('proposals').select('*').eq('token', token).maybeSingle()
  if (error || !data) {
    return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  // Superseded check (Apr 27 visual audit): if a newer proposal exists for the
  // same contact, this row was auto-marked `superseded_by`. Don't render it
  // (and especially don't accept payment through its deposit-checkout); send
  // the customer to the latest one. Skip the check if this proposal was
  // already signed — at that point the price was locked in.
  if (data.superseded_by && !data.signed_at) {
    const { data: latest } = await sb
      .from('proposals')
      .select('token')
      .eq('id', data.superseded_by)
      .maybeSingle()
    return new Response(JSON.stringify({
      error: 'superseded',
      latest_token: latest?.token || null,
      superseded_at: data.superseded_at,
    }), {
      status: 410, // Gone
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ proposal: data }), {
    status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
