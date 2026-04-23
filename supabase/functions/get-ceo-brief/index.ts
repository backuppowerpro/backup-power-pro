/**
 * get-ceo-brief — returns the `ceo_morning_brief` string from sparky_memory.
 * Read-only, uses the service role internally so we don't have to widen
 * sparky_memory RLS to let anon read a single key. Public GET — anyone
 * who reaches this URL gets the CEO brief. That's acceptable because the
 * brief summarises public-facing business state (campaigns, pipeline
 * counts) and is what Claude loads at session start.
 *
 * Replaces the previous pattern of embedding the service_role JWT in
 * CLAUDE.md's boot curl — that JWT was sitting in a public repo.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  const url = Deno.env.get('SUPABASE_URL')!
  const sr  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const sb  = createClient(url, sr)

  const { data, error } = await sb
    .from('sparky_memory')
    .select('value')
    .eq('key', 'ceo_morning_brief')
    .maybeSingle()

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
  const brief = (data?.value || 'No brief available').toString()
  return new Response(brief, {
    status: 200, headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8' },
  })
})
