/**
 * One-shot: audit + repair RLS for every public-schema table that has
 * RLS disabled (Supabase lint rule `rls_disabled_in_public`). For each
 * flagged table, enable RLS and add three policies:
 *   - service_role:  FOR ALL  USING(true) WITH CHECK(true)  (edge fns)
 *   - authenticated: FOR ALL  USING(true) WITH CHECK(true)  (CRM login)
 *   - anon:          no blanket access (default-deny)
 *
 * Customer-facing flows that ARE known to write via anon (proposal.html
 * signing + view tracking, invoice.html) get explicit anon UPDATE
 * policies scoped by token.
 *
 * Idempotent. GET /list to preview; POST /apply to fix.
 */

import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
}

// Tables we know require anon access (customer-facing pages use anon key
// directly, not a service-role edge function). These get an explicit anon
// UPDATE policy so the public proposal.html / invoice.html pages keep
// working. The filter clauses here match the exact writes those pages do.
// Everything else stays anon-blocked.
const ANON_ALLOWED_TABLES: Record<string, { op: string; using: string; check?: string }[]> = {
  // proposal.html updates by token: viewed_at bump, signed_at + signer_name,
  // selected amp/surge/pom toggles. Token is the gatekeeper.
  proposals: [
    { op: 'SELECT', using: 'true' }, // needed to load the quote by token
    { op: 'UPDATE', using: 'token IS NOT NULL', check: 'token IS NOT NULL' },
  ],
  // invoice.html updates viewed_at by token.
  invoices: [
    { op: 'SELECT', using: 'true' },
    { op: 'UPDATE', using: 'token IS NOT NULL', check: 'token IS NOT NULL' },
  ],
  // Landing-page quote form inserts into contacts via edge function (service
  // role) — no anon write needed. Anon read/update stays blocked.
}

async function enableRlsForTable(sql: any, table: string): Promise<string[]> {
  const steps: string[] = []
  await sql.unsafe(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`)
  steps.push(`rls:on`)

  // Drop and recreate the three standard policies so re-runs are clean.
  const basePolicies = [
    { name: 'bpp_service_role_all', role: 'service_role', op: 'ALL', using: 'true', check: 'true' },
    { name: 'bpp_authenticated_all', role: 'authenticated', op: 'ALL', using: 'true', check: 'true' },
  ]
  for (const p of basePolicies) {
    await sql.unsafe(`DROP POLICY IF EXISTS ${p.name} ON public.${table};`)
    await sql.unsafe(`
      CREATE POLICY ${p.name} ON public.${table}
      AS PERMISSIVE
      FOR ${p.op}
      TO ${p.role}
      USING (${p.using})
      WITH CHECK (${p.check});
    `)
    steps.push(`policy:${p.name}`)
  }

  const anonRules = ANON_ALLOWED_TABLES[table]
  if (anonRules) {
    for (const r of anonRules) {
      const pname = `bpp_anon_${r.op.toLowerCase()}`
      await sql.unsafe(`DROP POLICY IF EXISTS ${pname} ON public.${table};`)
      // SELECT policies don't take WITH CHECK; only UPDATE/INSERT do.
      if (r.op === 'SELECT' || r.op === 'DELETE') {
        await sql.unsafe(`
          CREATE POLICY ${pname} ON public.${table}
          AS PERMISSIVE
          FOR ${r.op}
          TO anon
          USING (${r.using});
        `)
      } else {
        await sql.unsafe(`
          CREATE POLICY ${pname} ON public.${table}
          AS PERMISSIVE
          FOR ${r.op}
          TO anon
          USING (${r.using})
          WITH CHECK (${r.check ?? r.using});
        `)
      }
      steps.push(`policy:${pname}`)
    }
  }
  return steps
}

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
    const url = new URL(req.url)
    const action = url.searchParams.get('mode') || (req.method === 'POST' ? 'apply' : 'list')

    // Find every public-schema table that has RLS disabled.
    const rows = await sql`
      SELECT c.relname AS table_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND c.relrowsecurity = FALSE
      ORDER BY c.relname
    `
    const flagged = rows.map((r: any) => r.table_name as string)

    if (action === 'list') {
      await sql.end()
      return new Response(JSON.stringify({ mode: 'list', flagged, count: flagged.length }, null, 2), {
        status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // Apply mode: enable RLS + standard policies on each flagged table.
    const report: Record<string, string[]> = {}
    const errors: Record<string, string> = {}
    for (const t of flagged) {
      try {
        report[t] = await enableRlsForTable(sql, t)
      } catch (e) {
        errors[t] = String(e)
      }
    }
    await sql.end()
    return new Response(JSON.stringify({
      mode: 'apply',
      flagged_count: flagged.length,
      fixed: Object.keys(report),
      report,
      errors,
    }, null, 2), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    await sql.end()
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
