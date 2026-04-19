// sub-schedule
// Returns a specific installer's scheduled installs for today + next 7 days.
// Authenticated by a simple token → installer name mapping (installer_tokens
// table) so a sub doesn't need a full Supabase auth account.
//
// Response shape: { installer, today: [...], upcoming: [...] }
// Each install row includes: contact name, address, phone, jurisdiction name,
// jurisdiction portal link, install_date, permit pipeline state, installer_pay.
//
// Frontend: /sub/?token=... (static HTML page, fetches this endpoint).
// See sub/index.html.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  const url = new URL(req.url)
  const token = url.searchParams.get('token') || ''
  if (!token) {
    return new Response(JSON.stringify({ error: 'missing token' }), { status: 400, headers: CORS })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Token → installer name mapping. Separate installer_tokens table keeps
  // installer names in contacts as plain text while giving subs scoped
  // access via opaque tokens. Key can rotate a sub's token any time without
  // disturbing historical assignments.
  const { data: tokenRow } = await supabase
    .from('installer_tokens')
    .select('installer_name, revoked_at')
    .eq('token', token)
    .maybeSingle()

  if (!tokenRow || tokenRow.revoked_at) {
    return new Response(JSON.stringify({ error: 'invalid or revoked token' }), { status: 401, headers: CORS })
  }

  const installer = tokenRow.installer_name
  const nowIso = new Date().toISOString()
  const sevenDaysOutIso = new Date(Date.now() + 7 * 86400000).toISOString()

  const { data: rows, error } = await supabase
    .from('contacts')
    .select('id, name, phone, address, install_date, stage, installer_pay, jurisdiction_id, install_notes, permit_jurisdictions(name, phone, link1_title, link1_url)')
    .eq('assigned_installer', installer)
    .not('install_date', 'is', null)
    .gte('install_date', nowIso)
    .lte('install_date', sevenDaysOutIso)
    .order('install_date', { ascending: true })

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS })
  }

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(todayStart.getTime() + 86400000)
  const today: any[] = []
  const upcoming: any[] = []

  for (const r of (rows || [])) {
    const d = new Date(r.install_date)
    const item = {
      id: r.id,
      name: r.name,
      phone: r.phone,
      address: r.address,
      install_date: r.install_date,
      stage: r.stage,
      installer_pay: r.installer_pay,
      jurisdiction: Array.isArray(r.permit_jurisdictions) ? r.permit_jurisdictions[0] : r.permit_jurisdictions,
    }
    if (d >= todayStart && d < todayEnd) today.push(item)
    else upcoming.push(item)
  }

  return new Response(
    JSON.stringify({ installer, today, upcoming }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } }
  )
})
