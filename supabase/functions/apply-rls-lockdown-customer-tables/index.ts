/**
 * Final RLS lockdown: remove anon direct access to proposals + invoices.
 * All customer-facing reads/writes now route through edge functions
 * (proposal-view, proposal-mutate, invoice-view) that use service role
 * internally and enforce per-action field whitelists.
 *
 * Run ONLY after proposal.html + invoice.html have been deployed with
 * the edge-function migration (commit on or after bdc4115, pushed to
 * GH Pages).
 *
 * Idempotent. Delete this function after it's run.
 */

import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
}

const MIGRATION_SQL = `
-- proposals — remove bypassable anon policies, REVOKE anon privilege.
-- authenticated (CRM) + service_role (edge fns) keep access.
DROP POLICY IF EXISTS anon_read_by_token ON public.proposals;
DROP POLICY IF EXISTS anon_update_by_token ON public.proposals;
DROP POLICY IF EXISTS bpp_anon_select ON public.proposals;
DROP POLICY IF EXISTS bpp_anon_update ON public.proposals;
REVOKE ALL ON public.proposals FROM anon;

-- invoices — same pattern. invoice.html now reads via invoice-view edge
-- fn; no direct anon SELECT/UPDATE needed.
DROP POLICY IF EXISTS anon_read_by_token ON public.invoices;
DROP POLICY IF EXISTS anon_update_by_token ON public.invoices;
DROP POLICY IF EXISTS bpp_anon_select ON public.invoices;
DROP POLICY IF EXISTS bpp_anon_update ON public.invoices;
REVOKE ALL ON public.invoices FROM anon;
`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  const dbUrl = Deno.env.get('SUPABASE_DB_URL')
  if (!dbUrl) {
    return new Response(JSON.stringify({ error: 'SUPABASE_DB_URL not available' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const sql = postgres(dbUrl, { max: 1 })
  try {
    await sql.unsafe(MIGRATION_SQL)
    await sql.end()
    return new Response(JSON.stringify({ success: true, message: 'Proposals + invoices locked down from anon.' }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    await sql.end()
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
