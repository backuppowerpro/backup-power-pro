// sub-mark-complete
// Lets an authenticated installer mark one of their assigned installs as
// complete (stage 9) from the /sub/ portal. Scoped so a sub can only
// complete installs assigned to them — can't touch anyone else's contacts.
//
// Body: { token, contactId }
// Response: { ok: true, from_stage, to_stage }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: CORS })

  let body: any
  try { body = await req.json() } catch { return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400, headers: CORS }) }
  const { token, contactId } = body || {}
  if (!token || !contactId) {
    return new Response(JSON.stringify({ error: 'missing token or contactId' }), { status: 400, headers: CORS })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Verify token via SHA-256 hash match (legacy plaintext fallback during
  // migration). Hashed path lets us drop plaintext `token` column later.
  const hash = await sha256Hex(token)
  let { data: tokenRow } = await supabase
    .from('installer_tokens')
    .select('installer_name, revoked_at')
    .eq('token_hash', hash)
    .maybeSingle()
  if (!tokenRow) {
    const legacy = await supabase
      .from('installer_tokens')
      .select('installer_name, revoked_at')
      .eq('token', token)
      .maybeSingle()
    tokenRow = legacy.data
  }

  if (!tokenRow || tokenRow.revoked_at) {
    return new Response(JSON.stringify({ error: 'invalid token' }), { status: 401, headers: CORS })
  }

  // Verify the contact is actually assigned to this installer before allowing
  // stage change. Stops a leaked token from advancing random contacts.
  const { data: contact } = await supabase
    .from('contacts')
    .select('id, stage, assigned_installer')
    .eq('id', contactId)
    .maybeSingle()

  if (!contact) {
    return new Response(JSON.stringify({ error: 'contact not found' }), { status: 404, headers: CORS })
  }
  if (contact.assigned_installer !== tokenRow.installer_name) {
    return new Response(JSON.stringify({ error: 'not your install' }), { status: 403, headers: CORS })
  }

  const fromStage = contact.stage || 1
  if (fromStage === 9) {
    return new Response(JSON.stringify({ ok: true, note: 'already complete', from_stage: 9, to_stage: 9 }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  // Advance to stage 9 (complete / inspection passed) + record transition
  const { error: updErr } = await supabase
    .from('contacts')
    .update({ stage: 9 })
    .eq('id', contactId)
  if (updErr) {
    return new Response(JSON.stringify({ error: updErr.message }), { status: 500, headers: CORS })
  }

  await supabase
    .from('stage_history')
    .insert([{ contact_id: contactId, from_stage: fromStage, to_stage: 9 }])

  return new Response(
    JSON.stringify({ ok: true, from_stage: fromStage, to_stage: 9 }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } }
  )
})
